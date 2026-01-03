import type { OyarsaState, FieldState, EldilState } from '../types/runtime';

const STATE_FILE_NAME = '.perelandra-state.json';

export interface StateManagerOptions {
  stateDir?: string;
  autoPersist?: boolean;
  persistIntervalMs?: number;
}

export class StateManager {
  private state: OyarsaState;
  private stateFilePath: string;
  private persistTimer?: Timer;
  private dirty: boolean = false;

  constructor(stateDir: string, options: StateManagerOptions = {}) {
    this.stateFilePath = `${stateDir}/${STATE_FILE_NAME}`;
    this.state = this.createEmptyState();

    if (options.autoPersist) {
      const intervalMs = options.persistIntervalMs ?? 5000;
      this.persistTimer = setInterval(() => {
        if (this.dirty) {
          this.persist().catch(console.error);
        }
      }, intervalMs);
    }
  }

  private createEmptyState(): OyarsaState {
    return {
      activeField: 'main',
      fields: {},
      eldila: {},
    };
  }

  async load(): Promise<OyarsaState> {
    const file = Bun.file(this.stateFilePath);

    if (!(await file.exists())) {
      return this.state;
    }

    try {
      const content = await file.text();
      const loaded = JSON.parse(content) as OyarsaState;
      this.state = loaded;
      this.dirty = false;
      return this.state;
    } catch {
      return this.state;
    }
  }

  async persist(): Promise<void> {
    const content = JSON.stringify(this.state, null, 2);
    await Bun.write(this.stateFilePath, content);
    this.dirty = false;
  }

  getState(): OyarsaState {
    return this.state;
  }

  getActiveField(): string {
    return this.state.activeField;
  }

  setActiveField(fieldName: string): void {
    this.state.activeField = fieldName;
    this.dirty = true;
  }

  getField(name: string): FieldState | undefined {
    return this.state.fields[name];
  }

  setField(name: string, field: FieldState): void {
    this.state.fields[name] = field;
    this.dirty = true;
  }

  removeField(name: string): void {
    delete this.state.fields[name];
    this.dirty = true;
  }

  listFields(): FieldState[] {
    return Object.values(this.state.fields);
  }

  getEldil(id: string): EldilState | undefined {
    return this.state.eldila[id];
  }

  setEldil(id: string, eldil: EldilState): void {
    this.state.eldila[id] = eldil;
    this.dirty = true;
  }

  removeEldil(id: string): void {
    delete this.state.eldila[id];
    this.dirty = true;
  }

  listEldila(): EldilState[] {
    return Object.values(this.state.eldila);
  }

  getEldilaForField(fieldName: string): EldilState[] {
    return this.listEldila().filter((e) => e.fieldName === fieldName);
  }

  updateEldilStatus(id: string, status: EldilState['status'], error?: string): void {
    const eldil = this.state.eldila[id];
    if (eldil) {
      eldil.status = status;
      eldil.updatedAt = new Date().toISOString();
      if (error) {
        eldil.lastError = error;
      }
      this.dirty = true;
    }
  }

  updateHnauStatus(
    fieldName: string,
    hnauId: string,
    running: boolean,
    healthy?: boolean
  ): void {
    const field = this.state.fields[fieldName];
    if (field) {
      field.hnauStatuses[hnauId] = {
        running,
        healthy,
        lastHealthCheck: new Date().toISOString(),
      };
      this.dirty = true;
    }
  }

  async reset(): Promise<void> {
    this.state = this.createEmptyState();
    await this.persist();
  }

  dispose(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
  }
}

let globalStateManager: StateManager | undefined;

export function getStateManager(): StateManager | undefined {
  return globalStateManager;
}

export function initStateManager(stateDir: string, options?: StateManagerOptions): StateManager {
  globalStateManager = new StateManager(stateDir, options);
  return globalStateManager;
}
