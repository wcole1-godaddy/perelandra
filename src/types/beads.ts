export type BeadsTaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type BeadsTaskCreator = 'human' | 'eldil';

export type BeadsTaskType = 'task' | 'epic' | 'bug';

export interface BeadsTaskMetadata {
  id: string;
  title: string;
  description?: string;
  fieldName: string;
  hnauIds?: string[];
  createdBy: BeadsTaskCreator;
  createdAt: string;
  status: BeadsTaskStatus;
  relatedCommits?: string[];
  artifactDir?: string;
  labels?: string[];
  type?: BeadsTaskType;
  priority?: number;
}

export interface EpicStatus {
  epic: BeadsTaskMetadata;
  totalChildren: number;
  closedChildren: number;
  eligibleForClose: boolean;
}

export interface EpicGraph {
  layers: EpicGraphLayer[];
  totalIssues: number;
}

export interface EpicGraphLayer {
  depth: number;
  issues: EpicGraphNode[];
}

export interface EpicGraphNode {
  id: string;
  title: string;
  status: BeadsTaskStatus;
}

export interface TaskHistoryEntry {
  timestamp: string;
  action: string;
  user?: string;
  details?: Record<string, unknown>;
}
