# MLOps Workbench

A **local-first** MLOps platform for macOS that runs completely offline. Train models, manage datasets, and deploy without cloud dependencies.

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI framework |
| **TypeScript** | 5.9.3 | Type-safe JavaScript |
| **Vite** | 7.2.4 | Build tool & dev server |
| **Tailwind CSS** | 4.1.18 | Utility-first CSS framework |
| **Framer Motion** | 12.23.26 | Animation library |
| **Recharts** | 3.6.0 | Charting library for metrics visualization |
| **Radix UI** | Various | Accessible component primitives |
| **Lucide React** | 0.562.0 | Icon library |
| **Class Variance Authority** | 0.7.1 | Component variant management |
| **clsx** | 2.1.1 | Conditional class names |
| **tailwind-merge** | 3.4.0 | Merge Tailwind classes |

#### Frontend Architecture
- **Component-based**: Modular React components with TypeScript
- **State Management**: React hooks (useState, useEffect, useContext)
- **Routing**: Client-side routing via React Router (implied)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build System**: Vite with HMR (Hot Module Replacement)

### Backend (Tauri/Rust)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tauri** | 2.0 | Desktop app framework |
| **Rust** | 2021 Edition | Systems programming language |
| **Tokio** | 1.x | Async runtime for Rust |
| **SQLite (rusqlite)** | 0.31 | Embedded database |
| **Serde** | 1.x | Serialization framework |
| **Chrono** | 0.4 | Date/time handling |
| **UUID** | 1.x | Unique identifier generation |
| **SHA2** | 0.10 | Cryptographic hashing |
| **Walkdir** | 2.x | Directory traversal |
| **Zip** | 0.6 | Archive creation |
| **ThisError** | 1.x | Error handling |

#### Tauri Plugins
- `tauri-plugin-shell`: Execute system commands
- `tauri-plugin-http`: HTTP client
- `tauri-plugin-dialog`: File/folder dialogs
- `tauri-plugin-fs`: File system operations

### Python Runtime

| Technology | Purpose |
|------------|---------|
| **Python 3** | Training script execution |
| **NumPy** | Numerical computing |
| **scikit-learn** | Machine learning algorithms |
| **PyTorch** (optional) | Deep learning framework |
| **ONNX Runtime** (optional) | Model inference |
| **FastAPI** (export) | Inference server framework |
| **Uvicorn** (export) | ASGI server |

### Mobile Support (Capacitor)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Capacitor** | 6.2.1 | Cross-platform mobile framework |
| **Capacitor iOS** | 6.2.1 | iOS native integration |
| **Capacitor Filesystem** | 6.0.4 | File system access |
| **Capacitor Network** | 6.0.4 | Network status |
| **Capacitor Preferences** | 6.0.4 | Key-value storage |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | 9.39.1 | JavaScript/TypeScript linter |
| **TypeScript ESLint** | 8.46.4 | TypeScript-specific linting |
| **React ESLint Plugins** | Various | React-specific linting rules |
| **Node.js** | 20.19+ / 22.12+ | JavaScript runtime |
| **npm** | Latest | Package manager |

### Containerization

| Technology | Purpose |
|------------|---------|
| **Docker** | Container runtime for training |
| **Docker Hub** | Image registry integration |

### Platform Support

- **macOS**: Primary platform (Tauri desktop app)
- **iOS**: Mobile support via Capacitor
- **Web**: Browser-based interface (development mode)

### Database

- **SQLite**: Embedded relational database
  - Projects, datasets, runs, models, exports
  - Local-first, no external dependencies

### Communication Protocols

