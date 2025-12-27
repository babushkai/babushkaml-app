// Workspace module - file system management and hashing
use std::fs::{self, File};
use std::io::{Read, Write, BufReader};
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WorkspaceError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path not found: {0}")]
    PathNotFound(String),
    #[error("Invalid workspace structure")]
    InvalidStructure,
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

pub type Result<T> = std::result::Result<T, WorkspaceError>;

/// Workspace directory structure
#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,
}

impl Workspace {
    /// Initialize a new workspace at the given path
    pub fn init(root: &Path) -> Result<Self> {
        let workspace = Self { root: root.to_path_buf() };
        
        // Create directory structure
        fs::create_dir_all(workspace.db_path())?;
        fs::create_dir_all(workspace.projects_path())?;
        fs::create_dir_all(workspace.cache_path())?;
        fs::create_dir_all(workspace.tmp_path())?;
        
        Ok(workspace)
    }
    
    /// Open an existing workspace
    pub fn open(root: &Path) -> Result<Self> {
        if !root.exists() {
            return Err(WorkspaceError::PathNotFound(root.display().to_string()));
        }
        Ok(Self { root: root.to_path_buf() })
    }
    
    pub fn db_path(&self) -> PathBuf {
        self.root.join("db")
    }
    
    pub fn sqlite_path(&self) -> PathBuf {
        self.db_path().join("app.sqlite")
    }
    
    pub fn projects_path(&self) -> PathBuf {
        self.root.join("projects")
    }
    
    pub fn cache_path(&self) -> PathBuf {
        self.root.join("cache")
    }
    
    pub fn tmp_path(&self) -> PathBuf {
        self.root.join("tmp")
    }
    
    /// Get or create project directory
    pub fn project_path(&self, project_id: &str) -> PathBuf {
        self.projects_path().join(project_id)
    }
    
    /// Initialize project directory structure
    pub fn init_project(&self, project_id: &str) -> Result<PathBuf> {
        let project_path = self.project_path(project_id);
        
        fs::create_dir_all(project_path.join("datasets"))?;
        fs::create_dir_all(project_path.join("runs"))?;
        fs::create_dir_all(project_path.join("models"))?;
        fs::create_dir_all(project_path.join("exports"))?;
        
        Ok(project_path)
    }
    
    /// Get dataset directory
    pub fn dataset_path(&self, project_id: &str, dataset_id: &str) -> PathBuf {
        self.project_path(project_id).join("datasets").join(dataset_id)
    }
    
    /// Get run directory
    pub fn run_path(&self, project_id: &str, run_id: &str) -> PathBuf {
        self.project_path(project_id).join("runs").join(run_id)
    }
    
    /// Initialize run directory structure
    pub fn init_run(&self, project_id: &str, run_id: &str) -> Result<PathBuf> {
        let run_path = self.run_path(project_id, run_id);
        
        fs::create_dir_all(&run_path)?;
        fs::create_dir_all(run_path.join("artifacts"))?;
        fs::create_dir_all(run_path.join("model"))?;
        
        Ok(run_path)
    }
    
    /// Get model directory
    #[allow(dead_code)]
    pub fn model_path(&self, project_id: &str, model_name: &str) -> PathBuf {
        self.project_path(project_id).join("models").join(model_name)
    }
    
    /// Get export directory
    pub fn export_path(&self, project_id: &str, export_id: &str) -> PathBuf {
        self.project_path(project_id).join("exports").join(export_id)
    }
}

// ============= File Hashing =============

/// Compute SHA256 hash of a file
pub fn hash_file(path: &Path) -> Result<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    
    Ok(hex::encode(hasher.finalize()))
}

