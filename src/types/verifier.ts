export interface TestResult {
  passed: boolean;
  exitCode: number;
  duration: number;
  logPath: string;
}

export interface UiTestResult {
  passed: boolean;
  exitCode: number;
  screenshotPaths: string[];
  logPath: string;
}

export interface VerificationResult {
  success: boolean;
  servicesHealthy: boolean;
  testsResult?: TestResult;
  uiTestResult?: UiTestResult;
  failedSteps: string[];
  verifiedAt: string;
  duration: number;
}

export interface VerificationOptions {
  skipTests?: boolean;
  skipUiTests?: boolean;
  healthCheckTimeoutMs?: number;
  maxHealthCheckRetries?: number;
}

export type VerificationStatusChangedEvent = {
  taskId: string;
  fieldName: string;
  status: 'started' | 'services-starting' | 'health-checking' | 'running-tests' | 'running-ui-tests' | 'completed' | 'failed';
  result?: VerificationResult;
};
