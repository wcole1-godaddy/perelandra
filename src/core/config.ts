import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import type { PerelandraConfig } from '../types/config';
import { ConfigError as ConfigErr } from '../util/errors';

const HealthCheckSchema = z.object({
  url: z.string(),
  intervalSeconds: z.number().optional(),
  timeoutMs: z.number().optional(),
});

const HnauConfigSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  root: z.string(),
  devCommand: z.string(),
  dockerComposeService: z.string().optional(),
  env: z.record(z.string()).optional(),
  logFiles: z.array(z.string()).optional(),
  port: z.number().optional(),
  healthCheck: HealthCheckSchema.optional(),
});

const FieldConfigSchema = z.object({
  name: z.string(),
  baseBranch: z.string().optional(),
  branch: z.string().optional(),
  path: z.string().optional(),
});

const HandramitConfigSchema = z.object({
  description: z.string().optional(),
  hnauEnabled: z.array(z.string()).optional(),
});

const LogsConfigSchema = z.object({
  root: z.string().optional(),
  maxSizeMb: z.number().optional(),
  maxFiles: z.number().optional(),
});

const BeadsConfigSchema = z.object({
  root: z.string().optional(),
});

const HealthCheckDefaultsSchema = z.object({
  intervalSeconds: z.number().optional(),
  timeoutMs: z.number().optional(),
});

const RepoConfigSchema = z.object({
  id: z.string(),
  url: z.string(),
  path: z.string(),
  defaultBranch: z.string().optional(),
});

export const PerelandraConfigSchema = z.object({
  version: z.string(),
  repoRoot: z.string().optional(),
  defaultHandramit: z.string().optional(),
  handramits: z.record(HandramitConfigSchema).optional(),
  hnau: z.array(HnauConfigSchema),
  fields: z.array(FieldConfigSchema).optional(),
  repos: z.array(RepoConfigSchema).optional(),
  dockerComposeFile: z.string().optional(),
  logs: LogsConfigSchema.optional(),
  beads: BeadsConfigSchema.optional(),
  healthCheckDefaults: HealthCheckDefaultsSchema.optional(),
});

export interface ConfigLoadResult {
  config: PerelandraConfig;
  path: string;
}

export interface ConfigError {
  message: string;
  path?: string;
  issues?: z.ZodIssue[];
}

const CONFIG_FILE_NAME = '.perelandra.yaml';

export async function findConfigPath(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = startDir;
  
  while (true) {
    const configPath = `${currentDir}/${CONFIG_FILE_NAME}`;
    const file = Bun.file(configPath);
    
    if (await file.exists()) {
      return configPath;
    }
    
    const parentDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
    if (parentDir === currentDir || parentDir === '') {
      break;
    }
    currentDir = parentDir;
  }
  
  return null;
}

export async function loadConfig(configPath?: string): Promise<ConfigLoadResult> {
  const path = configPath ?? await findConfigPath();
  
  if (!path) {
    throw new ConfigErr(`Config file not found: ${CONFIG_FILE_NAME}`, {
      code: 'CONFIG_NOT_FOUND',
      suggestion: 'Run `perelandra init` to create a new configuration file',
    });
  }
  
  const file = Bun.file(path);
  
  if (!(await file.exists())) {
    throw new ConfigErr(`Config file does not exist: ${path}`, {
      code: 'CONFIG_NOT_FOUND',
      path,
      suggestion: 'Run `perelandra init` to create a new configuration file',
    });
  }
  
  let content: string;
  try {
    content = await file.text();
  } catch (err) {
    throw new ConfigErr('Failed to read config file', {
      code: 'CONFIG_PARSE_ERROR',
      path,
      cause: err instanceof Error ? err : undefined,
    });
  }
  
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    throw new ConfigErr('Invalid YAML syntax in config file', {
      code: 'CONFIG_PARSE_ERROR',
      path,
      cause: err instanceof Error ? err : undefined,
      suggestion: 'Check the YAML syntax in your .perelandra.yaml file',
    });
  }
  
  const result = PerelandraConfigSchema.safeParse(parsed);
  
  if (!result.success) {
    const error: ConfigError = {
      message: 'Invalid configuration',
      path,
      issues: result.error.issues,
    };
    throw error;
  }
  
  return { config: result.data, path };
}

export async function validateConfig(configPath?: string): Promise<{ valid: boolean; error?: ConfigError }> {
  try {
    await loadConfig(configPath);
    return { valid: true };
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'issues' in err) {
      return { valid: false, error: err as ConfigError };
    }
    return {
      valid: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

export function formatConfigError(error: ConfigError): string {
  const lines: string[] = [`Error: ${error.message}`];
  
  if (error.path) {
    lines.push(`  File: ${error.path}`);
  }
  
  if (error.issues) {
    lines.push('  Issues:');
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      lines.push(`    - ${path}: ${issue.message}`);
    }
  }
  
  return lines.join('\n');
}
