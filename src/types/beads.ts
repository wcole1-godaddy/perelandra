export type BeadsTaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type BeadsTaskCreator = 'human' | 'eldil';

export interface BeadsTaskMetadata {
  id: string;
  title: string;
  description?: string;
  fieldName: string;
  hnauId?: string;
  createdBy: BeadsTaskCreator;
  createdAt: string;
  status: BeadsTaskStatus;
  relatedCommits?: string[];
  labels?: string[];
}

export interface TaskHistoryEntry {
  timestamp: string;
  action: string;
  user?: string;
  details?: Record<string, unknown>;
}