- **Tauri IPC**: Frontend ↔ Backend communication
- **JSONL**: Python → Rust event streaming
- **WebSocket**: Real-time updates (optional backend mode)
- **REST API**: HTTP endpoints (optional backend mode)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MLOps Workbench                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         React Frontend (Vite)                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Dashboard │ │ Models   │ │Workbench │ │ Training │ │ Settings │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                              │                                       │   │
│  │                    Tauri IPC (invoke/listen)                        │   │
│  └──────────────────────────────┼──────────────────────────────────────┘   │
│                                 │                                           │
│  ┌──────────────────────────────┼──────────────────────────────────────┐   │
│  │                     Rust Backend (Tauri v2)                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │  Workspace  │ │   Runner    │ │   Database  │ │   Export    │   │   │
│  │  │  Manager    │ │  Supervisor │ │   (SQLite)  │ │   Engine    │   │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │   │
│  │         │               │               │               │          │   │
│  └─────────┼───────────────┼───────────────┼───────────────┼──────────┘   │
│            │               │               │               │               │
│  ┌─────────▼───────────────▼───────────────▼───────────────▼──────────┐   │
│  │                        File System Layer                            │   │
│  │  ~/MLOpsWorkspace/                                                  │   │
│  │  ├── mlops.db              # SQLite database                       │   │
│  │  └── projects/                                                      │   │
│  │      └── my-project/                                                │   │
│  │          ├── datasets/     # Imported data files                   │   │
│  │          ├── runs/         # Training run outputs                  │   │
│  │          ├── models/       # Registered model artifacts            │   │
│  │          └── exports/      # Zip/Docker exports                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Python Runtime (Bundled)                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │   │
│  │  │ runner.py    │ │ sklearn      │ │ PyTorch      │                │   │
│  │  │ (trainer)    │ │ templates    │ │ templates    │                │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + Vite + TypeScript)

| Component | Purpose |
|-----------|---------|
| `Dashboard` | System overview, metrics, status |
| `Models` | Model listing, deployment, predictions |
| `Workbench` | **Local-first** project/dataset/training management |
| `Training Console` | Real-time logs, metrics, progress |
| `Settings` | Compute mode, theme, user preferences |

### Rust Backend (Tauri v2)

| Module | File | Responsibility |
|--------|------|----------------|
| `workspace` | `src/workspace.rs` | File system ops, directory structure, hashing |
| `db` | `src/db.rs` | SQLite schema, CRUD for projects/runs/models |
| `runner` | `src/runner.rs` | Python process supervisor, event streaming |
| `lib` | `src/lib.rs` | Tauri commands, state management |

### Data Flow

```
User Action          Tauri Command         Rust Handler          Side Effects
─────────────        ─────────────         ────────────          ────────────
Start Training  ──►  invoke("start_run")  ──►  start_run()   ──►  SQLite insert
                                               │                   Python spawn
                                               ▼                   
                                          execute_python_training()
                                               │
                                               ▼
                                          Stream stdout (JSONL)
                                               │
    ◄─────────────────────────────────────────┘
    emit("run-log", {...})
    emit("run-metric", {...})
    emit("run-status", {...})
```

### Event Protocol (Python → Rust → UI)

Python runner outputs JSONL to stdout:

```json
{"type": "log", "level": "INFO", "message": "Starting epoch 1...", "ts": "..."}
{"type": "metric", "key": "loss", "value": 0.5432, "step": 1, "ts": "..."}
{"type": "progress", "current": 10, "total": 100, "ts": "..."}
{"type": "status", "state": "succeeded", "ts": "..."}
{"type": "artifact", "kind": "model", "path": "/path/to/model.pkl", "sha256": "..."}
```

Rust parses and emits as Tauri events → React listens and updates UI.

## Database Schema

```sql
-- Projects table
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

-- Datasets table
CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    fingerprint TEXT,  -- SHA256 hash
    size_bytes INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Runs table
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dataset_id TEXT,
    name TEXT,
    status TEXT DEFAULT 'pending',  -- pending, running, succeeded, failed, cancelled
    config_path TEXT,
    started_at TEXT,
    ended_at TEXT,
    device TEXT,  -- cpu, mps, cuda
    entrypoint TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Models table
CREATE TABLE models (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Model versions table  
CREATE TABLE model_versions (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    run_id TEXT,
    version TEXT NOT NULL,
    stage TEXT DEFAULT 'draft',  -- draft, staging, production, archived
    artifact_path TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (model_id) REFERENCES models(id),
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

-- Exports table
CREATE TABLE exports (
    id TEXT PRIMARY KEY,
    model_version_id TEXT NOT NULL,
    export_type TEXT NOT NULL,  -- zip, docker
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (model_version_id) REFERENCES model_versions(id)
);
```

