import type { SornConfig } from './sorn';

export interface DeepHeavenConfig {
  defaultModel?: string;
  sorn?: SornConfig;
  theme?: 'dark' | 'light' | 'auto';
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
  };
  tmux?: {
    sessionName?: string;
    preferTmux?: boolean;
  };
  git?: {
    defaultBaseBranch?: string;
    autoFetch?: boolean;
  };
  eldil?: {
    defaultTool?: 'amp' | 'opencode';
    maxWorkersPerField?: number;
    maxTotalWorkers?: number;
  };
  aliases?: Record<string, string>;
}

export const DEFAULT_DEEPHEAVEN_CONFIG: DeepHeavenConfig = {
  defaultModel: undefined,
  theme: 'auto',
  logging: {
    level: 'info',
    pretty: true,
  },
  tmux: {
    sessionName: 'perelandra',
    preferTmux: true,
  },
  git: {
    defaultBaseBranch: 'main',
    autoFetch: true,
  },
  eldil: {
    defaultTool: 'amp',
    maxWorkersPerField: 3,
    maxTotalWorkers: 10,
  },
  aliases: {},
};
