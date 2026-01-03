import { EventEmitter } from 'node:events';
import type { BeadsTaskStatus } from '../types/beads';
import type { EldilStatus } from '../types/eldil';
import type { HnauStatus } from '../types/hnau';

export type TaskCreatedEvent = {
  taskId: string;
  fieldName: string;
};

export type TaskStatusChangedEvent = {
  taskId: string;
  fieldName: string;
  from?: BeadsTaskStatus;
  to: BeadsTaskStatus;
  eldilId?: string;
  reason?: 'claimed' | 'completed' | 'blocked' | 'manual';
};

export type EldilStatusChangedEvent = {
  eldilId: string;
  fieldName: string;
  status: EldilStatus;
  taskId?: string;
};

export type HnauStatusChangedEvent = {
  hnauId: string;
  status: HnauStatus;
  error?: string;
};

export type FieldChangedEvent = {
  fieldName: string;
  active?: boolean;
};

export type LogMessageEvent = {
  level: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  timestamp?: string;
};

export type UINotificationEvent = {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
};

export type UIRefreshEvent = {
  target: 'tasks' | 'eldila' | 'hnau' | 'fields' | 'all';
};

export type PerelandraEventMap = {
  'task:created': TaskCreatedEvent;
  'task:statusChanged': TaskStatusChangedEvent;
  'eldil:statusChanged': EldilStatusChangedEvent;
  'hnau:statusChanged': HnauStatusChangedEvent;
  'field:changed': FieldChangedEvent;
  'log:message': LogMessageEvent;
  'ui:notification': UINotificationEvent;
  'ui:refresh': UIRefreshEvent;
};

class PerelandraEventBus extends EventEmitter {
  emit<K extends keyof PerelandraEventMap>(
    event: K,
    payload: PerelandraEventMap[K]
  ): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof PerelandraEventMap>(
    event: K,
    listener: (payload: PerelandraEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof PerelandraEventMap>(
    event: K,
    listener: (payload: PerelandraEventMap[K]) => void
  ): this {
    return super.off(event, listener);
  }

  once<K extends keyof PerelandraEventMap>(
    event: K,
    listener: (payload: PerelandraEventMap[K]) => void
  ): this {
    return super.once(event, listener);
  }
}

export const eventBus = new PerelandraEventBus();