/// Compute fingerprint of a directory (hash of sorted file hashes)
pub fn fingerprint_directory(path: &Path) -> Result<DirectoryFingerprint> {
    let mut entries: Vec<(String, String, u64)> = Vec::new();
    let mut total_size = 0u64;
    let mut file_count = 0usize;
    
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let file_path = entry.path();
            let relative_path = file_path.strip_prefix(path)
                .map_err(|_| WorkspaceError::InvalidStructure)?
                .to_string_lossy()
                .to_string();
            
            let hash = hash_file(file_path)?;
            let size = fs::metadata(file_path)?.len();
            
            entries.push((relative_path, hash, size));
            total_size += size;
            file_count += 1;
        }
    }
    
    // Sort by path for deterministic fingerprint
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    
    // Compute overall fingerprint
    let mut hasher = Sha256::new();
    for (path, hash, _) in &entries {
        hasher.update(path.as_bytes());
        hasher.update(hash.as_bytes());
    }
    
    Ok(DirectoryFingerprint {
        fingerprint: hex::encode(hasher.finalize()),
        total_size,
        file_count,
        files: entries.into_iter().map(|(p, h, s)| FileEntry { path: p, hash: h, size: s }).collect(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryFingerprint {
    pub fingerprint: String,
    pub total_size: u64,
    pub file_count: usize,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub hash: String,
    pub size: u64,
}

// ============= Dataset Import =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetManifest {
    pub id: String,
    pub name: String,
    pub source_path: String,
    pub storage_mode: String,
    pub fingerprint: DirectoryFingerprint,
    pub created_at: String,
}

/// Import a dataset into the workspace
pub fn import_dataset(
    workspace: &Workspace,
    project_id: &str,
    dataset_id: &str,
    name: &str,
    source_path: &Path,
    copy: bool,
) -> Result<DatasetManifest> {
    let dataset_dir = workspace.dataset_path(project_id, dataset_id);
    fs::create_dir_all(&dataset_dir)?;
    
    let fingerprint = fingerprint_directory(source_path)?;
    
    let storage_mode = if copy { "copy" } else { "reference" };
    
    if copy {
        // Copy files into workspace
        let raw_dir = dataset_dir.join("raw");
        copy_dir_recursive(source_path, &raw_dir)?;
    }
    
    let manifest = DatasetManifest {
        id: dataset_id.to_string(),
        name: name.to_string(),
        source_path: source_path.display().to_string(),
        storage_mode: storage_mode.to_string(),
        fingerprint,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    // Save manifest
    let manifest_path = dataset_dir.join("manifest.json");
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| WorkspaceError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    fs::write(&manifest_path, manifest_json)?;
    
    Ok(manifest)
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    
    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let src_path = entry.path();
        let relative = src_path.strip_prefix(src).map_err(|_| WorkspaceError::InvalidStructure)?;
        let dst_path = dst.join(relative);
        
        if entry.file_type().is_dir() {
            fs::create_dir_all(&dst_path)?;
        } else {
            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(src_path, &dst_path)?;
        }
    }
    
    Ok(())
}

// ============= Export =============

/// Create a zip export of a model
pub fn create_zip_export(
    workspace: &Workspace,
    project_id: &str,
    export_id: &str,
    model_path: &Path,
    metadata: &serde_json::Value,
) -> Result<PathBuf> {
    let export_dir = workspace.export_path(project_id, export_id);
    fs::create_dir_all(&export_dir)?;
    
    let zip_path = export_dir.join("bundle.zip");
    let file = File::create(&zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    
    // Add all files from model directory
    for entry in WalkDir::new(model_path).into_iter().filter_map(|e| e.ok()) {
        let src_path = entry.path();
        if entry.file_type().is_file() {
            let relative = src_path.strip_prefix(model_path)
                .map_err(|_| WorkspaceError::InvalidStructure)?;
            let archive_path = format!("model/{}", relative.display());
            
            zip.start_file(&archive_path, options)?;
            let mut file = File::open(src_path)?;
            std::io::copy(&mut file, &mut zip)?;
        }
    }
    
    // Add export metadata
    zip.start_file("export.json", options)?;
    let metadata_json = serde_json::to_string_pretty(metadata)
        .map_err(|e| WorkspaceError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    zip.write_all(metadata_json.as_bytes())?;
    
    // Add README
    zip.start_file("README.md", options)?;
    zip.write_all(README_TEMPLATE.as_bytes())?;
    
    zip.finish()?;
    
    // Save export metadata
    let export_json = export_dir.join("export.json");
    fs::write(&export_json, &metadata_json)?;
    
    Ok(zip_path)
}

/// Create a Docker context export
pub fn create_docker_context_export(
    workspace: &Workspace,
    project_id: &str,
    export_id: &str,
    model_path: &Path,
    metadata: &serde_json::Value,
) -> Result<PathBuf> {
    let export_dir = workspace.export_path(project_id, export_id);
    fs::create_dir_all(&export_dir)?;
    
    // Copy model files
    let model_dest = export_dir.join("model");
    copy_dir_recursive(model_path, &model_dest)?;
    
    // Create app directory
    let app_dir = export_dir.join("app");
    fs::create_dir_all(&app_dir)?;
    
    // Write inference server
    fs::write(app_dir.join("server.py"), INFERENCE_SERVER_TEMPLATE)?;
    fs::write(app_dir.join("requirements.txt"), REQUIREMENTS_TEMPLATE)?;
    
    // Write Dockerfile
    fs::write(export_dir.join("Dockerfile"), DOCKERFILE_TEMPLATE)?;
    
    // Write README
    fs::write(export_dir.join("README.md"), DOCKER_README_TEMPLATE)?;
    
    // Write export metadata
    let metadata_json = serde_json::to_string_pretty(metadata)
        .map_err(|e| WorkspaceError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    fs::write(export_dir.join("export.json"), &metadata_json)?;
    
    Ok(export_dir)
}

// ============= Templates =============

const README_TEMPLATE: &str = r#"# Model Bundle

This bundle was exported from BabushkaML.

## Contents

- `model/` - Model files and artifacts
- `export.json` - Export metadata and provenance

## Usage

Load the model using the appropriate framework based on the model format:
- `.onnx` - ONNX Runtime
- `.pt`/`.pth` - PyTorch
- `.pkl` - scikit-learn

See `model/signature.json` for input/output schema.
"#;

const DOCKERFILE_TEMPLATE: &str = r#"FROM python:3.11-slim

WORKDIR /app

COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .
COPY model/ /app/model/

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
"#;

const INFERENCE_SERVER_TEMPLATE: &str = r#""""Inference server for exported model."""
import json
from pathlib import Path
from typing import List, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Model Inference Server")

MODEL_PATH = Path("/app/model")

# Load model on startup
model = None
signature = None

@app.on_event("startup")
async def load_model():
    global model, signature
    
    # Load signature
    sig_path = MODEL_PATH / "signature.json"
    if sig_path.exists():
        signature = json.loads(sig_path.read_text())
    
    # Load model based on format
    if (MODEL_PATH / "model.onnx").exists():
        import onnxruntime as ort
        model = ort.InferenceSession(str(MODEL_PATH / "model.onnx"))
    elif (MODEL_PATH / "model.pt").exists():
        import torch
        model = torch.load(MODEL_PATH / "model.pt", map_location="cpu")
        model.eval()
    elif (MODEL_PATH / "model.pkl").exists():
        import joblib
        model = joblib.load(MODEL_PATH / "model.pkl")


class PredictRequest(BaseModel):
    inputs: List[List[float]]


class PredictResponse(BaseModel):
    predictions: List[Any]
    model_version: str


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}


@app.get("/signature")
async def get_signature():
    if signature is None:
        raise HTTPException(status_code=404, detail="Signature not found")
    return signature


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # ONNX inference
        if hasattr(model, "run"):
            import numpy as np
            inputs = np.array(request.inputs, dtype=np.float32)
            input_name = model.get_inputs()[0].name
            outputs = model.run(None, {input_name: inputs})
            predictions = outputs[0].tolist()
        # PyTorch inference
        elif hasattr(model, "forward"):
            import torch
            inputs = torch.tensor(request.inputs, dtype=torch.float32)
            with torch.no_grad():
                outputs = model(inputs)
            predictions = outputs.tolist()
        # sklearn inference
        else:
            import numpy as np
            inputs = np.array(request.inputs)
            predictions = model.predict(inputs).tolist()
        
        return PredictResponse(
            predictions=predictions,
            model_version=signature.get("version", "unknown") if signature else "unknown"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"#;

const REQUIREMENTS_TEMPLATE: &str = r#"fastapi==0.109.0
uvicorn[standard]==0.27.0
numpy>=1.24.0
onnxruntime>=1.16.0
# Optional: uncomment if using PyTorch models
# torch>=2.0.0
# Optional: uncomment if using sklearn models
# scikit-learn>=1.3.0
# joblib>=1.3.0
"#;

const DOCKER_README_TEMPLATE: &str = r#"# Docker Export

This directory contains a Docker-ready inference server for your model.

## Build & Run

```bash
# Build the image
docker build -t my-model:latest .

# Run the container
docker run -p 8000:8000 my-model:latest
```

## API Endpoints

- `GET /health` - Health check
- `GET /signature` - Model input/output schema
- `POST /predict` - Run inference

### Example Request

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"inputs": [[1.0, 2.0, 3.0, 4.0]]}'
```
"#;

