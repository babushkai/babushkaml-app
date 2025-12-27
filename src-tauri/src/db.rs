// Database module - SQLite schema and operations
use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use chrono::Utc;
use uuid::Uuid;

/// Initialize the database with schema
pub fn init_database(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    
    conn.execute_batch(SCHEMA)?;
    
    Ok(conn)
}

const SCHEMA: &str = r#"
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    storage_mode TEXT NOT NULL CHECK(storage_mode IN ('copy', 'reference')),
    manifest_path TEXT NOT NULL,
    size_bytes INTEGER,
    file_count INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Training runs table
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dataset_id TEXT,
    name TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
    started_at TEXT,
    ended_at TEXT,
    config_path TEXT,
    entrypoint TEXT,
    error_summary TEXT,
    device TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
);

-- Run metrics (indexed, raw data in files)
CREATE TABLE IF NOT EXISTS run_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    key TEXT NOT NULL,
    value REAL NOT NULL,
    ts TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('model', 'checkpoint', 'log', 'metric', 'other')),
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Models table (model names in registry)
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, name)
);

-- Model versions table
CREATE TABLE IF NOT EXISTS model_versions (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    run_id TEXT,
    version TEXT NOT NULL,
    stage TEXT NOT NULL CHECK(stage IN ('draft', 'staging', 'production', 'archived')),
    artifact_path TEXT NOT NULL,
    provenance_json TEXT,
    metrics_json TEXT,
    created_at TEXT NOT NULL,
    promoted_at TEXT,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE SET NULL
);

-- Exports table
CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    model_version_id TEXT NOT NULL,
    export_type TEXT NOT NULL CHECK(export_type IN ('zip', 'docker_context', 'docker_image')),
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (model_version_id) REFERENCES model_versions(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_run_metrics_run ON run_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_models_project ON models(project_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_model ON model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_stage ON model_versions(stage);
CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);
"#;

// ============= Data Types =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dataset {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub fingerprint: String,
    pub storage_mode: String,
    pub manifest_path: String,
    pub size_bytes: Option<i64>,
    pub file_count: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub id: String,
    pub project_id: String,
    pub dataset_id: Option<String>,
    pub name: Option<String>,
    pub status: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub config_path: Option<String>,
    pub entrypoint: Option<String>,
    pub error_summary: Option<String>,
    pub device: Option<String>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub id: String,
    pub run_id: String,
    pub kind: String,
    pub path: String,
    pub sha256: String,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    pub id: String,
    pub model_id: String,
    pub run_id: Option<String>,
    pub version: String,
    pub stage: String,
    pub artifact_path: String,
    pub provenance_json: Option<String>,
    pub metrics_json: Option<String>,
    pub created_at: String,
    pub promoted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Export {
    pub id: String,
    pub project_id: String,
    pub model_version_id: String,
    pub export_type: String,
    pub path: String,
    pub created_at: String,
}

// ============= CRUD Operations =============

impl Project {
    pub fn create(conn: &Connection, name: &str, root_path: &str, description: Option<&str>) -> Result<Self> {
        let now = Utc::now().to_rfc3339();
        let project = Project {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            root_path: root_path.to_string(),
            description: description.map(|s| s.to_string()),
            created_at: now.clone(),
            updated_at: now,
        };
        
        conn.execute(
            "INSERT INTO projects (id, name, root_path, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project.id, project.name, project.root_path, project.description, project.created_at, project.updated_at],
        )?;
        
        Ok(project)
    }
    
    pub fn get(conn: &Connection, id: &str) -> Result<Option<Self>> {
        let mut stmt = conn.prepare("SELECT id, name, root_path, description, created_at, updated_at FROM projects WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }
    
    pub fn list(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT id, name, root_path, description, created_at, updated_at FROM projects ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        
        rows.collect()
    }
    
    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }
}

impl Run {
    pub fn create(conn: &Connection, project_id: &str, dataset_id: Option<&str>, name: Option<&str>, config_path: Option<&str>, entrypoint: Option<&str>) -> Result<Self> {
        let now = Utc::now().to_rfc3339();
        let run = Run {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            dataset_id: dataset_id.map(|s| s.to_string()),
            name: name.map(|s| s.to_string()),
            status: "pending".to_string(),
            started_at: None,
            ended_at: None,
            config_path: config_path.map(|s| s.to_string()),
            entrypoint: entrypoint.map(|s| s.to_string()),
            error_summary: None,
            device: None,
            created_at: now,
        };
        
        conn.execute(
            "INSERT INTO runs (id, project_id, dataset_id, name, status, config_path, entrypoint, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![run.id, run.project_id, run.dataset_id, run.name, run.status, run.config_path, run.entrypoint, run.created_at],
        )?;
        
        Ok(run)
    }
    
    pub fn update_status(conn: &Connection, id: &str, status: &str, error: Option<&str>) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        
        if status == "running" {
            conn.execute(
                "UPDATE runs SET status = ?2, started_at = ?3 WHERE id = ?1",
                params![id, status, now],
            )?;
        } else if status == "succeeded" || status == "failed" || status == "cancelled" {
            conn.execute(
                "UPDATE runs SET status = ?2, ended_at = ?3, error_summary = ?4 WHERE id = ?1",
                params![id, status, now, error],
            )?;
        } else {
            conn.execute(
                "UPDATE runs SET status = ?2 WHERE id = ?1",
                params![id, status],
            )?;
        }
        
        Ok(())
    }
    
    pub fn list_by_project(conn: &Connection, project_id: &str) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, dataset_id, name, status, started_at, ended_at, config_path, entrypoint, error_summary, device, created_at 
             FROM runs WHERE project_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Run {
                id: row.get(0)?,
                project_id: row.get(1)?,
                dataset_id: row.get(2)?,
                name: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
                config_path: row.get(7)?,
                entrypoint: row.get(8)?,
                error_summary: row.get(9)?,
                device: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?;
        
        rows.collect()
    }
}

impl ModelVersion {
    pub fn promote(conn: &Connection, id: &str, new_stage: &str) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        
        // If promoting to production, demote other production versions
        if new_stage == "production" {
            // First get the model_id for this version
            let model_id: String = conn.query_row(
                "SELECT model_id FROM model_versions WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )?;
            
            // Demote other production versions to archived
            conn.execute(
                "UPDATE model_versions SET stage = 'archived', promoted_at = ?2 WHERE model_id = ?1 AND stage = 'production' AND id != ?3",
                params![model_id, now, id],
            )?;
        }
        
        conn.execute(
            "UPDATE model_versions SET stage = ?2, promoted_at = ?3 WHERE id = ?1",
            params![id, new_stage, now],
        )?;
        
        Ok(())
    }
}

