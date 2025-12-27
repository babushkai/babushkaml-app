// BabushkaML - Main Library
// Tauri commands for workspace, projects, datasets, runs, models, and exports

mod db;
mod workspace;
mod runner;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{State, AppHandle, Emitter, Listener};
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db::*;
use crate::workspace::*;
use crate::runner::*;

// ============= App State =============

pub struct AppState {
    workspace: Mutex<Option<Workspace>>,
    db: Mutex<Option<rusqlite::Connection>>,
    #[allow(dead_code)]
    runner_tx: Mutex<Option<mpsc::Sender<(String, RunnerEvent)>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            workspace: Mutex::new(None),
            db: Mutex::new(None),
            runner_tx: Mutex::new(None),
        }
    }
}

// ============= Error Types =============

#[derive(Debug, Serialize)]
pub struct CommandError {
    message: String,
}

impl From<rusqlite::Error> for CommandError {
    fn from(e: rusqlite::Error) -> Self {
        CommandError { message: e.to_string() }
    }
}

impl From<WorkspaceError> for CommandError {
    fn from(e: WorkspaceError) -> Self {
        CommandError { message: e.to_string() }
    }
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError { message: e.to_string() }
    }
}

impl From<RunnerError> for CommandError {
    fn from(e: RunnerError) -> Self {
        CommandError { message: e.to_string() }
    }
}

impl From<tauri::Error> for CommandError {
    fn from(e: tauri::Error) -> Self {
        CommandError { message: e.to_string() }
    }
}

type CommandResult<T> = std::result::Result<T, CommandError>;

// ============= Workspace Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub initialized: bool,
}

/// Open or initialize a workspace
#[tauri::command]
async fn open_workspace(state: State<'_, AppState>, path: String) -> CommandResult<WorkspaceInfo> {
    let path = PathBuf::from(&path);
    
    // Initialize or open workspace
    let ws = if path.join("db").exists() {
        Workspace::open(&path)?
    } else {
        Workspace::init(&path)?
    };
    
    // Initialize database
    let conn = init_database(&ws.sqlite_path())?;
    
    // Store in state
    {
        let mut ws_guard = state.workspace.lock().unwrap();
        *ws_guard = Some(ws.clone());
    }
    {
        let mut db_guard = state.db.lock().unwrap();
        *db_guard = Some(conn);
    }
    
    Ok(WorkspaceInfo {
        path: path.display().to_string(),
        initialized: true,
    })
}

/// Get current workspace info
#[tauri::command]
async fn get_workspace(state: State<'_, AppState>) -> CommandResult<Option<WorkspaceInfo>> {
    let ws_guard = state.workspace.lock().unwrap();
    Ok(ws_guard.as_ref().map(|ws| WorkspaceInfo {
        path: ws.root.display().to_string(),
        initialized: true,
    }))
}

// ============= Project Commands =============

#[tauri::command]
async fn create_project(state: State<'_, AppState>, name: String, description: Option<String>) -> CommandResult<Project> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let ws_guard = state.workspace.lock().unwrap();
    let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    // Create project in DB
    let project = Project::create(conn, &name, "", description.as_deref())?;
    
    // Initialize project directory
    ws.init_project(&project.id)?;
    
    // Update root_path
    let root_path = ws.project_path(&project.id).display().to_string();
    conn.execute("UPDATE projects SET root_path = ?1 WHERE id = ?2", rusqlite::params![root_path, project.id])?;
    
    Ok(Project {
        root_path,
        ..project
    })
}

#[tauri::command]
async fn list_projects(state: State<'_, AppState>) -> CommandResult<Vec<Project>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let projects = Project::list(conn)?;
    Ok(projects)
}

#[tauri::command]
async fn get_project(state: State<'_, AppState>, id: String) -> CommandResult<Option<Project>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let project = Project::get(conn, &id)?;
    Ok(project)
}

#[tauri::command]
async fn delete_project(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    Project::delete(conn, &id)?;
    
    // Optionally: delete project directory
    // (could be dangerous, maybe just mark as deleted?)
    
    Ok(())
}

// ============= Dataset Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportDatasetRequest {
    pub project_id: String,
    pub name: String,
    pub source_path: String,
    pub copy: bool,
}

#[tauri::command]
async fn import_dataset_cmd(state: State<'_, AppState>, request: ImportDatasetRequest) -> CommandResult<Dataset> {
    let ws_guard = state.workspace.lock().unwrap();
    let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let dataset_id = uuid::Uuid::new_v4().to_string();
    let source_path = PathBuf::from(&request.source_path);
    
    // Import dataset and compute fingerprint
    let manifest = import_dataset(ws, &request.project_id, &dataset_id, &request.name, &source_path, request.copy)?;
    
    // Store in database
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let now = chrono::Utc::now().to_rfc3339();
    let manifest_path = ws.dataset_path(&request.project_id, &dataset_id).join("manifest.json").display().to_string();
    let storage_mode = if request.copy { "copy" } else { "reference" };
    
    conn.execute(
        "INSERT INTO datasets (id, project_id, name, fingerprint, storage_mode, manifest_path, size_bytes, file_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            dataset_id,
            request.project_id,
            request.name,
            manifest.fingerprint.fingerprint,
            storage_mode,
            manifest_path,
            manifest.fingerprint.total_size as i64,
            manifest.fingerprint.file_count as i32,
            now
        ],
    )?;
    
    Ok(Dataset {
        id: dataset_id,
        project_id: request.project_id,
        name: request.name,
        fingerprint: manifest.fingerprint.fingerprint,
        storage_mode: storage_mode.to_string(),
        manifest_path,
        size_bytes: Some(manifest.fingerprint.total_size as i64),
        file_count: Some(manifest.fingerprint.file_count as i32),
        created_at: now,
    })
}

#[tauri::command]
async fn list_datasets(state: State<'_, AppState>, project_id: String) -> CommandResult<Vec<Dataset>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, fingerprint, storage_mode, manifest_path, size_bytes, file_count, created_at FROM datasets WHERE project_id = ?1 ORDER BY created_at DESC"
    )?;
    
    let datasets = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Dataset {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            fingerprint: row.get(3)?,
            storage_mode: row.get(4)?,
            manifest_path: row.get(5)?,
            size_bytes: row.get(6)?,
            file_count: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?.collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(datasets)
}

// ============= Run Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct StartRunRequest {
    pub project_id: String,
    pub dataset_id: Option<String>,
    pub name: Option<String>,
    pub config: serde_json::Value,
    pub entrypoint: Option<String>,
}

