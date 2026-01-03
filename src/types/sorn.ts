export type IssueSeverity = 'critical' | 'warning' | 'info';

export type ReviewCategory =
  | 'breaking-api'
  | 'database-migration'
  | 'event-schema'
  | 'config-format'
  | 'dependency-version'
  | 'public-contract'
  | 'security'
  | 'performance'
  | 'other';

export interface ReviewChecklistItem {
  id: string;
  category: ReviewCategory;
  description: string;
  enabled: boolean;
  severity: IssueSeverity;
}

export interface SornIssue {
  severity: IssueSeverity;
  category: ReviewCategory | string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface SornReviewResult {
  success: boolean;
  issues: SornIssue[];
  summary?: string;
  error?: string;
  reviewedAt: string;
  checklistUsed: string[];
}

export interface SornReviewOptions {
  field?: string;
  taskId?: string;
  diff?: string;
  files?: string[];
  checklist?: ReviewCategory[];
}

export interface SornConfig {
  model?: string;
  timeout?: number;
  checklist?: ReviewChecklistItem[];
}

export interface SornReviewHistoryEntry {
  id: string;
  taskId?: string;
  fieldName?: string;
  result: SornReviewResult;
  reviewedAt: string;
  reviewedBy: 'sorn' | 'human';
}

export const DEFAULT_CHECKLIST: ReviewChecklistItem[] = [
  {
    id: 'breaking-api-removed',
    category: 'breaking-api',
    description: 'Check for removed or renamed API endpoints, fields, or methods',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'breaking-api-types',
    category: 'breaking-api',
    description: 'Check for changed parameter or return types',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'breaking-api-required',
    category: 'breaking-api',
    description: 'Check for new required fields or parameters',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'database-schema',
    category: 'database-migration',
    description: 'Check for schema changes that could break existing data',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'database-migration-order',
    category: 'database-migration',
    description: 'Check for migration order issues or missing rollbacks',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'event-schema-changed',
    category: 'event-schema',
    description: 'Check for changes to event/message payload formats',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'event-schema-versioning',
    category: 'event-schema',
    description: 'Check for proper event versioning when schemas change',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'config-format-breaking',
    category: 'config-format',
    description: 'Check for breaking changes to configuration file formats',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'config-defaults',
    category: 'config-format',
    description: 'Check for changed default values that could affect behavior',
    enabled: true,
    severity: 'info',
  },
  {
    id: 'dependency-major',
    category: 'dependency-version',
    description: 'Check for major version bumps in dependencies',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'dependency-peer',
    category: 'dependency-version',
    description: 'Check for peer dependency conflicts',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'public-interface',
    category: 'public-contract',
    description: 'Check for changes to public/exported interfaces',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'public-behavior',
    category: 'public-contract',
    description: 'Check for behavioral changes in public APIs',
    enabled: true,
    severity: 'warning',
  },
  {
    id: 'security-secrets',
    category: 'security',
    description: 'Check for exposed secrets, keys, or credentials',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'security-auth',
    category: 'security',
    description: 'Check for changes to authentication/authorization logic',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'performance-regression',
    category: 'performance',
    description: 'Check for potential performance regressions (N+1 queries, blocking calls)',
    enabled: true,
    severity: 'warning',
  },
];

export function getChecklistByCategory(category: ReviewCategory): ReviewChecklistItem[] {
  return DEFAULT_CHECKLIST.filter((item) => item.category === category);
}

export function getEnabledChecklist(checklist: ReviewChecklistItem[] = DEFAULT_CHECKLIST): ReviewChecklistItem[] {
  return checklist.filter((item) => item.enabled);
}
