import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { PerelandraApp } from './components/PerelandraApp';
import type { PerelandraConfig } from '../types/config';

export interface UIOptions {
  config: PerelandraConfig;
  repoRoot: string;
}

export async function startUI(options: UIOptions): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  createRoot(renderer).render(<PerelandraApp config={options.config} repoRoot={options.repoRoot} />);
}