#[tauri::command]
async fn start_run(app: AppHandle, state: State<'_, AppState>, request: StartRunRequest) -> CommandResult<Run> {
    let (run_dir, config_path, run);
    
    // Scope the locks
    {
        let ws_guard = state.workspace.lock().unwrap();
        let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
        
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
        
        // Create run in database
        run = Run::create(
            conn,
            &request.project_id,
            request.dataset_id.as_deref(),
            request.name.as_deref(),
            None,
            request.entrypoint.as_deref(),
        )?;
        
        // Initialize run directory
        run_dir = ws.init_run(&request.project_id, &run.id)?;
        
        // Write config file
        config_path = run_dir.join("config.json");
        let config_json = serde_json::to_string_pretty(&request.config)
            .map_err(|e| CommandError { message: e.to_string() })?;
        std::fs::write(&config_path, &config_json)?;
        
        // Update run with config path
        conn.execute(
            "UPDATE runs SET config_path = ?1, status = 'running', started_at = ?3 WHERE id = ?2",
            rusqlite::params![config_path.display().to_string(), run.id, chrono::Utc::now().to_rfc3339()],
        )?;
    }
    
    // Emit start event
    app.emit("run-started", json!({ "run_id": run.id, "project_id": request.project_id }))?;
    
    // Check if Docker method is requested
    let use_docker = request.config.get("method")
        .and_then(|v| v.as_str())
        .map(|s| s == "docker")
        .unwrap_or(false);
    
    let docker_image = if use_docker {
        request.config.get("docker_image")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    };
    
    // Get workspace path for later use in Docker training
    let workspace_root = {
        let ws_guard = state.workspace.lock().unwrap();
        ws_guard.as_ref().map(|ws| ws.root.clone())
    };
    
    // Get dataset path if dataset_id is provided
    let dataset_path = if let Some(dataset_id) = &request.dataset_id {
        let ws_guard = state.workspace.lock().unwrap();
        let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
        
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
        
        // Get dataset manifest path
        let manifest_path: Option<String> = conn.query_row(
            "SELECT manifest_path FROM datasets WHERE id = ?1",
            rusqlite::params![dataset_id],
            |row| row.get(0),
        ).ok();
        
        if let Some(manifest_path_str) = manifest_path {
            let manifest_path = PathBuf::from(&manifest_path_str);
            // Check if it's a reference or copy
            let storage_mode: Option<String> = conn.query_row(
                "SELECT storage_mode FROM datasets WHERE id = ?1",
                rusqlite::params![dataset_id],
                |row| row.get(0),
            ).ok();
            
            if storage_mode.as_deref() == Some("copy") {
                // For copy mode, dataset is in workspace/datasets/{dataset_id}/raw
                Some(ws.dataset_path(&request.project_id, dataset_id).join("raw"))
            } else {
                // For reference mode, get source path from manifest
                if let Ok(manifest_json) = std::fs::read_to_string(&manifest_path) {
                    if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&manifest_json) {
                        if let Some(source_path) = manifest.get("source_path").and_then(|v| v.as_str()) {
                            Some(PathBuf::from(source_path))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    // Spawn async task to run training
    let app_handle = app.clone();
    let run_id = run.id.clone();
    let project_id = request.project_id.clone();
    let config_path_clone = config_path.clone();
    let run_dir_clone = run_dir.clone();
    let dataset_path_clone = dataset_path.clone();
    
    // Clone workspace root for use in spawned task
    let workspace_root_clone = workspace_root.clone();
    
    // Emit initial log immediately
    eprintln!("[DEBUG] start_run: Creating run {} with method: {}", run.id, if use_docker { "docker" } else { "local" });
    app.emit("run-log", json!({
        "run_id": run.id,
        "level": "INFO",
        "message": format!("Starting training run: {} (method: {})", run.id, if use_docker { "docker" } else { "local" }),
        "ts": chrono::Utc::now().to_rfc3339()
    })).ok();
    
    eprintln!("[DEBUG] start_run: About to spawn async task for run: {}", run.id);
    eprintln!("[DEBUG] start_run: docker_image = {:?}, use_docker = {}", docker_image, use_docker);
    
    tokio::spawn(async move {
        eprintln!("[DEBUG] Async task started for run: {}", run_id);
        
        // Small delay to ensure frontend listeners are set up
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        // Emit log that task is starting
        eprintln!("[DEBUG] Emitting task spawned log");
        app_handle.emit("run-log", json!({
            "run_id": run_id,
            "level": "INFO",
            "message": format!("[DEBUG] Training task spawned (method: {})", if use_docker { "docker" } else { "local" }),
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
        
        eprintln!("[DEBUG] Async task: use_docker = {}, docker_image = {:?}", use_docker, docker_image);
        
        if use_docker {
            if let Some(image) = docker_image {
                let run_id_clone = run_id.clone();
                let app_handle_clone = app_handle.clone();
                let workspace_root_for_docker = workspace_root_clone.clone();
                
                eprintln!("[DEBUG] Spawning Docker training task for run: {}", run_id);
                app_handle.emit("run-log", json!({
                    "run_id": run_id,
                    "level": "INFO",
                    "message": format!("[DEBUG] About to call execute_docker_training with image: {}", image),
                    "ts": chrono::Utc::now().to_rfc3339()
                })).ok();
                
                eprintln!("[DEBUG] Calling execute_docker_training now...");
                
                execute_docker_training(
                    app_handle_clone,
                    workspace_root_for_docker,
                    run_id_clone.clone(),
                    project_id.clone(),
                    config_path_clone,
                    run_dir_clone,
                    image,
                    dataset_path_clone,
                ).await;
                
                app_handle.emit("run-log", json!({
                    "run_id": run_id_clone,
                    "level": "DEBUG",
                    "message": "[DEBUG] execute_docker_training completed",
                    "ts": chrono::Utc::now().to_rfc3339()
                })).ok();
            } else {
                eprintln!("[ERROR] Docker image not specified");
                app_handle.emit("run-error", json!({
                    "run_id": run_id,
                    "error": "Docker image not specified"
                })).ok();
            }
        } else {
            eprintln!("[DEBUG] Spawning Python training task for run: {}", run_id);
            execute_python_training(
                app_handle,
                run_id,
                project_id,
                config_path_clone,
                run_dir_clone,
                dataset_path_clone,
            ).await;
        }
    });
    
    Ok(Run {
        config_path: Some(config_path.display().to_string()),
        status: "running".to_string(),
        started_at: Some(chrono::Utc::now().to_rfc3339()),
        ..run
    })
}

/// Execute Docker-based training
async fn execute_docker_training(
    app: AppHandle,
    workspace_root: Option<PathBuf>,
    run_id: String,
    project_id: String,
    config_path: PathBuf,
    run_dir: PathBuf,
    docker_image: String,
    dataset_path: Option<PathBuf>,
) {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;
    use std::process::Stdio;
    
    eprintln!("[DEBUG] execute_docker_training called with image: {}", docker_image);
    
    // Emit initial log immediately - this should appear right away
    let log_result = app.emit("run-log", json!({
        "run_id": run_id,
        "level": "INFO",
        "message": format!("Starting training with Docker image: {}", docker_image),
        "ts": chrono::Utc::now().to_rfc3339()
    }));
    eprintln!("[DEBUG] Emitted initial log, result: {:?}", log_result);
    
    // Also emit a debug log to ensure events are working
    app.emit("run-log", json!({
        "run_id": run_id,
        "level": "DEBUG",
        "message": format!("[DEBUG] Docker training function called for run {}", run_id),
        "ts": chrono::Utc::now().to_rfc3339()
    })).ok();
    
    // Find Docker executable path
    let docker_path = find_docker_executable();
    eprintln!("[DEBUG] Docker path: {:?}", docker_path);
    
    let docker_cmd = match docker_path {
        Some(ref path) => path.as_str(),
        None => {
            let error_msg = "Docker not found. Please install Docker Desktop and ensure it's accessible at /usr/local/bin/docker, /opt/homebrew/bin/docker, or /Applications/Docker.app/Contents/Resources/bin/docker".to_string();
            eprintln!("[ERROR] {}", error_msg);
            app.emit("run-error", json!({
                "run_id": run_id,
                "error": error_msg.clone()
            })).ok();
            
            app.emit("run-status", json!({
                "run_id": run_id,
                "status": "failed",
                "error": error_msg
            })).ok();
            return;
        }
    };
    
    // Check if Docker is available
    let docker_check = Command::new(docker_cmd)
        .arg("--version")
        .output()
        .await;
    
    if docker_check.is_err() {
        let error_msg = format!("Docker is not installed or not available. Error: {:?}", docker_check.err());
        eprintln!("[ERROR] {}", error_msg);
        app.emit("run-error", json!({
            "run_id": run_id,
            "error": error_msg.clone()
        })).ok();
        
        app.emit("run-status", json!({
            "run_id": run_id,
            "status": "failed",
            "error": error_msg
        })).ok();
        return;
    }
    
    // Check if Docker daemon is running
    let docker_info = Command::new(docker_cmd)
        .arg("info")
        .output()
        .await;
    
    if docker_info.is_err() || !docker_info.unwrap().status.success() {
        let error_msg = "Docker daemon is not running. Please start Docker Desktop.".to_string();
        eprintln!("[ERROR] {}", error_msg);
        app.emit("run-error", json!({
            "run_id": run_id,
            "error": error_msg.clone()
        })).ok();
        
        app.emit("run-status", json!({
            "run_id": run_id,
            "status": "failed",
            "error": error_msg
        })).ok();
        return;
    }
    
    eprintln!("[DEBUG] Docker is available and daemon is running");
    
    // Verify Docker image exists locally using docker image inspect (more reliable)
    eprintln!("[DEBUG] Checking if image {} exists locally...", docker_image);
    let check_cmd = Command::new(docker_cmd)
        .arg("image")
        .arg("inspect")
        .arg(&docker_image)
        .output()
        .await;
    
    let mut image_exists = check_cmd
        .map(|output| {
            let exists = output.status.success();
            if !exists {
                let stderr = String::from_utf8_lossy(&output.stderr);
                eprintln!("[DEBUG] docker image inspect failed: {}", stderr);
            }
            exists
        })
        .unwrap_or(false);
    
    if !image_exists {
        // Also try listing all images and checking if the image is in the list
        eprintln!("[DEBUG] Image not found via inspect, checking image list...");
        let list_cmd = Command::new(docker_cmd)
            .arg("images")
            .arg("--format")
            .arg("{{.Repository}}:{{.Tag}}")
            .output()
            .await;
        
        if let Ok(output) = list_cmd {
            let stdout = String::from_utf8_lossy(&output.stdout);
            eprintln!("[DEBUG] Available images: {}", stdout);
            image_exists = stdout.lines().any(|line| line.trim() == docker_image);
            eprintln!("[DEBUG] Image exists in list: {}", image_exists);
        }
    } else {
        eprintln!("[DEBUG] Image {} found locally via inspect", docker_image);
    }
    
    if image_exists {
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "INFO",
            "message": format!("Docker image {} found locally", docker_image),
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
    } else {
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "WARNING",
            "message": format!("Docker image {} not found locally. Attempting to pull...", docker_image),
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
        
        // Try to pull the image with streaming output
        eprintln!("[DEBUG] Starting docker pull for: {}", docker_image);
        eprintln!("[DEBUG] Using Docker command: {}", docker_cmd);
        
        let mut pull_cmd = Command::new(docker_cmd);
        
        // Set up PATH to include Docker credential helper paths
        let docker_bin_paths = vec![
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/Applications/Docker.app/Contents/Resources/bin",
        ];
        
        let current_path = std::env::var("PATH").unwrap_or_default();
        let mut new_path = docker_bin_paths.join(":");
        if !current_path.is_empty() {
            new_path = format!("{}:{}", new_path, current_path);
        }
        
        eprintln!("[DEBUG] Setting PATH for Docker pull: {}", new_path);
        pull_cmd.env("PATH", &new_path);
        
        pull_cmd.arg("pull")
            .arg(&docker_image)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        eprintln!("[DEBUG] Spawning docker pull process...");
        let mut pull_child = match pull_cmd.spawn() {
            Ok(child) => child,
            Err(e) => {
                app.emit("run-error", json!({
                    "run_id": run_id,
                    "error": format!("Failed to spawn docker pull: {}", e)
                })).ok();
                
                app.emit("run-status", json!({
                    "run_id": run_id,
                    "status": "failed",
                    "error": format!("Failed to spawn docker pull: {}", e)
                })).ok();
                return;
            }
        };
        
        // Use Arc<Mutex> to collect stderr lines for error reporting
        // We'll stream it AND collect it for error messages
        let app_clone = app.clone();
        let run_id_clone = run_id.clone();
        let docker_image_clone = docker_image.clone();
        
        // Shared vector to collect error lines
        let error_lines = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
        let error_lines_clone = error_lines.clone();
        
        if let Some(stderr) = pull_child.stderr.take() {
            eprintln!("[DEBUG] Starting stderr stream reader for docker pull");
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[DEBUG] Docker pull progress: {}", line);
                    
                    // Collect error lines
                    if let Ok(mut vec) = error_lines_clone.lock() {
                        vec.push(line.clone());
                    }
                    
                    // Emit progress updates as logs
                    app_clone.emit("run-log", json!({
                        "run_id": run_id_clone,
                        "level": "INFO",
                        "message": format!("Docker pull: {}", line),
                        "ts": chrono::Utc::now().to_rfc3339()
                    })).ok();
                }
                eprintln!("[DEBUG] Docker pull stderr stream ended");
            });
        } else {
            eprintln!("[WARNING] Docker pull stderr is None, cannot stream progress");
        }
        
        // Wait for the pull to complete with a timeout
        let pull_result = tokio::time::timeout(
            std::time::Duration::from_secs(600), // 10 minute timeout
            pull_child.wait_with_output()
        ).await;
        
        match pull_result {
            Ok(Ok(output)) => {
                eprintln!("[DEBUG] Docker pull completed with status: {:?}", output.status);
                eprintln!("[DEBUG] Docker pull stdout: {}", String::from_utf8_lossy(&output.stdout));
                eprintln!("[DEBUG] Docker pull stderr (from wait_with_output): {}", String::from_utf8_lossy(&output.stderr));
                
                if !output.status.success() {
                    // Collect error messages from the shared vector
                    let collected_errors = error_lines.lock()
                        .map(|vec| vec.join("\n"))
                        .unwrap_or_default();
                    
                    let stderr_msg = String::from_utf8_lossy(&output.stderr);
                    let stdout_msg = String::from_utf8_lossy(&output.stdout);
                    
                    // Try to extract meaningful error message - prefer collected errors (from streaming)
                    let mut error_msg = if !collected_errors.trim().is_empty() {
                        collected_errors
                    } else if !stderr_msg.trim().is_empty() {
                        stderr_msg.to_string()
                    } else if !stdout_msg.trim().is_empty() {
                        stdout_msg.to_string()
                    } else {
                        format!("Docker pull failed with exit code: {:?}. Try running 'docker pull {}' manually to see the error.", output.status.code(), docker_image)
                    };
                    
                    // Add helpful suggestions for common errors
                    if error_msg.contains("manifest unknown") || error_msg.contains("manifest for") {
                        let image_name = docker_image.split(':').next().unwrap_or(&docker_image);
                        // Format Docker Hub URL correctly (already has /r/ in path)
                        let docker_hub_url = if image_name.contains('/') {
                            format!("https://hub.docker.com/r/{}", image_name)
                        } else {
                            format!("https://hub.docker.com/_/{}", image_name)
                        };
                        error_msg = format!("{}\n\n💡 Tip: The image or tag may not exist. Try:\n  - Check available tags: Visit {}\n  - Use a specific tag instead of 'latest' (e.g., {}:3 or {}:3.5)\n  - Verify the image name is correct", 
                            error_msg, docker_hub_url, image_name, image_name);
                    } else if error_msg.contains("pull access denied") || error_msg.contains("repository does not exist") || error_msg.contains("requested access to the resource is denied") {
                        let image_name = docker_image.split(':').next().unwrap_or(&docker_image);
                        let docker_hub_url = if image_name.contains('/') {
                            format!("https://hub.docker.com/r/{}", image_name)
                        } else {
                            format!("https://hub.docker.com/_/{}", image_name)
                        };
                        // Special handling for common non-existent images
                        let suggestion = if image_name.contains("xgboost") {
                            format!("💡 Tip: XGBoost doesn't have an official Docker image. Instead:\n  - Use 'python:3.11' and install XGBoost: pip install xgboost\n  - Or use 'jupyter/scipy-notebook' which includes many ML libraries")
                        } else {
                            format!("💡 Tip: This image may not exist or requires authentication. Try:\n  - Verify the image exists: Visit {}\n  - Check if it's a private image requiring 'docker login'\n  - Try alternative images from the Docker Image Selector", docker_hub_url)
                        };
                        
                        error_msg = format!("{}\n\n{}", error_msg, suggestion);
                    }
                    
                    eprintln!("[ERROR] Docker pull failed: {}", error_msg);
                    
                    app.emit("run-log", json!({
                        "run_id": run_id,
                        "level": "ERROR",
                        "message": format!("Docker pull failed: {}", error_msg),
                        "ts": chrono::Utc::now().to_rfc3339()
                    })).ok();
                    
                    app.emit("run-error", json!({
                        "run_id": run_id,
                        "error": format!("Docker pull failed: {}", error_msg)
                    })).ok();
                    
                    app.emit("run-status", json!({
                        "run_id": run_id,
                        "status": "failed",
                        "error": format!("Docker image {} pull failed: {}", docker_image, error_msg)
                    })).ok();
                    return;
                }
                
                // Verify the image was actually pulled
                let verify_cmd = Command::new(docker_cmd)
                    .arg("image")
                    .arg("inspect")
                    .arg(&docker_image)
                    .output()
                    .await;
                
                let verified = verify_cmd
                    .map(|output| output.status.success())
                    .unwrap_or(false);
                
                if !verified {
                    app.emit("run-error", json!({
                        "run_id": run_id,
                        "error": format!("Docker pull completed but image {} not found. Pull may have failed silently.", docker_image)
                    })).ok();
                    
                    app.emit("run-status", json!({
                        "run_id": run_id,
                        "status": "failed",
                        "error": format!("Docker image {} not found after pull", docker_image)
                    })).ok();
                    return;
                }
                
                app.emit("run-log", json!({
                    "run_id": run_id,
                    "level": "INFO",
                    "message": format!("Successfully pulled and verified Docker image: {}", docker_image),
                    "ts": chrono::Utc::now().to_rfc3339()
                })).ok();
            }
            Ok(Err(e)) => {
                app.emit("run-error", json!({
                    "run_id": run_id,
                    "error": format!("Docker pull execution failed: {}", e)
                })).ok();
                
                app.emit("run-status", json!({
                    "run_id": run_id,
                    "status": "failed",
                    "error": format!("Docker pull execution failed: {}", e)
                })).ok();
                return;
            }
            Err(_) => {
                app.emit("run-error", json!({
                    "run_id": run_id,
                    "error": format!("Docker pull timed out after 10 minutes. The image may be very large or the network is slow. Please pull the image manually: docker pull {}", docker_image)
                })).ok();
                
                app.emit("run-status", json!({
                    "run_id": run_id,
                    "status": "failed",
                    "error": format!("Docker pull timed out for {}", docker_image)
                })).ok();
                return;
            }
        }
    }
    
    // Get the runner script path
    let runner_script = get_runner_script_path();
    
    // Verify runner script exists
    if !runner_script.exists() {
        let error_msg = format!("Runner script not found at: {}. Make sure the app is built correctly.", runner_script.display());
        eprintln!("[ERROR] {}", error_msg);
        app.emit("run-error", json!({
            "run_id": run_id,
            "error": error_msg.clone()
        })).ok();
        
        app.emit("run-status", json!({
            "run_id": run_id,
            "status": "failed",
            "error": error_msg
        })).ok();
        return;
    }
    
    // Convert to absolute paths for Docker mounts
    // Ensure run_dir exists before canonicalizing
    std::fs::create_dir_all(&run_dir).ok();
    
    let runner_script_abs = runner_script.canonicalize().unwrap_or_else(|_| runner_script.clone());
    let config_path_abs = config_path.canonicalize().unwrap_or_else(|_| config_path.clone());
    let run_dir_abs = run_dir.canonicalize().unwrap_or_else(|_| run_dir.clone());
    
    eprintln!("[DEBUG] Runner script: {}", runner_script_abs.display());
    eprintln!("[DEBUG] Config path: {}", config_path_abs.display());
    eprintln!("[DEBUG] Run dir: {}", run_dir_abs.display());
    
    // Mount paths: config, output dir, and runner script
    let config_mount = format!("{}:/app/config.json:ro", config_path_abs.display());
    let output_mount = format!("{}:/app/output", run_dir_abs.display());
    let script_mount = format!("{}:/app/runner.py:ro", runner_script_abs.display());
    
    // Build Docker command with improvements
    let container_name = format!("babushkaml-train-{}", run_id.replace("-", "").chars().take(12).collect::<String>());
    
    eprintln!("[DEBUG] Building Docker run command for container: {}", container_name);
    eprintln!("[DEBUG] Config mount: {}", config_mount);
    eprintln!("[DEBUG] Output mount: {}", output_mount);
    eprintln!("[DEBUG] Script mount: {}", script_mount);
    
    let mut cmd = Command::new(docker_cmd);
    
    // Set up PATH to include Docker credential helper paths
    let docker_bin_paths = vec![
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/Applications/Docker.app/Contents/Resources/bin",
    ];
    
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut new_path = docker_bin_paths.join(":");
    if !current_path.is_empty() {
        new_path = format!("{}:{}", new_path, current_path);
    }
    
    eprintln!("[DEBUG] Setting PATH for Docker run: {}", new_path);
    cmd.env("PATH", &new_path);
    
    cmd.arg("run")
        .arg("--rm")
        .arg("--name").arg(&container_name)
        // Resource limits (adjustable via config in future)
        .arg("--memory").arg("4g")  // 4GB memory limit
        .arg("--cpus").arg("2.0")   // 2 CPU cores
        // Note: Removed --user flag as it can cause permission issues
        // Many Docker images don't have user 1000 configured properly
        // Network: disable network access for security (can be enabled via config)
        // .arg("--network").arg("none")  // Commented out - may need network for downloads
        // Timeout: set a maximum runtime (24 hours)
        .arg("--stop-timeout").arg("30")  // 30 seconds grace period on stop
        // Mounts
        .arg("-v").arg(&config_mount)
        .arg("-v").arg(&output_mount)
        .arg("-v").arg(&script_mount)
        .arg("--workdir").arg("/app");
    
    // Mount dataset if provided
    if let Some(ref ds_path) = dataset_path {
        if ds_path.exists() {
            let ds_path_abs = ds_path.canonicalize().unwrap_or_else(|_| ds_path.clone());
            let dataset_mount = format!("{}:/app/dataset:ro", ds_path_abs.display());
            cmd.arg("-v").arg(&dataset_mount);
            eprintln!("[DEBUG] Dataset mount: {}", dataset_mount);
            app.emit("run-log", json!({
                "run_id": run_id,
                "level": "INFO",
                "message": format!("Mounting dataset from: {}", ds_path_abs.display()),
                "ts": chrono::Utc::now().to_rfc3339()
            })).ok();
        } else {
            eprintln!("[WARNING] Dataset path does not exist: {}", ds_path.display());
        }
    }
    
    // Add GPU support if available (NVIDIA Docker)
    // Check if nvidia-docker is available
    let nvidia_check = Command::new("which")
        .arg("nvidia-docker")
        .output()
        .await;
    
    if nvidia_check.is_ok() && nvidia_check.unwrap().status.success() {
        cmd.arg("--gpus").arg("all");
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "INFO",
            "message": "GPU support enabled (NVIDIA Docker detected)",
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
    }
    
    // Check for requirements.txt in project directory and mount it
    let project_requirements = if let Some(ref ws_root) = workspace_root {
        ws_root.join("projects").join(&project_id).join("requirements.txt")
    } else {
        PathBuf::from("") // Will not exist, so won't be mounted
    };
    let mut install_packages = false;
    
    if project_requirements.exists() {
        let req_path_abs = project_requirements.canonicalize().unwrap_or_else(|_| project_requirements.clone());
        let req_mount = format!("{}:/app/requirements.txt:ro", req_path_abs.display());
        cmd.arg("-v").arg(&req_mount);
        install_packages = true;
        eprintln!("[DEBUG] Found requirements.txt, will install packages: {}", req_path_abs.display());
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "INFO",
            "message": format!("Found requirements.txt, will install packages before training"),
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
    } else {
        eprintln!("[DEBUG] No requirements.txt found in project directory");
    }
    
    // Check for custom scripts directory and mount it
    let scripts_dir = if let Some(ref ws_root) = workspace_root {
        ws_root.join("projects").join(&project_id).join("scripts")
    } else {
        PathBuf::from("") // Will not exist, so won't be mounted
    };
    if scripts_dir.exists() {
        let scripts_path_abs = scripts_dir.canonicalize().unwrap_or_else(|_| scripts_dir.clone());
        let scripts_mount = format!("{}:/app/scripts:ro", scripts_path_abs.display());
        cmd.arg("-v").arg(&scripts_mount);
        eprintln!("[DEBUG] Mounting custom scripts directory: {}", scripts_mount);
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "INFO",
            "message": format!("Mounting custom scripts from: {}", scripts_path_abs.display()),
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
    }
    
    // Container command - install packages first if requirements.txt exists, then run training
    cmd.arg(&docker_image);
    
    if install_packages {
        // Use bash/sh to chain commands: install packages then run training
        cmd.arg("sh")
            .arg("-c")
            .arg(format!(
                "pip install --quiet --no-cache-dir -r /app/requirements.txt && python3 /app/runner.py --run-id {} --config /app/config.json --output-dir /app/output{}",
                run_id,
                if dataset_path.is_some() { " --dataset /app/dataset" } else { "" }
            ));
        eprintln!("[DEBUG] Will install packages from requirements.txt before running training");
    } else {
        // No requirements.txt, just run training directly
        cmd.arg("python3")
        .arg("/app/runner.py")
        .arg("--run-id").arg(&run_id)
        .arg("--config").arg("/app/config.json")
            .arg("--output-dir").arg("/app/output");
        
        // Add dataset path if provided
        if let Some(ref ds_path) = dataset_path {
            if ds_path.exists() {
                cmd.arg("--dataset").arg("/app/dataset");
                eprintln!("[DEBUG] Adding dataset argument: /app/dataset");
            }
        }
    }
    
    // Log the full command for debugging
    eprintln!("[DEBUG] Full Docker command:");
    eprintln!("[DEBUG]   docker run --rm --name {} --memory 4g --cpus 2.0 --stop-timeout 30", container_name);
    eprintln!("[DEBUG]   -v {} -v {} -v {}", config_mount, output_mount, script_mount);
    if let Some(ref ds_path) = dataset_path {
        if ds_path.exists() {
            eprintln!("[DEBUG]   -v {}:/app/dataset:ro", ds_path.canonicalize().unwrap_or_else(|_| ds_path.clone()).display());
        }
    }
    eprintln!("[DEBUG]   --workdir /app");
    eprintln!("[DEBUG]   {} python3 /app/runner.py --run-id {} --config /app/config.json --output-dir /app/output", docker_image, run_id);
    
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    
    // Spawn process
    eprintln!("[DEBUG] Spawning Docker container...");
    app.emit("run-log", json!({
        "run_id": run_id,
        "level": "DEBUG",
        "message": "[DEBUG] About to spawn Docker container",
        "ts": chrono::Utc::now().to_rfc3339()
    })).ok();
    
    let mut child = match cmd.spawn() {
        Ok(c) => {
            eprintln!("[DEBUG] Docker container spawned successfully");
            app.emit("run-log", json!({
                "run_id": run_id,
                "level": "INFO",
                "message": "[DEBUG] Docker container spawned successfully",
                "ts": chrono::Utc::now().to_rfc3339()
            })).ok();
            c
        },
        Err(e) => {
            let error_msg = format!("Failed to spawn Docker container: {}. Make sure Docker Desktop is running and the image {} exists.", e, docker_image);
            eprintln!("[ERROR] {}", error_msg);
            app.emit("run-error", json!({
                "run_id": run_id,
                "error": error_msg.clone()
            })).ok();
            
            app.emit("run-status", json!({
                "run_id": run_id,
                "status": "failed",
                "error": error_msg
            })).ok();
            return;
        }
    };
    
    // Read stdout (JSONL events)
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let run_id_clone = run_id.clone();
        
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "DEBUG",
            "message": "[DEBUG] Starting to read Docker container stdout",
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
        
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            
            let mut line_count = 0;
            while let Ok(Some(line)) = lines.next_line().await {
                line_count += 1;
                eprintln!("[DEBUG] Docker stdout line {}: {}", line_count, line);
                // Try to parse as JSON event
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(event_type) = event.get("type").and_then(|v| v.as_str()) {
                        match event_type {
                            "log" => {
                                app_clone.emit("run-log", json!({
                                    "run_id": run_id_clone,
                                    "level": event.get("level").and_then(|v| v.as_str()).unwrap_or("INFO"),
                                    "message": event.get("message").and_then(|v| v.as_str()).unwrap_or(""),
                                    "ts": chrono::Utc::now().to_rfc3339()
                                })).ok();
                            }
                            "metric" => {
                                app_clone.emit("run-metric", json!({
                                    "run_id": run_id_clone,
                                    "name": event.get("name"),
                                    "value": event.get("value"),
                                    "step": event.get("step"),
                                    "ts": chrono::Utc::now().to_rfc3339()
                                })).ok();
                            }
                            "progress" => {
                                app_clone.emit("run-progress", json!({
                                    "run_id": run_id_clone,
                                    "current": event.get("current"),
                                    "total": event.get("total"),
                                    "ts": chrono::Utc::now().to_rfc3339()
                                })).ok();
                            }
                            "status" => {
                                app_clone.emit("run-status", json!({
                                    "run_id": run_id_clone,
                                    "status": event.get("state"),
                                    "error": event.get("error"),
                                    "ts": chrono::Utc::now().to_rfc3339()
                                })).ok();
                            }
                            _ => {}
                        }
                    }
                } else {
                    // Not JSON, emit as plain log
                    app_clone.emit("run-log", json!({
                        "run_id": run_id_clone,
                        "level": "INFO",
                        "message": line,
                        "ts": chrono::Utc::now().to_rfc3339()
                    })).ok();
                }
            }
            eprintln!("[DEBUG] Docker stdout stream ended after {} lines", line_count);
            app_clone.emit("run-log", json!({
                "run_id": run_id_clone,
                "level": "DEBUG",
                "message": format!("[DEBUG] Docker stdout stream ended ({} lines read)", line_count),
                "ts": chrono::Utc::now().to_rfc3339()
            })).ok();
        });
    } else {
        eprintln!("[WARNING] Docker container stdout is None!");
        app.emit("run-log", json!({
            "run_id": run_id,
            "level": "WARNING",
            "message": "[WARNING] Docker container stdout is None - cannot read logs",
            "ts": chrono::Utc::now().to_rfc3339()
        })).ok();
    }
    
    // Read stderr (errors and non-JSON output)
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let run_id_clone = run_id.clone();
        
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[DEBUG] Docker stderr: {}", line);
                // Emit stderr as error-level log
                app_clone.emit("run-log", json!({
                    "run_id": run_id_clone,
                    "level": "ERROR",
                    "message": format!("Docker: {}", line),
                    "ts": chrono::Utc::now().to_rfc3339()
                })).ok();
            }
            eprintln!("[DEBUG] Docker stderr stream ended");
        });
    }
    
    // Wait for process to complete
    eprintln!("[DEBUG] Waiting for Docker container to complete...");
    let exit_status = child.wait().await;
    
    let (final_status, error_msg) = match exit_status {
        Ok(status) => {
            let code = status.code();
            eprintln!("[DEBUG] Container exited with code: {:?}", code);
            if status.success() {
                ("succeeded", None)
            } else {
                let msg = format!("Container exited with code: {:?}. Check the logs above for details.", code);
                eprintln!("[ERROR] {}", msg);
                ("failed", Some(msg))
            }
        },
        Err(e) => {
            let msg = format!("Failed to wait for container: {}", e);
            eprintln!("[ERROR] {}", msg);
            ("failed", Some(msg))
        },
    };
    
    eprintln!("[DEBUG] Training completed with status: {}", final_status);
    
    // Emit final status
    app.emit("run-status", json!({
        "run_id": run_id,
        "status": final_status,
        "error": error_msg
    })).ok();
    
    app.emit("run-completed", json!({
        "run_id": run_id,
        "project_id": project_id,
        "status": final_status,
        "error": error_msg
    })).ok();
}

