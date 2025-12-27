// Python runner module - process supervision and event streaming
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, RwLock, broadcast};
use serde::{Deserialize, Serialize};
use chrono::Utc;

/// Events emitted by the Python runner (JSONL protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum RunnerEvent {
    Log {
        level: String,
        message: String,
        ts: String,
    },
    Metric {
        key: String,
        value: f64,
        step: i32,
        ts: String,
    },
    Progress {
        current: i32,
        total: i32,
        ts: String,
    },
    Artifact {
        kind: String,
        path: String,
        sha256: String,
        ts: String,
    },
    Status {
        state: String,
        error: Option<String>,
        ts: String,
    },
    Device {
        name: String,
        ts: String,
    },
}

/// A managed training run
#[allow(dead_code)]
pub struct ManagedRun {
    pub run_id: String,
    pub project_id: String,
    process: Option<Child>,
    cancel_tx: Option<broadcast::Sender<()>>,
}

/// Runner manager - supervises Python training processes
#[allow(dead_code)]
pub struct RunnerManager {
    python_path: PathBuf,
    runner_script: PathBuf,
    active_runs: Arc<RwLock<HashMap<String, ManagedRun>>>,
}

impl RunnerManager {
    pub fn new(python_path: PathBuf, runner_script: PathBuf) -> Self {
        Self {
            python_path,
            runner_script,
            active_runs: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Start a training run
    pub async fn start_run(
        &self,
        run_id: String,
        project_id: String,
        config_path: &Path,
        run_dir: &Path,
        dataset_path: Option<&Path>,
        event_tx: mpsc::Sender<(String, RunnerEvent)>,
    ) -> Result<(), RunnerError> {
        // Check if run already exists
        {
            let runs = self.active_runs.read().await;
            if runs.contains_key(&run_id) {
                return Err(RunnerError::AlreadyRunning(run_id.clone()));
            }
        }
        
        // Build command
        let mut cmd = Command::new(&self.python_path);
        cmd.arg(&self.runner_script)
            .arg("--run-id").arg(&run_id)
            .arg("--config").arg(config_path)
            .arg("--output-dir").arg(run_dir);
        
        if let Some(ds) = dataset_path {
            cmd.arg("--dataset").arg(ds);
        }
        
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        
        let mut child = cmd.spawn()
            .map_err(|e| RunnerError::SpawnFailed(e.to_string()))?;
        
        let (cancel_tx, _) = broadcast::channel(1);
        
        // Spawn stdout reader
        if let Some(stdout) = child.stdout.take() {
            let run_id_clone = run_id.clone();
            let event_tx_clone = event_tx.clone();
            let mut cancel_rx = cancel_tx.subscribe();
            
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                
                loop {
                    tokio::select! {
                        line = lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    if let Ok(event) = serde_json::from_str::<RunnerEvent>(&line) {
                                        let _ = event_tx_clone.send((run_id_clone.clone(), event)).await;
                                    } else {
                                        // Plain text log
                                        let event = RunnerEvent::Log {
                                            level: "INFO".to_string(),
                                            message: line,
                                            ts: Utc::now().to_rfc3339(),
                                        };
                                        let _ = event_tx_clone.send((run_id_clone.clone(), event)).await;
                                    }
                                }
                                Ok(None) => break,
                                Err(_) => break,
                            }
                        }
                        _ = cancel_rx.recv() => {
                            break;
                        }
                    }
                }
            });
        }
        
        // Spawn stderr reader
        if let Some(stderr) = child.stderr.take() {
            let run_id_clone = run_id.clone();
            let event_tx_clone = event_tx.clone();
            let mut cancel_rx = cancel_tx.subscribe();
            
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                
                loop {
                    tokio::select! {
                        line = lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    let event = RunnerEvent::Log {
                                        level: "ERROR".to_string(),
                                        message: line,
                                        ts: Utc::now().to_rfc3339(),
                                    };
                                    let _ = event_tx_clone.send((run_id_clone.clone(), event)).await;
                                }
                                Ok(None) => break,
                                Err(_) => break,
                            }
                        }
                        _ = cancel_rx.recv() => {
                            break;
                        }
                    }
                }
            });
        }
        
        // Store managed run
        {
            let mut runs = self.active_runs.write().await;
            runs.insert(run_id.clone(), ManagedRun {
                run_id: run_id.clone(),
                project_id,
                process: Some(child),
                cancel_tx: Some(cancel_tx),
            });
        }
        
        // Spawn process waiter
        let run_id_clone = run_id.clone();
        let active_runs = Arc::clone(&self.active_runs);
        let event_tx_clone = event_tx.clone();
        
        tokio::spawn(async move {
            let exit_status;
            
            // Wait for process to complete
            {
                let mut runs = active_runs.write().await;
                if let Some(managed) = runs.get_mut(&run_id_clone) {
                    if let Some(ref mut process) = managed.process {
                        exit_status = process.wait().await.ok();
                    } else {
                        exit_status = None;
                    }
                } else {
                    return;
                }
            }
            
            // Send completion event
            let (state, error) = match exit_status {
                Some(status) if status.success() => ("SUCCEEDED".to_string(), None),
                Some(status) => ("FAILED".to_string(), Some(format!("Exit code: {:?}", status.code()))),
                None => ("FAILED".to_string(), Some("Process terminated unexpectedly".to_string())),
            };
            
            let event = RunnerEvent::Status {
                state,
                error,
                ts: Utc::now().to_rfc3339(),
            };
            let _ = event_tx_clone.send((run_id_clone.clone(), event)).await;
            
            // Remove from active runs
            let mut runs = active_runs.write().await;
            runs.remove(&run_id_clone);
        });
        
        Ok(())
    }
    
    /// Cancel a running training
    pub async fn cancel_run(&self, run_id: &str) -> Result<(), RunnerError> {
        let mut runs = self.active_runs.write().await;
        
        if let Some(managed) = runs.get_mut(run_id) {
            // Signal cancellation
            if let Some(tx) = managed.cancel_tx.take() {
                let _ = tx.send(());
            }
            
            // Kill process
            if let Some(ref mut process) = managed.process {
                let _ = process.kill().await;
            }
            
            runs.remove(run_id);
            Ok(())
        } else {
            Err(RunnerError::NotFound(run_id.to_string()))
        }
    }
    
    /// Get list of active runs
    pub async fn active_runs(&self) -> Vec<String> {
        let runs = self.active_runs.read().await;
        runs.keys().cloned().collect()
    }
    
    /// Check if a run is active
    pub async fn is_running(&self, run_id: &str) -> bool {
        let runs = self.active_runs.read().await;
        runs.contains_key(run_id)
    }
}

#[derive(Debug)]
pub enum RunnerError {
    SpawnFailed(String),
    AlreadyRunning(String),
    NotFound(String),
    IoError(std::io::Error),
}

impl std::fmt::Display for RunnerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunnerError::SpawnFailed(e) => write!(f, "Failed to spawn process: {}", e),
            RunnerError::AlreadyRunning(id) => write!(f, "Run {} is already running", id),
            RunnerError::NotFound(id) => write!(f, "Run {} not found", id),
            RunnerError::IoError(e) => write!(f, "IO error: {}", e),
        }
    }
}

impl std::error::Error for RunnerError {}




