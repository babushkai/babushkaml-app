/**
 * Docker Service
 * Handles Docker operations via Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';

export interface DockerPullRequest {
  image: string;
  tag: string;
}

export interface DockerPullResponse {
  message: string;
}

/**
 * Pull a Docker image
 */
export async function pullDockerImage(
  image: string,
  tag: string
): Promise<string> {
  return await invoke<string>('pull_docker_image', {
    request: { image, tag },
  });
}

/**
 * List all pulled Docker images
 */
export async function listDockerImages(): Promise<string[]> {
  return await invoke<string[]>('list_docker_images');
}

/**
 * Check if a Docker image exists locally
 */
export async function checkDockerImage(
  image: string,
  tag: string
): Promise<boolean> {
  return await invoke<boolean>('check_docker_image', { image, tag });
}