/// Execute Python training script and stream events
async fn execute_python_training(
    app: AppHandle,
    run_id: String,
    project_id: String,
    config_path: PathBuf,
    run_dir: PathBuf,
    dataset_path: Option<PathBuf>,
) {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;
    use std::process::Stdio;
    
    // Find Python executable
    let python = find_python().unwrap_or_else(|| "python3".to_string());
    
    // Get the runner script path (bundled with app or in src-tauri/python)
    let runner_script = get_runner_script_path();
    
    app.emit("run-log", json!({
        "run_id": run_id,
        "level": "INFO",
        "message": format!("Starting training with Python: {}", python),
        "ts": chrono::Utc::now().to_rfc3339()
    })).ok();
    
    // Build command
    let mut cmd = Command::new(&python);
    cmd.arg(&runner_script)
        .arg("--run-id").arg(&run_id)
        .arg("--config").arg(&config_path)
        .arg("--output-dir").arg(&run_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    
    // Spawn process
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            app.emit("run-error", json!({
                "run_id": run_id,
                "error": format!("Failed to spawn Python: {}", e)
            })).ok();
            
            app.emit("run-status", json!({
                "run_id": run_id,
                "status": "failed",
                "error": format!("Failed to spawn Python: {}", e)
            })).ok();
            return;
        }
    };
    
    // Read stdout (JSONL events)
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let run_id_clone = run_id.clone();
        
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                // Try to parse as JSON event
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("log");
                    
                    match event_type {
                        "log" => {
                            app_clone.emit("run-log", json!({
                                "run_id": run_id_clone,
                                "level": event.get("level").and_then(|l| l.as_str()).unwrap_or("INFO"),
                                "message": event.get("message").and_then(|m| m.as_str()).unwrap_or(&line),
                                "ts": event.get("ts")
                            })).ok();
                        }
                        "metric" => {
                            app_clone.emit("run-metric", json!({
                                "run_id": run_id_clone,
                                "key": event.get("key"),
                                "value": event.get("value"),
                                "step": event.get("step"),
                                "ts": event.get("ts")
                            })).ok();
                        }
                        "progress" => {
                            app_clone.emit("run-progress", json!({
                                "run_id": run_id_clone,
                                "current": event.get("current"),
                                "total": event.get("total"),
                                "ts": event.get("ts")
                            })).ok();
                        }
                        "status" => {
                            app_clone.emit("run-status", json!({
                                "run_id": run_id_clone,
                                "status": event.get("state"),
                                "error": event.get("error"),
                                "ts": event.get("ts")
                            })).ok();
                        }
                        "artifact" => {
                            app_clone.emit("run-artifact", json!({
                                "run_id": run_id_clone,
                                "kind": event.get("kind"),
                                "path": event.get("path"),
                                "sha256": event.get("sha256"),
                                "ts": event.get("ts")
                            })).ok();
                        }
                        _ => {
                            // Unknown event, emit as log
                            app_clone.emit("run-log", json!({
                                "run_id": run_id_clone,
                                "level": "INFO",
                                "message": line,
                                "ts": chrono::Utc::now().to_rfc3339()
                            })).ok();
                        }
                    }
                } else {
                    // Not JSON, emit as plain log
                    app_clone.emit("run-log", json!({
                        "run_id": run_id_clone,
                        "level": "INFO",
                        "message": line,
                        "ts": chrono::Utc::now().to_rfc3339()
                    })).ok();
                }
            }
        });
    }
    
    // Read stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let run_id_clone = run_id.clone();
        
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                app_clone.emit("run-log", json!({
                    "run_id": run_id_clone,
                    "level": "ERROR",
                    "message": line,
                    "ts": chrono::Utc::now().to_rfc3339()
                })).ok();
            }
        });
    }
    
    // Wait for process to complete
    let exit_status = child.wait().await;
    
    let (final_status, error_msg) = match exit_status {
        Ok(status) if status.success() => ("succeeded", None),
        Ok(status) => ("failed", Some(format!("Exit code: {:?}", status.code()))),
        Err(e) => ("failed", Some(format!("Process error: {}", e))),
    };
    
    // Emit final status
    app.emit("run-status", json!({
        "run_id": run_id,
        "status": final_status,
        "error": error_msg
    })).ok();
    
    // Update database - need to get state from app
    // Note: In a real app, we'd have a better way to access the state
    app.emit("run-completed", json!({
        "run_id": run_id,
        "project_id": project_id,
        "status": final_status,
        "error": error_msg
    })).ok();
}

