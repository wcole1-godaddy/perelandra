export type HandramitName = 'dev' | 'stage' | 'prod' | string;

export interface HealthCheckConfig {
  url: string;
  intervalSeconds?: number;
  timeoutMs?: number;
}

export interface HnauConfig {
  id: string;
  description?: string;
  root: string;
  devCommand: string;
  dockerComposeService?: string;
  env?: Record<string, string>;
  logFiles?: string[];
  port?: number;
  healthCheck?: HealthCheckConfig;

  // Test verification
  testCommand?: string;
  testTimeout?: number;

  // UI/Playwright verification
  uiTestCommand?: string;
  uiTestTimeout?: number;
  uiScreenshotDir?: string;
}

export interface FieldConfig {
  name: string;
  baseBranch?: string;
  branch?: string;
  path?: string;
}

export interface HandramitConfig {
  description?: string;
  hnauEnabled?: string[];
}

export interface LogsConfig {
  root?: string;
  maxSizeMb?: number;
  maxFiles?: number;
}

export interface BeadsConfig {
  root?: string;
}

export interface RepoConfig {
  id: string;
  url: string;
  path: string;
  defaultBranch?: string;
}

export interface PerelandraConfig {
  version: string;
  repoRoot?: string;
  defaultHandramit?: HandramitName;
  handramits?: Record<HandramitName, HandramitConfig>;
  hnau: HnauConfig[];
  fields?: FieldConfig[];
  repos?: RepoConfig[];
  dockerComposeFile?: string;
  logs?: LogsConfig;
  beads?: BeadsConfig;
}
