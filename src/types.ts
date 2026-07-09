export enum TaskStatus {
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  QA = "QA",
  TODO = "TODO",
  BLOCKED = "BLOCKED",
  UNKNOWN = "UNKNOWN",
}

export interface BaseTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: { id: string; name: string } | null;
  annotationCount: number;
  updatedAt: number; // Normalized to epoch-ms for uniform sorting and comparison
  meta: Record<string, string>;
}

export interface ImageTask extends BaseTask {
  type: "image";
}

export interface AudioTask extends BaseTask {
  type: "audio";
}

export interface TextTask extends BaseTask {
  type: "text";
}

export interface UnknownTask extends BaseTask {
  type: "unknown";
  rawType: string;
}

import { EntityState } from "@reduxjs/toolkit";

export type Task = ImageTask | AudioTask | TextTask | UnknownTask;

export interface TasksExtraState {
  loading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  totalTasks: number;
  isFromCache: boolean;
}

// State Interface for Redux Tasks Slice extending EntityState
export type TasksState = EntityState<Task, string> & TasksExtraState;