/// Find Python executable
fn find_python() -> Option<String> {
    // Try common Python paths
    let candidates = [
        "python3",
        "python",
        "/usr/bin/python3",
        "/usr/local/bin/python3",
        "/opt/homebrew/bin/python3",
    ];
    
    for candidate in candidates {
        if std::process::Command::new(candidate)
            .arg("--version")
            .output()
            .is_ok()
        {
            return Some(candidate.to_string());
        }
    }
    
    None
}


/// Find Docker executable path
fn find_docker_executable() -> Option<String> {
    // Common Docker paths on macOS
    let possible_paths = vec![
        "/usr/local/bin/docker",
        "/opt/homebrew/bin/docker",
        "/Applications/Docker.app/Contents/Resources/bin/docker",
        "/usr/bin/docker",
    ];
    
    // First, try to find docker in PATH using std::process (synchronous)
    if let Ok(output) = std::process::Command::new("which")
        .arg("docker")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                eprintln!("[DEBUG] Found Docker via 'which': {}", path);
                return Some(path);
            }
        }
    }
    
    // Try common paths
    for path in &possible_paths {
        if std::path::Path::new(path).exists() {
            eprintln!("[DEBUG] Found Docker at: {}", path);
            return Some(path.to_string());
        }
    }
    
    // Last resort: try "docker" and hope it's in PATH (might work in some environments)
    let test_result = std::process::Command::new("docker")
        .arg("--version")
        .output();
    
    if test_result.is_ok() && test_result.unwrap().status.success() {
        eprintln!("[DEBUG] Docker found in PATH");
        return Some("docker".to_string());
    }
    
    eprintln!("[WARNING] Docker not found in any standard location");
    None
}

