/**
 * Tauri Command Bindings
 * TypeScript types and functions for interacting with the Rust backend
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, Event } from '@tauri-apps/api/event';

// ============= Types =============

export interface WorkspaceInfo {
  path: string;
  initialized: boolean;
}

export interface Project {
  id: string;
  name: string;
  root_path: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  fingerprint: string;
  storage_mode: 'copy' | 'reference';
  manifest_path: string;
  size_bytes?: number;
  file_count?: number;
  created_at: string;
}

export interface Run {
  id: string;
  project_id: string;
  dataset_id?: string;
  name?: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  started_at?: string;
  ended_at?: string;
  config_path?: string;
  entrypoint?: string;
  error_summary?: string;
  device?: string;
  created_at: string;
}

export interface Model {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ModelVersion {
  id: string;
  model_id: string;
  run_id?: string;
  version: string;
  stage: 'draft' | 'staging' | 'production' | 'archived';
  artifact_path: string;
  provenance_json?: string;
  metrics_json?: string;
  created_at: string;
  promoted_at?: string;
}

export interface Export {
  id: string;
  project_id: string;
  model_version_id: string;
  export_type: 'zip' | 'docker_context' | 'docker_image';
  path: string;
  created_at: string;
}

export interface GlobalModel {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  description?: string;
  stage: string;
  version: string;
  version_id: string;
  artifact_path?: string;
  created_at: string;
}

export interface ImportDatasetRequest {
  project_id: string;
  name: string;
  source_path: string;
  copy: boolean;
}

export interface StartRunRequest {
  project_id: string;
  dataset_id?: string;
  name?: string;
  config: Record<string, unknown>;
  entrypoint?: string;
}

export interface RegisterModelRequest {
  project_id: string;
  run_id: string;
  name: string;
  version: string;
  description?: string;
}

export interface ExportRequest {
  project_id: string;
  model_version_id: string;
  export_type: 'zip' | 'docker_context';
}

export interface ExportResult {
  id: string;
  path: string;
  export_type: string;
}

export interface PredictRequest {
  model_version_id: string;
  features: number[][];
}

export interface PredictResponse {
  predictions: number[];
  probabilities?: number[][];
  model_name: string;
  latency_ms: number;
  error?: string;
}

// ============= Check if running in Tauri =============

export const isTauri = (() => {
  if (typeof window === 'undefined') return false;
  
  // Tauri v2 uses __TAURI_INTERNALS__
  if ('__TAURI_INTERNALS__' in window) return true;
  
  // Tauri v1 uses __TAURI__
  if ('__TAURI__' in window) return true;
  
  // Check for Tauri IPC
  if ('__TAURI_IPC__' in window) return true;
  
  // Check if we can detect via user agent
  if (navigator.userAgent.includes('Tauri')) return true;
  
  // Check if protocol is tauri:
  if (window.location.protocol === 'tauri:') return true;
  
  // Check for custom origin that Tauri uses
  if (window.location.origin === 'tauri://localhost') return true;
  
  return false;
})();

// ============= Workspace Commands =============

export async function openWorkspace(path: string): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>('open_workspace', { path });
}

export async function getWorkspace(): Promise<WorkspaceInfo | null> {
  return invoke<WorkspaceInfo | null>('get_workspace');
}

// ============= Project Commands =============

export async function createProject(name: string, description?: string): Promise<Project> {
  return invoke<Project>('create_project', { name, description });
}

export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>('list_projects');
}

export async function getProject(id: string): Promise<Project | null> {
  return invoke<Project | null>('get_project', { id });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke('delete_project', { id });
}

// ============= Dataset Commands =============

export async function importDataset(request: ImportDatasetRequest): Promise<Dataset> {
  return invoke<Dataset>('import_dataset_cmd', { request });
}

export async function listDatasets(projectId: string): Promise<Dataset[]> {
  return invoke<Dataset[]>('list_datasets', { projectId });
}

// ============= Run Commands =============

export async function startRun(request: StartRunRequest): Promise<Run> {
  return invoke<Run>('start_run', { request });
}

export async function listRuns(projectId: string): Promise<Run[]> {
  return invoke<Run[]>('list_runs', { projectId });
}

export async function cancelRun(runId: string): Promise<void> {
  return invoke('cancel_run', { runId });
}

// ============= Model Registry Commands =============

export async function registerModel(request: RegisterModelRequest): Promise<ModelVersion> {
  return invoke<ModelVersion>('register_model', { request });
}

export async function promoteModel(versionId: string, stage: string): Promise<void> {
  return invoke('promote_model', { versionId, stage });
}

export async function listModels(projectId: string): Promise<Model[]> {
  return invoke<Model[]>('list_models', { projectId });
}

export async function listModelVersions(modelId: string): Promise<ModelVersion[]> {
  return invoke<ModelVersion[]>('list_model_versions', { modelId });
}

export async function listAllModels(): Promise<GlobalModel[]> {
  return invoke<GlobalModel[]>('list_all_models');
}

// ============= Inference Commands =============

export async function localPredict(request: PredictRequest): Promise<PredictResponse> {
  return invoke<PredictResponse>('local_predict', { request });
}

// ============= Export Commands =============

export async function exportModel(request: ExportRequest): Promise<ExportResult> {
  return invoke<ExportResult>('export_model', { request });
}

export async function listExports(projectId: string): Promise<Export[]> {
  return invoke<Export[]>('list_exports', { projectId });
}

// ============= Training Script Commands =============

export interface SaveScriptRequest {
  project_id: string;
  name: string;
  content: string;
}

export async function saveTrainingScript(request: SaveScriptRequest): Promise<string> {
  return invoke<string>('save_training_script', { request });
}

export async function loadTrainingScript(projectId: string, name: string): Promise<string> {
  return invoke<string>('load_training_script', { projectId, name });
}

export async function listTrainingScripts(projectId: string): Promise<string[]> {
  return invoke<string[]>('list_training_scripts', { projectId });
}

export async function deleteTrainingScript(projectId: string, name: string): Promise<void> {
  return invoke('delete_training_script', { projectId, name });
}

// ============= Event Listeners =============

export async function onRunStarted(callback: (event: { run_id: string; project_id: string }) => void) {
  return listen('run-started', (event: Event<{ run_id: string; project_id: string }>) => {
    callback(event.payload);
  });
}

export async function onRunLog(callback: (event: { run_id: string; level: string; message: string; ts: string }) => void) {
  return listen('run-log', (event: Event<{ run_id: string; level: string; message: string; ts: string }>) => {
    callback(event.payload);
  });
}

export async function onRunMetric(callback: (event: { run_id: string; key: string; value: number; step: number; ts: string }) => void) {
  return listen('run-metric', (event: Event<{ run_id: string; key: string; value: number; step: number; ts: string }>) => {
    callback(event.payload);
  });
}

export async function onRunProgress(callback: (event: { run_id: string; current: number; total: number; ts: string }) => void) {
  return listen('run-progress', (event: Event<{ run_id: string; current: number; total: number; ts: string }>) => {
    callback(event.payload);
  });
}

export async function onRunStatus(callback: (event: { run_id: string; status: string; error?: string; ts: string }) => void) {
  return listen('run-status', (event: Event<{ run_id: string; status: string; error?: string; ts: string }>) => {
    callback(event.payload);
  });
}

export async function onRunError(callback: (event: { run_id: string; error: string }) => void) {
  return listen('run-error', (event: Event<{ run_id: string; error: string }>) => {
    callback(event.payload);
  });
}

export async function onRunCompleted(callback: (event: { run_id: string; project_id: string; status: string; error?: string }) => void) {
  return listen('run-completed', (event: Event<{ run_id: string; project_id: string; status: string; error?: string }>) => {
    callback(event.payload);
  });
}

// ============= File Dialog (via Tauri Dialog Plugin) =============

export async function selectFolder(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result: string | string[] | null = await open({
      directory: true,
      multiple: false,
      title: 'Select Dataset Folder',
    }) as string | string[] | null;
    
    if (result === null) {
      return null; // User cancelled
    }
    
    // Handle both single result and array result
    if (typeof result === 'string') {
      return result;
    }
    
    // Handle array result
    if (Array.isArray(result)) {
      if (result.length > 0 && typeof result[0] === 'string') {
        return result[0];
      }
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('Error opening folder dialog:', error);
    throw new Error(`Failed to open folder dialog: ${error}`);
  }
}

export async function selectFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      directory: false,
      multiple: false,
      title: 'Select File',
      filters,
    });
    return result as string | null;
  } catch {
    return null;
  }
}
