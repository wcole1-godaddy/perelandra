import { $ } from 'bun';
import { join, basename } from 'node:path';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { eventBus } from '../core/events';
import { logInfo, logError, logWarn } from '../logging/pino';
import type { HnauManager } from './hnau';
import type { PerelandraConfig, HnauConfig } from '../types/config';
import type {
  VerificationResult,
  VerificationOptions,
  TestResult,
  UiTestResult,
} from '../types/verifier';

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 60000;
const DEFAULT_HEALTH_CHECK_RETRY_INTERVAL_MS = 2000;
const DEFAULT_MAX_HEALTH_CHECK_RETRIES = 30;
const DEFAULT_TEST_TIMEOUT = 300000;
const DEFAULT_UI_TEST_TIMEOUT = 600000;

export interface VerifierConfig {
  healthCheckTimeoutMs?: number;
  maxHealthCheckRetries?: number;
  testTimeout?: number;
  uiTestTimeout?: number;
}

export class Verifier {
  private config: PerelandraConfig;
  private hnauManager: HnauManager;
  private verifierConfig: Required<VerifierConfig>;

  constructor(
    config: PerelandraConfig,
    hnauManager: HnauManager,
    verifierConfig: VerifierConfig = {}
  ) {
    this.config = config;
    this.hnauManager = hnauManager;
    this.verifierConfig = {
      healthCheckTimeoutMs: verifierConfig.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
      maxHealthCheckRetries: verifierConfig.maxHealthCheckRetries ?? DEFAULT_MAX_HEALTH_CHECK_RETRIES,
      testTimeout: verifierConfig.testTimeout ?? DEFAULT_TEST_TIMEOUT,
      uiTestTimeout: verifierConfig.uiTestTimeout ?? DEFAULT_UI_TEST_TIMEOUT,
    };
  }

  async verify(
    taskId: string,
    hnauIds: string[],
    fieldPath: string,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const failedSteps: string[] = [];

    logInfo('Verification starting', { taskId, hnauIds, fieldPath });
    this.emitStatus(taskId, fieldPath, 'started');

    const hnauConfigs = hnauIds
      .map((id) => this.hnauManager.getConfig(id))
      .filter((c): c is HnauConfig => c !== undefined);

    if (hnauConfigs.length !== hnauIds.length) {
      const missing = hnauIds.filter((id) => !this.hnauManager.getConfig(id));
      logError('Verification failed - missing hnau configs', { missing });
      return this.buildResult(false, false, failedSteps, startTime, {
        failedSteps: [`Missing hnau configs: ${missing.join(', ')}`],
      });
    }

    this.emitStatus(taskId, fieldPath, 'services-starting');
    const servicesHealthy = await this.startAndVerifyServices(hnauIds, fieldPath, options);
    if (!servicesHealthy) {
      failedSteps.push('services-health-check');
      logError('Verification failed - services unhealthy', { taskId });
      return this.buildResult(false, false, failedSteps, startTime);
    }

    let testsResult: TestResult | undefined;
    if (!options.skipTests) {
      this.emitStatus(taskId, fieldPath, 'running-tests');
      testsResult = await this.runTests(hnauConfigs, fieldPath, taskId);
      if (testsResult && !testsResult.passed) {
        failedSteps.push('tests');
      }
    }

    let uiTestResult: UiTestResult | undefined;
    if (!options.skipUiTests) {
      this.emitStatus(taskId, fieldPath, 'running-ui-tests');
      uiTestResult = await this.runUiTests(hnauConfigs, fieldPath, taskId);
      if (uiTestResult && !uiTestResult.passed) {
        failedSteps.push('ui-tests');
      }
    }

    const success =
      servicesHealthy &&
      (testsResult?.passed ?? true) &&
      (uiTestResult?.passed ?? true);

    const result = this.buildResult(success, servicesHealthy, failedSteps, startTime, {
      testsResult,
      uiTestResult,
    });

    this.emitStatus(taskId, fieldPath, success ? 'completed' : 'failed', result);

    logInfo('Verification complete', {
      taskId,
      success,
      duration: result.duration,
      failedSteps,
    });

    return result;
  }