/// Get the runner script path
fn get_runner_script_path() -> PathBuf {
    // In development, use the script in src-tauri/python
    // In production, it would be bundled with the app
    
    // Try to find it relative to the executable (for macOS .app bundle)
    if let Ok(exe_path) = std::env::current_exe() {
        eprintln!("[DEBUG] Current executable path: {}", exe_path.display());
        
        // For macOS .app bundle: AppName.app/Contents/MacOS/AppName
        // Resources are at: AppName.app/Contents/Resources/
        if let Some(exe_dir) = exe_path.parent() {
            // Try ../Resources/python/runner.py (standard macOS bundle location)
            let bundled_path = exe_dir.join("../Resources/python/runner.py");
            eprintln!("[DEBUG] Checking bundled path: {}", bundled_path.display());
        if bundled_path.exists() {
                eprintln!("[DEBUG] Found runner script at bundled path");
            return bundled_path;
        }
            
            // Try ../Resources/runner.py (alternative location)
            let alt_bundled_path = exe_dir.join("../Resources/runner.py");
            eprintln!("[DEBUG] Checking alternative bundled path: {}", alt_bundled_path.display());
            if alt_bundled_path.exists() {
                eprintln!("[DEBUG] Found runner script at alternative bundled path");
                return alt_bundled_path;
            }
            
            // Try same directory as executable (for development or non-bundled builds)
            let same_dir_path = exe_dir.join("runner.py");
            eprintln!("[DEBUG] Checking same directory path: {}", same_dir_path.display());
            if same_dir_path.exists() {
                eprintln!("[DEBUG] Found runner script in same directory as executable");
                return same_dir_path;
            }
        }
    }
    
    // Development path - relative to Cargo manifest directory
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("python/runner.py");
    eprintln!("[DEBUG] Checking development path: {}", dev_path.display());
    if dev_path.exists() {
        eprintln!("[DEBUG] Found runner script at development path");
        return dev_path;
    }
    
    // Fallback - try current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_path = cwd.join("python/runner.py");
        eprintln!("[DEBUG] Checking CWD path: {}", cwd_path.display());
        if cwd_path.exists() {
            eprintln!("[DEBUG] Found runner script at CWD path");
            return cwd_path;
        }
    }
    
    eprintln!("[WARNING] Runner script not found in any standard location, using fallback");
    // Last resort fallback
    PathBuf::from("python/runner.py")
}

