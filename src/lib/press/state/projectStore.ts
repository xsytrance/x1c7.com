// The Plant's single project store: one ProjectSpec, a bounded undo ring,
// and a useSyncExternalStore hook. Framework-light on purpose — the 2D
// editor, the recommendation rail, and (later) the 3D Booth all share it.

import { useSyncExternalStore } from "react";
import type { ProjectSpec } from "../types";
import { saveProject } from "./persist";

export function newProject(templateId = "collector"): ProjectSpec {
  return {
    v: 1,
    id: `p-${Math.random().toString(36).slice(2, 10)}`,
    templateId,
    identity: { title: "", label: "" },
    facts: {},
    art: { slots: {} },
    surfaces: {},
    analysis: null,
    lyrics: null,
    seeds: [],
    updatedAt: new Date().toISOString(),
  };
}

const UNDO_DEPTH = 50;

type Listener = () => void;

class ProjectStore {
  private state: ProjectSpec = newProject();
  private past: ProjectSpec[] = [];
  private future: ProjectSpec[] = [];
  private listeners = new Set<Listener>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  get = () => this.state;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Replace wholesale (load from persistence / template switch). Clears history. */
  load(next: ProjectSpec) {
    this.state = next;
    this.past = [];
    this.future = [];
    this.emit();
  }

  /** Apply a pure mutation. Every apply is one undo step. */
  apply(fn: (draft: ProjectSpec) => ProjectSpec | void) {
    const draft = structuredClone(this.state);
    const next = fn(draft) ?? draft;
    next.updatedAt = new Date().toISOString();
    this.past.push(this.state);
    if (this.past.length > UNDO_DEPTH) this.past.shift();
    this.future = [];
    this.state = next;
    this.emit();
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.state);
    this.state = prev;
    this.emit();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state);
    this.state = next;
    this.emit();
  }

  canUndo = () => this.past.length > 0;
  canRedo = () => this.future.length > 0;

  private emit() {
    for (const fn of this.listeners) fn();
    // Persist lazily; blobs live in IndexedDB and are referenced by id only.
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => saveProject(this.state), 400);
  }
}

export const projectStore = new ProjectStore();

export function useProject(): ProjectSpec {
  return useSyncExternalStore(projectStore.subscribe, projectStore.get, projectStore.get);
}
