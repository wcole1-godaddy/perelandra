import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { PerelandraApp } from './components/PerelandraApp';
import type { PerelandraConfig } from '../types/config';
import type { Oyarsa } from '../core/oyarsa';
import { initLogger } from '../logging/pino';

export interface UIOptions {
  config: PerelandraConfig;
  repoRoot: string;
  oyarsa?: Oyarsa;
}

export async function startUI(options: UIOptions): Promise<void> {
  // Initialize logger to file-only mode to prevent stdout corruption of TUI
  initLogger({
    logsConfig: options.config.logs,
    fileOnly: true,
  });

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  createRoot(renderer).render(
    <PerelandraApp
      config={options.config}
      repoRoot={options.repoRoot}
      oyarsa={options.oyarsa}
    />
  );
}
