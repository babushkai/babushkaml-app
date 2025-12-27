#!/usr/bin/env python3
"""
BabushkaML - Training Runner

This script is spawned by the Tauri app to execute training jobs.
It communicates via JSONL events on stdout.
"""

import argparse
import json
import os
import sys
import time
import hashlib
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# ============= Event Emission =============

def emit(event_type: str, **kwargs):
    """Emit a JSONL event to stdout for Tauri to capture."""
    event = {
        "type": event_type,
        "ts": datetime.utcnow().isoformat() + "Z",
        **kwargs
    }
    print(json.dumps(event), flush=True)

def log(message: str, level: str = "INFO"):
    emit("log", level=level, message=message)

def metric(key: str, value: float, step: int):
    emit("metric", key=key, value=value, step=step)

def progress(current: int, total: int):
    emit("progress", current=current, total=total)

def artifact(kind: str, path: str, sha256: str):
    emit("artifact", kind=kind, path=path, sha256=sha256)

def status(state: str, error: Optional[str] = None):
    emit("status", state=state, error=error)

def device_info(name: str):
    emit("device", name=name)

# ============= Utilities =============

def hash_file(path: Path) -> str:
    """Compute SHA256 of a file."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def detect_device() -> str:
    """Detect available compute device."""
    try:
        import torch
        if torch.backends.mps.is_available():
            return "mps"
        elif torch.cuda.is_available():
            return f"cuda:{torch.cuda.current_device()}"
        else:
            return "cpu"
    except ImportError:
        return "cpu"

# ============= Model Bundle =============

def create_model_bundle(
    model_dir: Path,
    model_path: Path,
    name: str,
    version: str,
    framework: str,
    inputs_schema: Dict,
    outputs_schema: Dict,
    requirements: List[str],
):
    """Create a standardized model bundle."""
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy model file
    import shutil
    dest_model = model_dir / model_path.name
    if model_path != dest_model:
        shutil.copy2(model_path, dest_model)
    
    # Create metadata.json
    metadata = {
        "name": name,
        "version": version,
        "framework": framework,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    (model_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))
    
    # Create signature.json
    signature = {
        "inputs": inputs_schema,
        "outputs": outputs_schema,
    }
    (model_dir / "signature.json").write_text(json.dumps(signature, indent=2))
    
    # Create requirements.lock
    (model_dir / "requirements.lock").write_text("\n".join(requirements))
    
    log(f"Model bundle created at {model_dir}")

# ============= Training Templates =============

def train_tabular_classifier(config: Dict, dataset_path: Optional[Path], output_dir: Path):
    """Template: Train a tabular classifier using sklearn or PyTorch."""
    log("Starting tabular classifier training")
    
    try:
        import numpy as np
    except ImportError:
        log("numpy not available, using mock training", level="WARNING")
        return mock_training(config, output_dir)
    
    # Try sklearn first (more portable)
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score
        import joblib
        
        device_info("cpu")
        
        # Generate or load data
        if dataset_path and dataset_path.exists():
            log(f"Loading dataset from {dataset_path}")
            # Load CSV or numpy
            if dataset_path.suffix == ".csv":
                import pandas as pd
                df = pd.read_csv(dataset_path)
                X = df.iloc[:, :-1].values
                y = df.iloc[:, -1].values
            else:
                data = np.load(dataset_path)
                X, y = data["X"], data["y"]
        else:
            log("Generating synthetic dataset")
            n_samples = config.get("n_samples", 1000)
            n_features = config.get("n_features", 10)
            X = np.random.randn(n_samples, n_features)
            y = (X.sum(axis=1) > 0).astype(int)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train model
        n_estimators = config.get("n_estimators", 100)
        max_depth = config.get("max_depth", 10)
        
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            n_jobs=-1,
            warm_start=True,
        )
        
        # Progressive training with metrics
        for i in range(1, n_estimators + 1, max(1, n_estimators // 10)):
            model.n_estimators = i
            model.fit(X_train, y_train)
            
            train_acc = accuracy_score(y_train, model.predict(X_train))
            test_acc = accuracy_score(y_test, model.predict(X_test))
            
            step = i
            metric("train_accuracy", train_acc, step)
            metric("test_accuracy", test_acc, step)
            progress(i, n_estimators)
            
            log(f"Step {i}/{n_estimators}: train_acc={train_acc:.4f}, test_acc={test_acc:.4f}")
        
        # Final model
        model.n_estimators = n_estimators
        model.fit(X_train, y_train)
        
        # Save model
        model_dir = output_dir / "model"
        model_path = model_dir / "model.pkl"
        model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, model_path)
        
        # Create bundle
        create_model_bundle(
            model_dir=model_dir,
            model_path=model_path,
            name="tabular_classifier",
            version="1.0.0",
            framework="sklearn",
            inputs_schema={"type": "array", "shape": [None, X.shape[1]], "dtype": "float32"},
            outputs_schema={"type": "array", "shape": [None], "dtype": "int32"},
            requirements=["scikit-learn>=1.3.0", "joblib>=1.3.0", "numpy>=1.24.0"],
        )
        
        # Emit artifact
        artifact("model", str(model_path), hash_file(model_path))
        
        final_acc = accuracy_score(y_test, model.predict(X_test))
        log(f"Training complete. Final test accuracy: {final_acc:.4f}")
        metric("final_accuracy", final_acc, n_estimators)
        
        return True
        
    except ImportError:
        log("sklearn not available, trying PyTorch", level="WARNING")
        return train_pytorch_classifier(config, dataset_path, output_dir)

def train_pytorch_classifier(config: Dict, dataset_path: Optional[Path], output_dir: Path):
    """Train a simple PyTorch classifier."""
    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        import numpy as np
    except ImportError:
        log("PyTorch not available, using mock training", level="WARNING")
        return mock_training(config, output_dir)
    
    device = detect_device()
    device_info(device)
    
    # Generate synthetic data
    n_samples = config.get("n_samples", 1000)
    n_features = config.get("n_features", 10)
    hidden_dims = config.get("hidden_dims", [64, 32])
    epochs = config.get("epochs", 100)
    lr = config.get("learning_rate", 0.001)
    batch_size = config.get("batch_size", 32)
    
    X = np.random.randn(n_samples, n_features).astype(np.float32)
    y = (X.sum(axis=1) > 0).astype(np.int64)
    
    # Split
    split_idx = int(0.8 * n_samples)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    X_train = torch.tensor(X_train)
    y_train = torch.tensor(y_train)
    X_test = torch.tensor(X_test)
    y_test = torch.tensor(y_test)
    
    # Build model
    layers = []
    in_dim = n_features
    for h_dim in hidden_dims:
        layers.append(nn.Linear(in_dim, h_dim))
        layers.append(nn.ReLU())
        layers.append(nn.Dropout(config.get("dropout", 0.2)))
        in_dim = h_dim
    layers.append(nn.Linear(in_dim, 2))
    
    model = nn.Sequential(*layers)
    
    if device == "mps":
        model = model.to("mps")
        X_train = X_train.to("mps")
        y_train = y_train.to("mps")
        X_test = X_test.to("mps")
        y_test = y_test.to("mps")
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    # Training loop
    for epoch in range(epochs):
        model.train()
        
        # Mini-batch training
        perm = torch.randperm(len(X_train))
        total_loss = 0
        n_batches = 0
        
        for i in range(0, len(X_train), batch_size):
            idx = perm[i:i+batch_size]
            batch_x = X_train[idx]
            batch_y = y_train[idx]
            
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            n_batches += 1
        
        avg_loss = total_loss / n_batches
        
        # Evaluate
        model.eval()
        with torch.no_grad():
            train_preds = model(X_train).argmax(dim=1)
            test_preds = model(X_test).argmax(dim=1)
            train_acc = (train_preds == y_train).float().mean().item()
            test_acc = (test_preds == y_test).float().mean().item()
        
        metric("loss", avg_loss, epoch + 1)
        metric("train_accuracy", train_acc, epoch + 1)
        metric("test_accuracy", test_acc, epoch + 1)
        progress(epoch + 1, epochs)
        
        if (epoch + 1) % 10 == 0:
            log(f"Epoch {epoch+1}/{epochs}: loss={avg_loss:.4f}, train_acc={train_acc:.4f}, test_acc={test_acc:.4f}")
    
    # Save model
    model_dir = output_dir / "model"
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Move model to CPU for saving
    model = model.to("cpu")
    model_path = model_dir / "model.pt"
    torch.save(model.state_dict(), model_path)
    
    # Also save full model for easier loading
    full_model_path = model_dir / "model_full.pt"
    torch.save(model, full_model_path)
    
    # Create bundle
    create_model_bundle(
        model_dir=model_dir,
        model_path=model_path,
        name="pytorch_classifier",
        version="1.0.0",
        framework="pytorch",
        inputs_schema={"type": "tensor", "shape": [None, n_features], "dtype": "float32"},
        outputs_schema={"type": "tensor", "shape": [None, 2], "dtype": "float32"},
        requirements=["torch>=2.0.0", "numpy>=1.24.0"],
    )
    
    artifact("model", str(model_path), hash_file(model_path))
    
    log(f"Training complete. Final test accuracy: {test_acc:.4f}")
    metric("final_accuracy", test_acc, epochs)
    
    return True

def mock_training(config: Dict, output_dir: Path):
    """Mock training for when no ML libraries are available."""
    log("Running mock training (no ML libraries installed)")
    device_info("cpu")
    
    epochs = config.get("epochs", 10)
    
    for epoch in range(epochs):
        # Simulate training
        time.sleep(0.5)
        
        loss = 1.0 / (epoch + 1) + 0.1 * (0.5 - np.random.rand()) if 'np' in dir() else 1.0 / (epoch + 1)
        acc = min(0.99, 0.5 + epoch * 0.05)
        
        metric("loss", loss, epoch + 1)
        metric("accuracy", acc, epoch + 1)
        progress(epoch + 1, epochs)
        log(f"Epoch {epoch+1}/{epochs}: loss={loss:.4f}, accuracy={acc:.4f}")
    
    # Create mock model
    model_dir = output_dir / "model"
    model_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = model_dir / "model.bin"
    model_path.write_bytes(b"MOCK_MODEL_DATA")
    
    create_model_bundle(
        model_dir=model_dir,
        model_path=model_path,
        name="mock_model",
        version="1.0.0",
        framework="mock",
        inputs_schema={"type": "array", "shape": [None, 10], "dtype": "float32"},
        outputs_schema={"type": "array", "shape": [None], "dtype": "int32"},
        requirements=[],
    )
    
    artifact("model", str(model_path), hash_file(model_path))
    
    log("Mock training complete")
    return True

# ============= Main Entry Point =============

def main():
    parser = argparse.ArgumentParser(description="BabushkaML Training Runner")
    parser.add_argument("--run-id", required=True, help="Unique run identifier")
    parser.add_argument("--config", required=True, type=Path, help="Path to config JSON/YAML")
    parser.add_argument("--output-dir", required=True, type=Path, help="Output directory for artifacts")
    parser.add_argument("--dataset", type=Path, help="Path to dataset (optional)")
    parser.add_argument("--template", default="tabular", help="Training template to use")
    args = parser.parse_args()
    
    log(f"Starting run: {args.run_id}")
    log(f"Config: {args.config}")
    log(f"Output: {args.output_dir}")
    
    try:
        # Load config
        config_path = args.config
        if config_path.suffix in (".yaml", ".yml"):
            try:
                import yaml
                config = yaml.safe_load(config_path.read_text())
            except ImportError:
                log("PyYAML not installed, trying as JSON", level="WARNING")
                config = json.loads(config_path.read_text())
        else:
            config = json.loads(config_path.read_text())
        
        log(f"Loaded config: {json.dumps(config)}")
        
        # Create output directory
        args.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Write run logs
        log_path = args.output_dir / "logs.txt"
        
        # Run training based on template
        template = config.get("template", args.template)
        
        if template in ("tabular", "tabular_classifier"):
            success = train_tabular_classifier(config, args.dataset, args.output_dir)
        elif template in ("pytorch", "pytorch_classifier"):
            success = train_pytorch_classifier(config, args.dataset, args.output_dir)
        else:
            log(f"Unknown template: {template}, using mock", level="WARNING")
            success = mock_training(config, args.output_dir)
        
        if success:
            status("SUCCEEDED")
        else:
            status("FAILED", error="Training returned False")
            
    except Exception as e:
        log(f"Training failed: {e}", level="ERROR")
        log(traceback.format_exc(), level="ERROR")
        status("FAILED", error=str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()