  private async startAndVerifyServices(
    hnauIds: string[],
    fieldPath: string,
    options: VerificationOptions
  ): Promise<boolean> {
    for (const hnauId of hnauIds) {
      const startResult = await this.hnauManager.start(hnauId, { field: fieldPath });
      if (!startResult.success) {
        logError('Failed to start hnau', { hnauId, error: startResult.error });
        return false;
      }
    }

    const timeoutMs = options.healthCheckTimeoutMs ?? this.verifierConfig.healthCheckTimeoutMs;
    const maxRetries = options.maxHealthCheckRetries ?? this.verifierConfig.maxHealthCheckRetries;

    for (const hnauId of hnauIds) {
      const hnauConfig = this.hnauManager.getConfig(hnauId);
      if (!hnauConfig?.healthCheck) {
        continue;
      }

      const healthy = await this.waitForHealthy(hnauId, timeoutMs, maxRetries);
      if (!healthy) {
        logError('Health check failed', { hnauId });
        return false;
      }
    }

    return true;
  }

  private async waitForHealthy(
    hnauId: string,
    timeoutMs: number,
    maxRetries: number
  ): Promise<boolean> {
    const startTime = Date.now();
    let retries = 0;

    while (retries < maxRetries && Date.now() - startTime < timeoutMs) {
      const result = await this.hnauManager.checkHealth(hnauId);
      if (result.healthy) {
        logInfo('Health check passed', { hnauId, retries });
        return true;
      }

      retries++;
      await Bun.sleep(DEFAULT_HEALTH_CHECK_RETRY_INTERVAL_MS);
    }

    logWarn('Health check timed out', { hnauId, retries, elapsed: Date.now() - startTime });
    return false;
  }

  private async runTests(
    hnauConfigs: HnauConfig[],
    fieldPath: string,
    taskId: string
  ): Promise<TestResult | undefined> {
    const configsWithTests = hnauConfigs.filter((c) => c.testCommand);
    if (configsWithTests.length === 0) {
      return undefined;
    }

    const logDir = this.ensureLogDir(taskId, 'tests');
    const startTime = Date.now();
    let overallPassed = true;
    let lastExitCode = 0;
    const logPaths: string[] = [];

    for (const hnauConfig of configsWithTests) {
      const workingDir = join(fieldPath, hnauConfig.root);
      const logPath = join(logDir, `${hnauConfig.id}-test.log`);
      logPaths.push(logPath);

      const timeout = hnauConfig.testTimeout ?? this.verifierConfig.testTimeout;

      logInfo('Running tests', { hnauId: hnauConfig.id, command: hnauConfig.testCommand });

      try {
        const proc = Bun.spawn(['/bin/sh', '-c', hnauConfig.testCommand!], {
          cwd: workingDir,
          stdout: Bun.file(logPath),
          stderr: Bun.file(logPath),
          env: { ...process.env, ...hnauConfig.env },
        });

        const exitCode = await this.waitForProcess(proc, timeout);
        lastExitCode = exitCode;

        if (exitCode !== 0) {
          overallPassed = false;
          logError('Tests failed', { hnauId: hnauConfig.id, exitCode });
        } else {
          logInfo('Tests passed', { hnauId: hnauConfig.id });
        }
      } catch (err) {
        overallPassed = false;
        logError('Test execution error', err);
      }
    }

    return {
      passed: overallPassed,
      exitCode: lastExitCode,
      duration: Date.now() - startTime,
      logPath: logPaths[0] ?? logDir,
    };
  }

