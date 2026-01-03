import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import type { DeepHeavenConfig } from '../types/deepheaven';
import { DEFAULT_DEEPHEAVEN_CONFIG } from '../types/deepheaven';
import { logInfo, logWarn, logError } from '../logging/pino';

const DEEPHEAVEN_DIR = '.perelandra';
const DEEPHEAVEN_CONFIG_FILE = 'config.yaml';

const DeepHeavenSchema = z.object({
  defaultModel: z.string().optional(),
  sorn: z.object({
    model: z.string().optional(),
    timeout: z.number().optional(),
  }).optional(),
  theme: z.enum(['dark', 'light', 'auto']).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    pretty: z.boolean().optional(),
  }).optional(),
  tmux: z.object({
    sessionName: z.string().optional(),
    preferTmux: z.boolean().optional(),
  }).optional(),
  git: z.object({
    defaultBaseBranch: z.string().optional(),
    autoFetch: z.boolean().optional(),
  }).optional(),
  eldil: z.object({
    defaultTool: z.enum(['amp', 'opencode']).optional(),
    maxWorkersPerField: z.number().optional(),
    maxTotalWorkers: z.number().optional(),
  }).optional(),
  aliases: z.record(z.string()).optional(),
}).strict();

export interface DeepHeavenResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export class DeepHeavenManager {
  private configDir: string;
  private configPath: string;
  private config: DeepHeavenConfig;
  private loaded = false;

  constructor() {
    this.configDir = join(homedir(), DEEPHEAVEN_DIR);
    this.configPath = join(this.configDir, DEEPHEAVEN_CONFIG_FILE);
    this.config = { ...DEFAULT_DEEPHEAVEN_CONFIG };
  }

  getConfigDir(): string {
    return this.configDir;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async load(): Promise<DeepHeavenResult<DeepHeavenConfig>> {
    const file = Bun.file(this.configPath);

    if (!(await file.exists())) {
      this.config = { ...DEFAULT_DEEPHEAVEN_CONFIG };
      this.loaded = true;
      return { success: true, data: this.config };
    }

    try {
      const content = await file.text();
      const parsed = parseYaml(content);

      const result = DeepHeavenSchema.safeParse(parsed);
      if (!result.success) {
        logWarn('DeepHeaven config has validation issues, using defaults', {
          issues: result.error.issues,
        });
        this.config = this.mergeWithDefaults(parsed as Partial<DeepHeavenConfig>);
      } else {
        this.config = this.mergeWithDefaults(result.data);
      }

      this.loaded = true;
      logInfo('DeepHeaven config loaded', { path: this.configPath });
      return { success: true, data: this.config };
    } catch (err) {
      logError('Failed to load DeepHeaven config', err);
      this.config = { ...DEFAULT_DEEPHEAVEN_CONFIG };
      this.loaded = true;
      return {
        success: false,
        data: this.config,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async save(): Promise<DeepHeavenResult> {
    try {
      const dir = Bun.file(this.configDir);
      if (!(await dir.exists())) {
        await Bun.write(join(this.configDir, '.keep'), '');
        const { mkdir } = await import('node:fs/promises');
        await mkdir(this.configDir, { recursive: true });
      }

      const content = stringifyYaml(this.config);
      await Bun.write(this.configPath, content);
      logInfo('DeepHeaven config saved', { path: this.configPath });
      return { success: true };
    } catch (err) {
      logError('Failed to save DeepHeaven config', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async init(): Promise<DeepHeavenResult> {
    const file = Bun.file(this.configPath);

    if (await file.exists()) {
      return { success: false, error: 'DeepHeaven config already exists' };
    }

    this.config = { ...DEFAULT_DEEPHEAVEN_CONFIG };
    return this.save();
  }

  getConfig(): DeepHeavenConfig {
    return { ...this.config };
  }

  get<K extends keyof DeepHeavenConfig>(key: K): DeepHeavenConfig[K] {
    return this.config[key];
  }

  set<K extends keyof DeepHeavenConfig>(key: K, value: DeepHeavenConfig[K]): void {
    this.config[key] = value;
  }

  setNested<K extends keyof DeepHeavenConfig>(
    key: K,
    subKey: string,
    value: unknown
  ): void {
    const section = this.config[key];
    if (typeof section === 'object' && section !== null) {
      (section as Record<string, unknown>)[subKey] = value;
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  private mergeWithDefaults(partial: Partial<DeepHeavenConfig>): DeepHeavenConfig {
    return {
      defaultModel: partial.defaultModel ?? DEFAULT_DEEPHEAVEN_CONFIG.defaultModel,
      sorn: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.sorn,
        ...partial.sorn,
      },
      theme: partial.theme ?? DEFAULT_DEEPHEAVEN_CONFIG.theme,
      logging: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.logging,
        ...partial.logging,
      },
      tmux: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.tmux,
        ...partial.tmux,
      },
      git: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.git,
        ...partial.git,
      },
      eldil: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.eldil,
        ...partial.eldil,
      },
      aliases: {
        ...DEFAULT_DEEPHEAVEN_CONFIG.aliases,
        ...partial.aliases,
      },
    };
  }
}

let globalDeepHeaven: DeepHeavenManager | undefined;

export function getDeepHeaven(): DeepHeavenManager {
  if (!globalDeepHeaven) {
    globalDeepHeaven = new DeepHeavenManager();
  }
  return globalDeepHeaven;
}

export async function loadDeepHeaven(): Promise<DeepHeavenConfig> {
  const manager = getDeepHeaven();
  await manager.load();
  return manager.getConfig();
}
