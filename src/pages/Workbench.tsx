/**
 * Workbench Page - Local-first ML using BabushkaML Tauri backend
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  Plus,
  Database,
  Play,
  Package,
  Download,
  Upload,
  ChevronRight,
  ChevronDown,
  Box,
  FileJson,
  Layers,
  Archive,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  isTauri,
  openWorkspace,
  getWorkspace,
  createProject,
  listProjects,
  listDatasets,
  listRuns,
  listModels,
  listModelVersions,
  listExports,
  importDataset,
  startRun,
  registerModel,
  promoteModel,
  exportModel,
  selectFolder,
  onRunLog,
  onRunMetric,
  onRunProgress,
  onRunStatus,
  onRunCompleted,
  type WorkspaceInfo,
  type Project,
  type Dataset,
  type Run,
  type Model,
  type ModelVersion,
  type Export,
} from '@/lib/tauri';

// ============= Types =============

type ViewMode = 'projects' | 'project-detail' | 'training-console';

interface ProjectWithStats extends Project {
  datasetCount?: number;
  runCount?: number;
  modelCount?: number;
}

interface TrainingLog {
  level: string;
  message: string;
  ts: string;
}

interface TrainingMetric {
  key: string;
  value: number;
  step: number;
  ts: string;
}

// ============= Status Badge Component =============

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    pending: { icon: <Clock className="w-3 h-3" />, className: 'bg-yellow-500/20 text-yellow-400' },
    running: { icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'bg-blue-500/20 text-blue-400' },
    succeeded: { icon: <CheckCircle className="w-3 h-3" />, className: 'bg-green-500/20 text-green-400' },
    failed: { icon: <XCircle className="w-3 h-3" />, className: 'bg-red-500/20 text-red-400' },
    cancelled: { icon: <XCircle className="w-3 h-3" />, className: 'bg-gray-500/20 text-gray-400' },
    draft: { icon: <FileJson className="w-3 h-3" />, className: 'bg-gray-500/20 text-gray-400' },
    staging: { icon: <Layers className="w-3 h-3" />, className: 'bg-yellow-500/20 text-yellow-400' },
    production: { icon: <CheckCircle className="w-3 h-3" />, className: 'bg-green-500/20 text-green-400' },
    archived: { icon: <Archive className="w-3 h-3" />, className: 'bg-gray-500/20 text-gray-400' },
  };
  
  const { icon, className } = config[status] || config.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {icon}
      {status}
    </span>
  );
}

// ============= Stage Selector Component =============

function StageSelector({ currentStage, onPromote }: { currentStage: string; onPromote: (stage: string) => void }) {
  const stages = ['draft', 'staging', 'production', 'archived'];
  const currentIndex = stages.indexOf(currentStage);
  
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => (
        <button
          key={stage}
          onClick={() => index > currentIndex && onPromote(stage)}
          disabled={index <= currentIndex}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            index === currentIndex
              ? 'bg-primary text-primary-foreground'
              : index < currentIndex
              ? 'bg-muted text-muted-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
          }`}
        >
          {stage}
        </button>
      ))}
    </div>
  );
}

// ============= Main Workbench Component =============

export default function Workbench() {
  // Workspace state
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Data state
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelVersions, setModelVersions] = useState<Record<string, ModelVersion[]>>({});
  const [exports, setExports] = useState<Export[]>([]);
  
  // UI state
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewRun, setShowNewRun] = useState(false);
  
  // Training console state
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([]);
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetric[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<{ current: number; total: number } | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  
  // Set up event listeners for training
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    const setupListeners = async () => {
      // Log events
      const unsubLog = await onRunLog((event) => {
        if (event.run_id === activeRunId) {
          setTrainingLogs((prev) => [...prev.slice(-200), event]); // Keep last 200 logs
        }
      });
      unsubscribers.push(unsubLog);
      
      // Metric events
      const unsubMetric = await onRunMetric((event) => {
        if (event.run_id === activeRunId) {
          setTrainingMetrics((prev) => [...prev, event]);
        }
      });
      unsubscribers.push(unsubMetric);
      
      // Progress events
      const unsubProgress = await onRunProgress((event) => {
        if (event.run_id === activeRunId) {
          setTrainingProgress({ current: event.current, total: event.total });
        }
      });
      unsubscribers.push(unsubProgress);
      
      // Status events
      const unsubStatus = await onRunStatus((event) => {
        if (event.run_id === activeRunId) {
          setTrainingStatus(event.status);
          if (event.status === 'succeeded' || event.status === 'failed') {
            // Training completed, refresh runs list
            if (selectedProject) {
              loadProjectDetails(selectedProject);
            }
          }
        }
      });
      unsubscribers.push(unsubStatus);
      
      // Completed events
      const unsubCompleted = await onRunCompleted((event) => {
        if (event.run_id === activeRunId && selectedProject) {
          loadProjectDetails(selectedProject);
        }
      });
      unsubscribers.push(unsubCompleted);
    };
    
    if (activeRunId) {
      setupListeners();
    }
    
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [activeRunId, selectedProject]);
  
  // Check if running in Tauri
  useEffect(() => {
    // Debug log
    console.log('Tauri detection:', {
      isTauri,
      hasInternals: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
      hasTauri: typeof window !== 'undefined' && '__TAURI__' in window,
      hasIpc: typeof window !== 'undefined' && '__TAURI_IPC__' in window,
      windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('TAURI')) : [],
    });
    
    // Try to use Tauri API directly to check if it works
    getWorkspace()
      .then((ws) => {
        // If we get here, Tauri is working!
        console.log('Tauri API works! Workspace:', ws);
        if (ws) {
          setWorkspace(ws);
          loadProjects();
        }
        setLoading(false);
      })
      .catch((e) => {
        console.log('Tauri API error:', e);
        // If the error is about invoke not being available, we're not in Tauri
        if (e.message?.includes('invoke') || e.message?.includes('not a function')) {
          setError('Workbench requires the desktop app. Please run with: bun run macos:dev');
        } else {
          // Other error - Tauri is working but something else went wrong
          // This is fine, just means no workspace is open yet
          setError(null);
        }
        setLoading(false);
      });
  }, []);
  
  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const projectList = await listProjects();
      
      // Load stats for each project
      const projectsWithStats: ProjectWithStats[] = await Promise.all(
        projectList.map(async (p) => {
          try {
            const [ds, rs, ms] = await Promise.all([
              listDatasets(p.id),
              listRuns(p.id),
              listModels(p.id),
            ]);
            return {
              ...p,
              datasetCount: ds.length,
              runCount: rs.length,
              modelCount: ms.length,
            };
          } catch {
            return { ...p, datasetCount: 0, runCount: 0, modelCount: 0 };
          }
        })
      );
      
      setProjects(projectsWithStats);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  
  // Load project details
  const loadProjectDetails = useCallback(async (project: Project) => {
    try {
      const [ds, rs, ms, ex] = await Promise.all([
        listDatasets(project.id),
        listRuns(project.id),
        listModels(project.id),
        listExports(project.id),
      ]);
      
      setDatasets(ds);
      setRuns(rs);
      setModels(ms);
      setExports(ex);
      
      // Load versions for each model
      const versions: Record<string, ModelVersion[]> = {};
      for (const model of ms) {
        versions[model.id] = await listModelVersions(model.id);
      }
      setModelVersions(versions);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  
  // Select workspace
  const handleSelectWorkspace = async () => {
    try {
      const path = await selectFolder();
      if (path) {
        const ws = await openWorkspace(path);
        setWorkspace(ws);
        await loadProjects();
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Create project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      await createProject(newProjectName, undefined);
      setNewProjectName('');
      setShowNewProject(false);
      await loadProjects();
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Select project
  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    setViewMode('project-detail');
    await loadProjectDetails(project);
  };
  
  // Import dataset
  const handleImportDataset = async () => {
    if (!selectedProject) return;
    
    try {
      const path = await selectFolder();
      if (path) {
        const name = path.split('/').pop() || 'Dataset';
        await importDataset({
          project_id: selectedProject.id,
          name,
          source_path: path,
          copy: true,
        });
        await loadProjectDetails(selectedProject);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Start training run
  const handleStartRun = async () => {
    if (!selectedProject) return;
    
    try {
      const config = {
        template: 'tabular_classifier',
        n_estimators: 100,
        max_depth: 10,
        epochs: 50,
        learning_rate: 0.001,
        hidden_dims: [64, 32],
        batch_size: 32,
      };
      
      const run = await startRun({
        project_id: selectedProject.id,
        dataset_id: datasets[0]?.id,
        name: `Run ${runs.length + 1}`,
        config,
      });
      
      // Reset training state and switch to console view
      setTrainingLogs([]);
      setTrainingMetrics([]);
      setTrainingProgress(null);
      setTrainingStatus('running');
      setActiveRunId(run.id);
      setShowNewRun(false);
      setViewMode('training-console');
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Register model from run
  const handleRegisterModel = async (run: Run) => {
    if (!selectedProject) return;
    
    try {
      const modelName = run.name || `Model from ${run.id.slice(0, 8)}`;
      await registerModel({
        project_id: selectedProject.id,
        run_id: run.id,
        name: modelName,
        version: '1.0.0',
      });
      await loadProjectDetails(selectedProject);
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Promote model version
  const handlePromoteVersion = async (versionId: string, stage: string) => {
    try {
      await promoteModel(versionId, stage);
      if (selectedProject) {
        await loadProjectDetails(selectedProject);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Export model
  const handleExportModel = async (versionId: string, type: 'zip' | 'docker_context') => {
    if (!selectedProject) return;
    
    try {
      const result = await exportModel({
        project_id: selectedProject.id,
        model_version_id: versionId,
        export_type: type,
      });
      alert(`Exported to: ${result.path}`);
      await loadProjectDetails(selectedProject);
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  // Toggle model expansion
  const toggleModelExpanded = (modelId: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };
  
  // ============= Render =============
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Show desktop app required message only if specifically detected as not Tauri
  if (error?.includes('desktop app')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Cpu className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Desktop App Required</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The Workbench feature requires the native desktop app for local training and model management.
        </p>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm">
          bun run macos:dev
        </div>
      </div>
    );
  }
  
  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <FolderOpen className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Select Workspace</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Choose a folder to store your projects, datasets, runs, and models.
            This folder will be your local BabushkaML workspace.
          </p>
          <Button onClick={handleSelectWorkspace} size="lg" className="gap-2">
            <Folder className="w-5 h-5" />
            Select Workspace Folder
          </Button>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(viewMode === 'project-detail' || viewMode === 'training-console') && (
            <Button variant="ghost" size="sm" onClick={() => {
              if (viewMode === 'training-console') {
                setViewMode('project-detail');
                setActiveRunId(null);
              } else {
                setViewMode('projects');
              }
            }}>
              ← Back
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="w-4 h-4" />
            <span className="font-mono">{workspace.path}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => loadProjects()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg flex items-center justify-between"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'projects' ? (
          // Projects list
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* New Project Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="h-full border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group">
                {showNewProject ? (
                  <CardContent className="p-4 flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                        Create
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent
                    className="p-6 flex flex-col items-center justify-center h-full min-h-[150px] text-muted-foreground group-hover:text-primary"
                    onClick={() => setShowNewProject(true)}
                  >
                    <Plus className="w-10 h-10 mb-2" />
                    <span className="font-medium">New Project</span>
                  </CardContent>
                )}
              </Card>
            </motion.div>
            
            {/* Project Cards */}
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="h-full hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleSelectProject(project)}
                >
                  <CardHeader title={project.name} />
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {project.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" /> {project.datasetCount} datasets
                      </span>
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" /> {project.runCount} runs
                      </span>
                      <span className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> {project.modelCount} models
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : viewMode === 'project-detail' ? (
          // Project detail view
          selectedProject ? (
            <div className="space-y-6">
              {/* Project header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
                  <p className="text-muted-foreground">{selectedProject.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleImportDataset}>
                    <Upload className="w-4 h-4 mr-2" /> Import Dataset
                  </Button>
                  <Button size="sm" onClick={() => setShowNewRun(true)}>
                    <Play className="w-4 h-4 mr-2" /> Start Training
                  </Button>
                </div>
              </div>
              
              {/* Training run dialog */}
              <AnimatePresence>
                {showNewRun && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-card border border-border rounded-lg p-4"
                  >
                    <h3 className="font-semibold mb-3">Start Training Run</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will start a local training run using the tabular classifier template.
                      {datasets.length === 0 && ' No datasets found - synthetic data will be used.'}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleStartRun}>
                        <Play className="w-4 h-4 mr-2" /> Start Run
                      </Button>
                      <Button variant="ghost" onClick={() => setShowNewRun(false)}>
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Datasets section */}
              <Card>
                <CardHeader title={`Datasets (${datasets.length})`} />
                <CardContent className="p-4 pt-0">
                  {datasets.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No datasets yet. Import a dataset folder to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {datasets.map((ds) => (
                        <div
                          key={ds.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-primary" />
                            <div>
                              <div className="font-medium">{ds.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {ds.file_count} files · {((ds.size_bytes || 0) / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {ds.fingerprint.slice(0, 12)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Runs section */}
              <Card>
                <CardHeader title={`Training Runs (${runs.length})`} />
                <CardContent className="p-4 pt-0">
                  {runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No training runs yet. Start a training run to create models.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Play className="w-5 h-5 text-primary" />
                            <div>
                              <div className="font-medium">{run.name || `Run ${run.id.slice(0, 8)}`}</div>
                              <div className="text-xs text-muted-foreground">
                                {run.device && <span className="mr-2">Device: {run.device}</span>}
                                {new Date(run.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={run.status} />
                            {run.status === 'succeeded' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRegisterModel(run)}
                              >
                                <Package className="w-4 h-4 mr-1" /> Register
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Models section */}
              <Card>
                <CardHeader title={`Model Registry (${models.length})`} />
                <CardContent className="p-4 pt-0">
                  {models.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No models registered yet. Complete a training run and register the model.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {models.map((model) => (
                        <div key={model.id} className="border border-border rounded-lg overflow-hidden">
                          <div
                            className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer"
                            onClick={() => toggleModelExpanded(model.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedModels.has(model.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <Box className="w-5 h-5 text-primary" />
                              <span className="font-medium">{model.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {(modelVersions[model.id] || []).length} versions
                            </span>
                          </div>
                          
                          <AnimatePresence>
                            {expandedModels.has(model.id) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 space-y-2 bg-background">
                                  {(modelVersions[model.id] || []).map((version) => (
                                    <div
                                      key={version.id}
                                      className="flex items-center justify-between p-2 bg-muted/20 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm">v{version.version}</span>
                                        <StatusBadge status={version.stage} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <StageSelector
                                          currentStage={version.stage}
                                          onPromote={(stage) => handlePromoteVersion(version.id, stage)}
                                        />
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleExportModel(version.id, 'zip')}
                                          title="Export as ZIP"
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleExportModel(version.id, 'docker_context')}
                                          title="Export Docker context"
                                        >
                                          <Package className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Exports section */}
              {exports.length > 0 && (
                <Card>
                  <CardHeader title={`Exports (${exports.length})`} />
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2">
                      {exports.map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {exp.export_type === 'zip' ? (
                              <Archive className="w-5 h-5 text-primary" />
                            ) : (
                              <Package className="w-5 h-5 text-primary" />
                            )}
                            <div>
                              <div className="font-medium">{exp.export_type}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {exp.path}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(exp.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null
        ) : viewMode === 'training-console' ? (
          // Training console view
          <div className="space-y-4">
            <Card>
              <CardHeader title={`Training Run: ${activeRunId?.slice(0, 8)}...`} />
              <CardContent className="p-4 pt-0">
                {/* Progress bar */}
                {trainingProgress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{trainingProgress.current} / {trainingProgress.total}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(trainingProgress.current / trainingProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <StatusBadge status={trainingStatus || 'pending'} />
                </div>
                
                {/* Metrics */}
                {trainingMetrics.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Latest Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(
                        trainingMetrics.reduce((acc, m) => {
                          acc[m.key] = m;
                          return acc;
                        }, {} as Record<string, TrainingMetric>)
                      ).map(([key, metric]) => (
                        <div key={key} className="bg-muted/30 rounded-lg p-2">
                          <div className="text-xs text-muted-foreground">{key}</div>
                          <div className="text-lg font-mono">{metric.value.toFixed(4)}</div>
                          <div className="text-xs text-muted-foreground">step {metric.step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Logs */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Logs</h4>
                  <div className="bg-black/50 rounded-lg p-3 h-64 overflow-auto font-mono text-xs">
                    {trainingLogs.length === 0 ? (
                      <div className="text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for logs...
                      </div>
                    ) : (
                      trainingLogs.map((log, i) => (
                        <div
                          key={i}
                          className={`py-0.5 ${
                            log.level === 'ERROR' ? 'text-red-400' :
                            log.level === 'WARNING' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}
                        >
                          <span className="text-muted-foreground">[{log.level}]</span> {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                {(trainingStatus === 'succeeded' || trainingStatus === 'failed') && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        setViewMode('project-detail');
                        setActiveRunId(null);
                        if (selectedProject) loadProjectDetails(selectedProject);
                      }}
                    >
                      Back to Project
                    </Button>
                    {trainingStatus === 'succeeded' && activeRunId && (
                      <Button variant="secondary" onClick={async () => {
                        if (!selectedProject || !activeRunId) return;
                        try {
                          await registerModel({
                            project_id: selectedProject.id,
                            run_id: activeRunId,
                            name: `Model from Run ${activeRunId.slice(0, 8)}`,
                            version: '1.0.0',
                          });
                          setViewMode('project-detail');
                          setActiveRunId(null);
                          await loadProjectDetails(selectedProject);
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}>
                        <Package className="w-4 h-4 mr-2" /> Register Model
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