  private async runUiTests(
    hnauConfigs: HnauConfig[],
    fieldPath: string,
    taskId: string
  ): Promise<UiTestResult | undefined> {
    const configsWithUiTests = hnauConfigs.filter((c) => c.uiTestCommand);
    if (configsWithUiTests.length === 0) {
      return undefined;
    }

    const logDir = this.ensureLogDir(taskId, 'ui-tests');
    let overallPassed = true;
    let lastExitCode = 0;
    const screenshotPaths: string[] = [];
    const logPaths: string[] = [];

    for (const hnauConfig of configsWithUiTests) {
      const workingDir = join(fieldPath, hnauConfig.root);
      const logPath = join(logDir, `${hnauConfig.id}-ui-test.log`);
      logPaths.push(logPath);

      const timeout = hnauConfig.uiTestTimeout ?? this.verifierConfig.uiTestTimeout;

      logInfo('Running UI tests', { hnauId: hnauConfig.id, command: hnauConfig.uiTestCommand });

      try {
        const proc = Bun.spawn(['/bin/sh', '-c', hnauConfig.uiTestCommand!], {
          cwd: workingDir,
          stdout: Bun.file(logPath),
          stderr: Bun.file(logPath),
          env: { ...process.env, ...hnauConfig.env },
        });

        const exitCode = await this.waitForProcess(proc, timeout);
        lastExitCode = exitCode;

        if (exitCode !== 0) {
          overallPassed = false;
          logError('UI tests failed', { hnauId: hnauConfig.id, exitCode });
        } else {
          logInfo('UI tests passed', { hnauId: hnauConfig.id });
        }

        if (hnauConfig.uiScreenshotDir) {
          const screenshotDir = join(workingDir, hnauConfig.uiScreenshotDir);
          const screenshots = this.collectScreenshots(screenshotDir);
          screenshotPaths.push(...screenshots);
        }
      } catch (err) {
        overallPassed = false;
        logError('UI test execution error', err);
      }
    }

    return {
      passed: overallPassed,
      exitCode: lastExitCode,
      screenshotPaths,
      logPath: logPaths[0] ?? logDir,
    };
  }

  private async waitForProcess(proc: ReturnType<typeof Bun.spawn>, timeoutMs: number): Promise<number> {
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Process timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const exitPromise = proc.exited;

    try {
      return await Promise.race([exitPromise, timeoutPromise]);
    } catch (err) {
      throw err;
    }
  }

  private collectScreenshots(dir: string): string[] {
    if (!existsSync(dir)) {
      return [];
    }

    try {
      const files = readdirSync(dir);
      return files
        .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .map((f) => join(dir, f));
    } catch {
      return [];
    }
  }

  private ensureLogDir(taskId: string, subdir: string): string {
    const logRoot = this.config.logs?.root ?? 'logs';
    const repoRoot = this.config.repoRoot ?? '.';
    const baseDir = repoRoot.startsWith('/') ? repoRoot : join(process.cwd(), repoRoot);
    const logDir = join(baseDir, logRoot, 'verification', taskId, subdir);

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    return logDir;
  }

  private buildResult(
    success: boolean,
    servicesHealthy: boolean,
    failedSteps: string[],
    startTime: number,
    extra: Partial<VerificationResult> = {}
  ): VerificationResult {
    return {
      success,
      servicesHealthy,
      failedSteps: [...failedSteps, ...(extra.failedSteps ?? [])],
      verifiedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      testsResult: extra.testsResult,
      uiTestResult: extra.uiTestResult,
    };
  }

  private emitStatus(
    taskId: string,
    fieldName: string,
    status: 'started' | 'services-starting' | 'health-checking' | 'running-tests' | 'running-ui-tests' | 'completed' | 'failed',
    result?: VerificationResult
  ): void {
    eventBus.emit('verification:statusChanged', {
      taskId,
      fieldName,
      status,
      result,
    });
  }
}

export type { VerificationResult, VerificationOptions, TestResult, UiTestResult } from '../types/verifier';
