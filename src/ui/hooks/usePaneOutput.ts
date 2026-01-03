import { useState, useEffect, useRef } from 'react';
import { getOyarsa } from '../../core/oyarsa';

export interface UsePaneOutputOptions {
  tmuxPane?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  lines?: number;
}

export interface UsePaneOutputResult {
  output: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePaneOutput(options: UsePaneOutputOptions): UsePaneOutputResult {
  const {
    tmuxPane,
    enabled = true,
    pollIntervalMs = 500,
    lines = 100,
  } = options;

  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<Timer | null>(null);

  const fetchOutput = async (): Promise<void> => {
    if (!tmuxPane) {
      setOutput('');
      return;
    }

    const oyarsa = getOyarsa();
    if (!oyarsa) {
      setError('Oyarsa not available');
      return;
    }

    const tmuxManager = oyarsa.getTmuxManager();
    const [windowName, paneStr] = tmuxPane.split('.');
    if (!windowName) {
      setError('Invalid tmux pane format');
      return;
    }

    const paneIndex = parseInt(paneStr, 10);
    const result = await tmuxManager.capturePane(
      { window: windowName, pane: paneIndex },
      { lines }
    );

    if (result.success && result.data !== undefined) {
      setOutput(result.data);
      setError(null);
    } else {
      setError(result.error ?? 'Failed to capture pane');
    }
  };

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      await fetchOutput();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled || !tmuxPane) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    refresh();

    intervalRef.current = setInterval(() => {
      fetchOutput();
    }, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tmuxPane, enabled, pollIntervalMs, lines]);

  return { output, loading, error, refresh };
}