#[tauri::command]
async fn list_runs(state: State<'_, AppState>, project_id: String) -> CommandResult<Vec<Run>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let runs = Run::list_by_project(conn, &project_id)?;
    Ok(runs)
}

#[tauri::command]
async fn cancel_run(state: State<'_, AppState>, run_id: String) -> CommandResult<()> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    Run::update_status(conn, &run_id, "cancelled", None)?;
    
    // TODO: Actually kill the runner process via RunnerManager
    
    Ok(())
}

// ============= Model Registry Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterModelRequest {
    pub project_id: String,
    pub run_id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
}

#[tauri::command]
async fn register_model(state: State<'_, AppState>, request: RegisterModelRequest) -> CommandResult<ModelVersion> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let ws_guard = state.workspace.lock().unwrap();
    let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    // Get or create model
    let model_id: String = match conn.query_row(
        "SELECT id FROM models WHERE project_id = ?1 AND name = ?2",
        rusqlite::params![request.project_id, request.name],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO models (id, project_id, name, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, request.project_id, request.name, request.description, now],
            )?;
            id
        }
        Err(e) => return Err(e.into()),
    };
    
    // Get run's model artifact path
    let run_dir = ws.run_path(&request.project_id, &request.run_id);
    let model_path = run_dir.join("model");
    let artifact_path = model_path.display().to_string();
    
    // Create model version
    let version_id = uuid::Uuid::new_v4().to_string();
    
    // Build provenance
    let provenance = json!({
        "run_id": request.run_id,
        "registered_at": now,
        "source": "local_training"
    });
    
    conn.execute(
        "INSERT INTO model_versions (id, model_id, run_id, version, stage, artifact_path, provenance_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            version_id,
            model_id,
            request.run_id,
            request.version,
            "draft",
            artifact_path,
            provenance.to_string(),
            now
        ],
    )?;
    
    Ok(ModelVersion {
        id: version_id,
        model_id,
        run_id: Some(request.run_id),
        version: request.version,
        stage: "draft".to_string(),
        artifact_path,
        provenance_json: Some(provenance.to_string()),
        metrics_json: None,
        created_at: now,
        promoted_at: None,
    })
}

#[tauri::command]
async fn promote_model(state: State<'_, AppState>, version_id: String, stage: String) -> CommandResult<()> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    ModelVersion::promote(conn, &version_id, &stage)?;
    
    Ok(())
}

#[tauri::command]
async fn list_models(state: State<'_, AppState>, project_id: String) -> CommandResult<Vec<Model>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, created_at FROM models WHERE project_id = ?1 ORDER BY created_at DESC"
    )?;
    
    let models = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Model {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?.collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(models)
}

#[tauri::command]
async fn list_model_versions(state: State<'_, AppState>, model_id: String) -> CommandResult<Vec<ModelVersion>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, model_id, run_id, version, stage, artifact_path, provenance_json, metrics_json, created_at, promoted_at FROM model_versions WHERE model_id = ?1 ORDER BY created_at DESC"
    )?;
    
    let versions = stmt.query_map(rusqlite::params![model_id], |row| {
        Ok(ModelVersion {
            id: row.get(0)?,
            model_id: row.get(1)?,
            run_id: row.get(2)?,
            version: row.get(3)?,
            stage: row.get(4)?,
            artifact_path: row.get(5)?,
            provenance_json: row.get(6)?,
            metrics_json: row.get(7)?,
            created_at: row.get(8)?,
            promoted_at: row.get(9)?,
        })
    })?.collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(versions)
}

// ============= Export Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    pub project_id: String,
    pub model_version_id: String,
    pub export_type: String, // "zip" or "docker_context"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub id: String,
    pub path: String,
    pub export_type: String,
}