## Getting Started

### Prerequisites

#### Required
- **Bun** 1.0+ (recommended) or **Node.js** 20.19+ or 22.12+ - JavaScript runtime
- **Rust** (latest stable) - for Tauri backend
- **Python 3.9+** with:
  - `numpy` >= 1.24.0
  - `scikit-learn` >= 1.3.0
- **Xcode Command Line Tools** (macOS) - for native builds
- **Docker** (optional) - for containerized training

#### Optional
- **PyTorch** >= 2.0.0 - for deep learning templates
- **ONNX Runtime** >= 1.16.0 - for ONNX model inference
- **Xcode** (full IDE) - for iOS development

### Development

```bash
# Install dependencies (using Bun)
bun install

# Start development server (web only)
bun run dev

# Start Tauri development (macOS app)
bun run macos:dev
```

### Build

```bash
# Build web frontend
bun run build

# Build macOS app bundle
bun run macos:build
```

**Note**: This project uses **Bun** as the package manager. If you prefer npm, you can still use `npm install` and `npm run <script>`, but Bun is recommended for faster performance.

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Models.tsx
│   │   ├── Workbench.tsx  # ★ Local-first MLOps
│   │   └── ...
│   ├── lib/
│   │   └── tauri.ts     # Tauri API bindings
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs       # Tauri commands
│   │   ├── db.rs        # SQLite operations
│   │   ├── workspace.rs # File system management
│   │   └── runner.rs    # Python process supervisor
│   ├── python/
│   │   └── runner.py    # Training script runner
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## Features

### ✅ Implemented Features

#### Core Functionality
- [x] Workspace selection and SQLite initialization
- [x] Project management (create, list, delete)
- [x] Dataset import with SHA256 fingerprinting
- [x] Training execution with Python runner
- [x] Real-time log/metric streaming via JSONL
- [x] Model registry with version tracking
- [x] Stage promotion (draft → staging → production)
- [x] Export as ZIP or Docker context

#### Training Features
- [x] Multiple training methods (Local Python, Docker)
- [x] Docker image browser with popular ML images
- [x] Docker image pull functionality
- [x] Training templates (tabular, PyTorch)
- [x] Real-time progress tracking
- [x] Enhanced console logging with grouping and filtering

#### UI/UX Features
- [x] Modern, responsive UI with Tailwind CSS
- [x] Dark/light theme support
- [x] Animated transitions with Framer Motion
- [x] Real-time metrics visualization with Recharts
- [x] Enhanced console viewer with search and filtering
- [x] Toast notifications
- [x] Loading states and error handling

#### Developer Experience
- [x] TypeScript for type safety
- [x] ESLint for code quality
- [x] Hot Module Replacement (HMR)
- [x] Comprehensive logging system
- [x] React hooks for state management

### 🔜 Planned Features

- [ ] Additional training templates (TensorFlow, XGBoost)
- [ ] Hyperparameter sweep support
- [ ] Model comparison UI
- [ ] Inference API server
- [ ] Cloud sync (optional)
- [ ] Experiment tracking enhancements
- [ ] Model versioning with Git integration
- [ ] Automated testing suite

## Key Technologies Summary

### Why This Stack?

- **Tauri + React**: Modern desktop app with web technologies, smaller bundle size than Electron
- **Rust Backend**: Performance, memory safety, and system-level access
- **SQLite**: Zero-configuration database, perfect for local-first apps
- **Python Runtime**: Industry-standard ML ecosystem
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS**: Rapid UI development with utility classes
- **Docker Support**: Reproducible training environments

### Architecture Highlights

1. **Local-First**: All data stored locally, no cloud dependencies
2. **Event-Driven**: JSONL streaming for real-time updates
3. **Type-Safe**: TypeScript frontend + Rust backend
4. **Modular**: Component-based React architecture
5. **Cross-Platform**: macOS desktop + iOS mobile + web

## Contributing

This project uses:
- **TypeScript** for type safety
- **ESLint** for code quality
- **Conventional commits** (recommended)
- **Component-based architecture** for React

## License

MIT
