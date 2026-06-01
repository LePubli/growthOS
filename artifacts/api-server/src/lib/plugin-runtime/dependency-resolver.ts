import type { PluginManifest } from "./types";

export class DependencyResolutionError extends Error {
  constructor(
    message: string,
    public readonly cycle?: string[],
  ) {
    super(message);
    this.name = "DependencyResolutionError";
  }
}

/**
 * Resolves plugin load order using Kahn's algorithm (topological sort).
 * Detects missing dependencies and circular dependency cycles.
 *
 * Returns plugins in dependency-safe activation order (dependencies first).
 */
export function resolveLoadOrder(manifests: PluginManifest[]): PluginManifest[] {
  const byId = new Map<string, PluginManifest>(manifests.map((m) => [m.id, m]));

  // Validate all declared dependencies exist in the registry
  for (const manifest of manifests) {
    for (const dep of manifest.dependencies) {
      if (!byId.has(dep)) {
        throw new DependencyResolutionError(
          `Plugin "${manifest.id}" declares dependency "${dep}" which is not registered`,
        );
      }
    }
  }

  // Build adjacency list and in-degree map
  // Edge: dep -> dependent (dep must load before dependent)
  const inDegree = new Map<string, number>(manifests.map((m) => [m.id, 0]));
  const dependents = new Map<string, string[]>(manifests.map((m) => [m.id, []]));

  for (const manifest of manifests) {
    for (const dep of manifest.dependencies) {
      dependents.get(dep)!.push(manifest.id);
      inDegree.set(manifest.id, (inDegree.get(manifest.id) ?? 0) + 1);
    }
  }

  // Kahn's algorithm — start with nodes that have no dependencies
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    // Sort for deterministic ordering when multiple nodes have in-degree 0
    queue.sort();
    const id = queue.shift()!;
    sorted.push(id);

    for (const dependent of dependents.get(id) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== manifests.length) {
    // Cycle exists — find it using DFS for a useful error message
    const cycle = detectCycle(manifests);
    throw new DependencyResolutionError(
      `Circular dependency detected: ${cycle.join(" → ")}`,
      cycle,
    );
  }

  return sorted.map((id) => byId.get(id)!);
}

function detectCycle(manifests: PluginManifest[]): string[] {
  const byId = new Map<string, PluginManifest>(manifests.map((m) => [m.id, m]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(manifests.map((m) => [m.id, WHITE]));
  const path: string[] = [];

  function dfs(id: string): string[] | null {
    color.set(id, GRAY);
    path.push(id);

    for (const dep of byId.get(id)?.dependencies ?? []) {
      if (color.get(dep) === GRAY) {
        const cycleStart = path.indexOf(dep);
        return [...path.slice(cycleStart), dep];
      }
      if (color.get(dep) === WHITE) {
        const result = dfs(dep);
        if (result) return result;
      }
    }

    path.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const manifest of manifests) {
    if (color.get(manifest.id) === WHITE) {
      const cycle = dfs(manifest.id);
      if (cycle) return cycle;
    }
  }

  return ["(unknown)"];
}