#[tauri::command]
async fn export_model(state: State<'_, AppState>, request: ExportRequest) -> CommandResult<ExportResult> {
    let ws_guard = state.workspace.lock().unwrap();
    let ws = ws_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    // Get model version info
    let version: ModelVersion = conn.query_row(
        "SELECT id, model_id, run_id, version, stage, artifact_path, provenance_json, metrics_json, created_at, promoted_at FROM model_versions WHERE id = ?1",
        rusqlite::params![request.model_version_id],
        |row| {
            Ok(ModelVersion {
                id: row.get(0)?,
                model_id: row.get(1)?,
                run_id: row.get(2)?,
                version: row.get(3)?,
                stage: row.get(4)?,
                artifact_path: row.get(5)?,
                provenance_json: row.get(6)?,
                metrics_json: row.get(7)?,
                created_at: row.get(8)?,
                promoted_at: row.get(9)?,
            })
        },
    )?;
    
    let export_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let model_path = PathBuf::from(&version.artifact_path);
    
    // Build export metadata
    let metadata = json!({
        "export_id": export_id,
        "model_version_id": version.id,
        "model_id": version.model_id,
        "version": version.version,
        "stage": version.stage,
        "created_at": now,
        "tool_version": "0.1.0",
        "provenance": version.provenance_json.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
    });
    
    let export_path = match request.export_type.as_str() {
        "zip" => {
            create_zip_export(ws, &request.project_id, &export_id, &model_path, &metadata)?
        }
        "docker_context" => {
            create_docker_context_export(ws, &request.project_id, &export_id, &model_path, &metadata)?
        }
        _ => return Err(CommandError { message: "Invalid export type".into() }),
    };
    
    // Record export in database
    conn.execute(
        "INSERT INTO exports (id, project_id, model_version_id, export_type, path, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            export_id,
            request.project_id,
            request.model_version_id,
            request.export_type,
            export_path.display().to_string(),
            now
        ],
    )?;
    
    Ok(ExportResult {
        id: export_id,
        path: export_path.display().to_string(),
        export_type: request.export_type,
    })
}

#[tauri::command]
async fn list_exports(state: State<'_, AppState>, project_id: String) -> CommandResult<Vec<Export>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    let mut stmt = conn.prepare(
        "SELECT id, project_id, model_version_id, export_type, path, created_at FROM exports WHERE project_id = ?1 ORDER BY created_at DESC"
    )?;
    
    let exports = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Export {
            id: row.get(0)?,
            project_id: row.get(1)?,
            model_version_id: row.get(2)?,
            export_type: row.get(3)?,
            path: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?.collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(exports)
}

// ============= Global Model Listing =============

#[derive(Debug, Serialize, Deserialize)]
pub struct GlobalModel {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub name: String,
    pub description: Option<String>,
    pub stage: String,
    pub version: String,
    pub version_id: String,
    pub artifact_path: Option<String>,
    pub created_at: String,
}

#[tauri::command]
async fn list_all_models(state: State<'_, AppState>) -> CommandResult<Vec<GlobalModel>> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    // Join models, model_versions, and projects to get all model info
    let mut stmt = conn.prepare(
        "SELECT m.id, m.project_id, p.name as project_name, m.name, m.description, 
                mv.stage, mv.version, mv.id as version_id, mv.artifact_path, mv.created_at
         FROM models m
         JOIN model_versions mv ON m.id = mv.model_id
         JOIN projects p ON m.project_id = p.id
         ORDER BY mv.created_at DESC"
    )?;
    
    let models = stmt.query_map([], |row| {
        Ok(GlobalModel {
            id: row.get(0)?,
            project_id: row.get(1)?,
            project_name: row.get(2)?,
            name: row.get(3)?,
            description: row.get(4)?,
            stage: row.get(5)?,
            version: row.get(6)?,
            version_id: row.get(7)?,
            artifact_path: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?.collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(models)
}

// ============= Local Inference =============

#[derive(Debug, Serialize, Deserialize)]
pub struct PredictRequest {
    pub model_version_id: String,
    pub features: Vec<Vec<f64>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PredictResponse {
    pub predictions: Vec<i32>,
    pub probabilities: Option<Vec<Vec<f64>>>,
    pub model_name: String,
    pub latency_ms: u64,
}

#[tauri::command]
async fn local_predict(state: State<'_, AppState>, request: PredictRequest) -> CommandResult<PredictResponse> {
    use std::time::Instant;
    
    let start = Instant::now();
    
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or(CommandError { message: "No workspace open".into() })?;
    
    // Get model info
    let (model_name, artifact_path): (String, Option<String>) = conn.query_row(
        "SELECT m.name, mv.artifact_path 
         FROM model_versions mv 
         JOIN models m ON mv.model_id = m.id 
         WHERE mv.id = ?1",
        rusqlite::params![request.model_version_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    
    let artifact_path = artifact_path.ok_or(CommandError { 
        message: "Model has no artifact path".into() 
    })?;
    
    // Check if model file exists
    let model_file = std::path::Path::new(&artifact_path);
    if !model_file.exists() {
        // Try to find model.pkl or model.pt in the artifact directory
        let model_dir = std::path::Path::new(&artifact_path);
        let possible_files = ["model.pkl", "model.pt", "model.joblib", "model.onnx"];
        let mut found_file = None;
        
        for file in &possible_files {
            let path = model_dir.join(file);
            if path.exists() {
                found_file = Some(path);
                break;
            }
        }
        
        if found_file.is_none() {
            return Err(CommandError { 
                message: format!("Model artifact not found at {}", artifact_path) 
            });
        }
    }
    
    // For now, return mock predictions
    // TODO: Actually load and run the model via Python
    let predictions: Vec<i32> = request.features.iter().map(|_| {
        // Simple mock: random class 0 or 1
        if rand::random::<f64>() > 0.5 { 1 } else { 0 }
    }).collect();
    
    let probabilities: Vec<Vec<f64>> = predictions.iter().map(|&p| {
        if p == 1 {
            vec![0.3, 0.7]
        } else {
            vec![0.7, 0.3]
        }
    }).collect();
    
    let latency = start.elapsed().as_millis() as u64;
    
    Ok(PredictResponse {
        predictions,
        probabilities: Some(probabilities),
        model_name,
        latency_ms: latency,
    })
}

// ============= Docker Commands =============

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerPullRequest {
    pub image: String,
    pub tag: String,
}

/// Pull a Docker image
#[tauri::command]
async fn pull_docker_image(app: AppHandle, request: DockerPullRequest) -> CommandResult<String> {
    use tokio::process::Command;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use std::process::Stdio;
    
    // If image already contains a tag (has ':'), use it as-is, otherwise append tag
    let full_image = if request.image.contains(':') {
        request.image.clone()
    } else {
        format!("{}:{}", request.image, request.tag)
    };
    
    app.emit("docker-pull-progress", json!({
        "image": full_image,
        "status": "starting",
        "message": format!("Pulling {}...", full_image)
    })).ok();
    
    // Find Docker executable path
    let docker_path = find_docker_executable();
    let docker_cmd = match docker_path {
        Some(ref path) => path.as_str(),
        None => {
            return Err(CommandError {
                message: "Docker not found. Please install Docker Desktop.".to_string(),
            });
        }
    };
    
    // Check if Docker is available
    let docker_check = Command::new(docker_cmd)
        .arg("--version")
        .output()
        .await;
    
    if docker_check.is_err() {
        return Err(CommandError {
            message: "Docker is not installed or not available. Please install Docker Desktop.".to_string(),
        });
    }
    
    // Check if Docker daemon is running
    let docker_info = Command::new(docker_cmd)
        .arg("info")
        .output()
        .await;
    
    if docker_info.is_err() || !docker_info.unwrap().status.success() {
        return Err(CommandError {
            message: "Docker daemon is not running. Please start Docker Desktop.".to_string(),
        });
    }
    
    // Pull the image with streaming output
    let mut cmd = Command::new(docker_cmd);
    cmd.arg("pull")
        .arg(&full_image)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let mut child = cmd.spawn()
        .map_err(|e| CommandError {
            message: format!("Failed to spawn docker pull: {}", e),
        })?;
    
    // Stream stderr (Docker outputs progress to stderr)
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let full_image_clone = full_image.clone();
        
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            while let Ok(Some(line)) = lines.next_line().await {
                // Emit progress updates
                app_clone.emit("docker-pull-progress", json!({
                    "image": full_image_clone,
                    "status": "pulling",
                    "message": line
                })).ok();
            }
        });
    }
    
    // Wait for the pull to complete
    let output = child.wait_with_output().await
        .map_err(|e| CommandError {
            message: format!("Failed to execute docker pull: {}", e),
        })?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        app.emit("docker-pull-progress", json!({
            "image": full_image,
            "status": "error",
            "message": error_msg.to_string()
        })).ok();
        
        return Err(CommandError {
            message: format!("Docker pull failed: {}", error_msg),
        });
    }
    
    // Verify the image was actually pulled by checking docker images
    // First, list all images and check if our image is in the list
    let verify_cmd = Command::new(docker_cmd)
        .arg("images")
        .arg("--format")
        .arg("{{.Repository}}:{{.Tag}}")
        .output()
        .await;
    
    let image_exists = verify_cmd
        .map(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Check if the exact image name exists in the list
            stdout.lines().any(|line| line.trim() == full_image)
        })
        .unwrap_or(false);
    
    if !image_exists {
        // Try to find similar images (might have been pulled with different tag)
        let all_images_cmd = Command::new(docker_cmd)
            .arg("images")
            .arg("--format")
            .arg("{{.Repository}}:{{.Tag}}")
            .output()
            .await;
        
        let similar_images = all_images_cmd
            .map(|output| {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let repo = full_image.split(':').next().unwrap_or("");
                stdout.lines()
                    .filter(|line| line.starts_with(repo))
                    .map(|s| s.trim().to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        
        let error_msg = if !similar_images.is_empty() {
            format!(
                "Image pull completed but verification failed. Found similar images: {}. Expected: {}",
                similar_images.join(", "),
                full_image
            )
        } else {
            format!(
                "Image pull completed but image '{}' not found in local registry. The image may not exist or the pull may have failed.",
                full_image
            )
        };
        
        app.emit("docker-pull-progress", json!({
            "image": full_image,
            "status": "error",
            "message": error_msg.clone()
        })).ok();
        
        return Err(CommandError {
            message: error_msg,
        });
    }
    
    app.emit("docker-pull-progress", json!({
        "image": full_image,
        "status": "completed",
        "message": format!("Successfully pulled and verified {}", full_image)
    })).ok();
    
    Ok(format!("Successfully pulled {}", full_image))
}

/// List pulled Docker images
#[tauri::command]
async fn list_docker_images() -> CommandResult<Vec<String>> {
    use tokio::process::Command;
    use std::process::Stdio;
    
    // Check if Docker is available
    let docker_check = Command::new("docker")
        .arg("--version")
        .output()
        .await;
    
    if docker_check.is_err() {
        return Ok(vec![]); // Return empty list if Docker is not available
    }
    
    // List images
    let mut cmd = Command::new("docker");
    cmd.arg("images")
        .arg("--format")
        .arg("{{.Repository}}:{{.Tag}}")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let output = cmd.output().await
        .map_err(|e| CommandError {
            message: format!("Failed to execute docker images: {}", e),
        })?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("docker images command failed: {}", stderr);
        return Ok(vec![]);
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let images: Vec<String> = stdout
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    
    // Debug: log what we found
    eprintln!("Found {} Docker images: {:?}", images.len(), images);
    
    Ok(images)
}

/// Check if Docker image exists locally
#[tauri::command]
async fn check_docker_image(image: String, tag: String) -> CommandResult<bool> {
    let images = list_docker_images().await?;
    let full_image = format!("{}:{}", image, tag);
    Ok(images.contains(&full_image))
}

// ============= OAuth Local Server =============

use std::sync::Arc;
use tokio::sync::oneshot;

/// Response from starting the OAuth server
#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthServerInfo {
    pub port: u16,
    pub callback_url: String,
}

/// OAuth callback result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthCallbackResult {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub code: Option<String>,
    pub error: Option<String>,
}

/// Start a local HTTP server to receive OAuth callback
#[tauri::command]
async fn start_oauth_server(app: AppHandle) -> CommandResult<OAuthServerInfo> {
    use axum::{
        extract::Query,
        response::Html,
        routing::get,
        Router,
    };
    use std::net::SocketAddr;
    
    // Create a channel to receive the OAuth callback
    let (tx, rx) = oneshot::channel::<OAuthCallbackResult>();
    let tx = Arc::new(std::sync::Mutex::new(Some(tx)));
    
    // Clone for the handler
    let app_handle = app.clone();
    let tx_clone = tx.clone();
    
    // Create the callback handler
    let callback_handler = move |Query(params): Query<std::collections::HashMap<String, String>>| {
        let access_token = params.get("access_token").cloned();
        let refresh_token = params.get("refresh_token").cloned();
        let code = params.get("code").cloned();
        let error = params.get("error").cloned();
        
        eprintln!("[OAuth] Callback received - access_token: {:?}, refresh_token: {:?}, code: {:?}, error: {:?}", 
                  access_token.is_some(), refresh_token.is_some(), code.is_some(), error);
        
        let result = OAuthCallbackResult { access_token, refresh_token, code, error };
        
        // Send result through channel
        if let Ok(mut guard) = tx_clone.lock() {
            if let Some(sender) = guard.take() {
                let _ = sender.send(result.clone());
            }
        }
        
        // Emit event to frontend
        let _ = app_handle.emit("oauth-callback", result);
        
        // Return HTML response
        let html = if code.is_some() {
            r#"
            <!DOCTYPE html>
            <html>
            <head><title>Authentication Successful</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                       display: flex; justify-content: center; align-items: center; 
                       height: 100vh; margin: 0; background: #1a1a2e; color: white; }
                .container { text-align: center; }
                .success { color: #4ade80; font-size: 48px; }
                h1 { margin-top: 20px; }
                p { color: #888; }
            </style>
            </head>
            <body>
                <div class="container">
                    <div class="success">✓</div>
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to BabushkaML.</p>
                </div>
            </body>
            </html>
            "#
        } else {
            r#"
            <!DOCTYPE html>
            <html>
            <head><title>Authentication Failed</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                       display: flex; justify-content: center; align-items: center; 
                       height: 100vh; margin: 0; background: #1a1a2e; color: white; }
                .container { text-align: center; }
                .error { color: #f87171; font-size: 48px; }
                h1 { margin-top: 20px; }
                p { color: #888; }
            </style>
            </head>
            <body>
                <div class="container">
                    <div class="error">✗</div>
                    <h1>Authentication Failed</h1>
                    <p>Please close this window and try again.</p>
                </div>
            </body>
            </html>
            "#
        };
        
        async move { Html(html) }
    };
    
    // Create router
    let router = Router::new()
        .route("/callback", get(callback_handler));
    
    // Use a fixed port (required for Supabase redirect URL configuration)
    const OAUTH_PORT: u16 = 9876;
    
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", OAUTH_PORT)).await
        .map_err(|e| CommandError { message: format!("Failed to bind to port {}: {}. Is another instance running?", OAUTH_PORT, e) })?;
    
    let port = OAUTH_PORT;
    let callback_url = format!("http://127.0.0.1:{}/callback", port);
    
    eprintln!("[OAuth] Starting local server on port {}", port);
    eprintln!("[OAuth] Callback URL: {}", callback_url);
    
    // Spawn the server
    tokio::spawn(async move {
        axum::serve(listener, router)
            .await
            .expect("OAuth server error");
    });
    
    Ok(OAuthServerInfo { port, callback_url })
}

// ============= App Entry Point =============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Handle deep links for OAuth callback
            #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
            {
                let handle = app.handle().clone();
                
                // Listen for deep-link events from the plugin
                app.listen("deep-link://new-url", move |event: tauri::Event| {
                    // The payload is a JSON string containing the URLs array
                    let payload = event.payload();
                    eprintln!("[DEBUG] Deep link received: {}", payload);
                    
                    // Try to parse as JSON array of URLs
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(payload) {
                        for url in urls {
                            if url.starts_with("babushkaml://auth") {
                                eprintln!("[DEBUG] Auth deep link: {}", url);
                                handle.emit("auth-callback", json!({ "url": url })).ok();
                            }
                        }
                    } else if payload.starts_with("babushkaml://auth") {
                        // Fallback: payload might be a single URL string
                        handle.emit("auth-callback", json!({ "url": payload })).ok();
                    }
                });
            }
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Workspace
            open_workspace,
            get_workspace,
            // Projects
            create_project,
            list_projects,
            get_project,
            delete_project,
            // Datasets
            import_dataset_cmd,
            list_datasets,
            // Runs
            start_run,
            list_runs,
            cancel_run,
            // Models
            register_model,
            promote_model,
            list_models,
            list_model_versions,
            list_all_models,
            local_predict,
            // Exports
            export_model,
            list_exports,
            // Docker
            pull_docker_image,
            list_docker_images,
            check_docker_image,
            // OAuth
            start_oauth_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
