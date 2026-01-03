import type { HnauConfig } from '../types/config';
import path from 'path';

interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  main?: string;
}

interface DetectedService {
  hnau: HnauConfig;
  confidence: 'high' | 'medium' | 'low';
  detectedFrom: string[];
}

const PORT_PATTERNS = [
  /PORT[=:\s]+(\d+)/i,
  /--port[=\s]+(\d+)/i,
  /-p[=\s]+(\d+)/,
  /:(\d{4,5})/,
];

const DEV_SCRIPT_PRIORITY = ['dev', 'start:dev', 'develop', 'serve', 'start', 'watch'];

export async function detectService(
  repoPath: string,
  repoId: string,
  rootRelativePath: string
): Promise<DetectedService | null> {
  const detectedFrom: string[] = [];
  let devCommand = '';
  let port: number | undefined;
  let description: string | undefined;

  const packageJsonPath = path.join(repoPath, 'package.json');
  const packageJsonFile = Bun.file(packageJsonPath);

  if (await packageJsonFile.exists()) {
    detectedFrom.push('package.json');

    try {
      const packageJson: PackageJson = await packageJsonFile.json();

      description = packageJson.description;

      if (packageJson.scripts) {
        for (const scriptName of DEV_SCRIPT_PRIORITY) {
          if (packageJson.scripts[scriptName]) {
            devCommand = detectPackageManager(repoPath) + ' ' + scriptName;
            
            const scriptContent = packageJson.scripts[scriptName];
            const detectedPort = extractPort(scriptContent);
            if (detectedPort) {
              port = detectedPort;
            }
            break;
          }
        }
      }
    } catch {
      // Invalid package.json, continue
    }
  }

  if (!devCommand) {
    const goModPath = path.join(repoPath, 'go.mod');
    if (await Bun.file(goModPath).exists()) {
      detectedFrom.push('go.mod');
      
      const mainGoPath = path.join(repoPath, 'main.go');
      const cmdPath = path.join(repoPath, 'cmd');
      
      if (await Bun.file(mainGoPath).exists()) {
        devCommand = 'go run .';
      } else if (await Bun.file(cmdPath).exists()) {
        devCommand = 'go run ./cmd/...';
      } else {
        devCommand = 'go run .';
      }
    }
  }

  if (!devCommand) {
    const makefilePath = path.join(repoPath, 'Makefile');
    if (await Bun.file(makefilePath).exists()) {
      detectedFrom.push('Makefile');
      devCommand = 'make dev';
    }
  }

  if (!devCommand) {
    const dockerComposePath = path.join(repoPath, 'docker-compose.yml');
    const dockerComposeAltPath = path.join(repoPath, 'docker-compose.yaml');
    if (await Bun.file(dockerComposePath).exists() || await Bun.file(dockerComposeAltPath).exists()) {
      detectedFrom.push('docker-compose');
      devCommand = 'docker-compose up';
    }
  }

  if (!devCommand) {
    return null;
  }

  if (!port) {
    port = await scanForPort(repoPath);
  }

  const confidence = calculateConfidence(detectedFrom, !!port, !!description);

  const hnau: HnauConfig = {
    id: repoId,
    root: rootRelativePath,
    devCommand,
  };

  if (description) {
    hnau.description = description;
  }

  if (port) {
    hnau.port = port;
    hnau.healthCheck = {
      url: `http://localhost:${port}/health`,
      intervalSeconds: 10,
    };
  }

  hnau.logFiles = [`logs/${repoId}-dev.log`];

  return {
    hnau,
    confidence,
    detectedFrom,
  };
}

function detectPackageManager(_repoPath: string): string {
  return 'pnpm';
}

export async function detectPackageManagerAsync(repoPath: string): Promise<string> {
  if (await Bun.file(path.join(repoPath, 'bun.lock')).exists() ||
      await Bun.file(path.join(repoPath, 'bun.lockb')).exists()) {
    return 'bun';
  }
  if (await Bun.file(path.join(repoPath, 'pnpm-lock.yaml')).exists()) {
    return 'pnpm';
  }
  if (await Bun.file(path.join(repoPath, 'yarn.lock')).exists()) {
    return 'yarn';
  }
  return 'npm';
}

function extractPort(scriptContent: string): number | undefined {
  for (const pattern of PORT_PATTERNS) {
    const match = scriptContent.match(pattern);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (port >= 1024 && port <= 65535) {
        return port;
      }
    }
  }
  return undefined;
}

async function scanForPort(repoPath: string): Promise<number | undefined> {
  const filesToCheck = [
    '.env',
    '.env.development',
    '.env.local',
    'config/default.json',
    'src/index.ts',
    'src/server.ts',
    'src/main.ts',
  ];

  for (const file of filesToCheck) {
    const filePath = path.join(repoPath, file);
    const fileHandle = Bun.file(filePath);
    
    if (await fileHandle.exists()) {
      try {
        const content = await fileHandle.text();
        const port = extractPort(content);
        if (port) {
          return port;
        }
      } catch {
        // File not readable, continue
      }
    }
  }

  return undefined;
}

function calculateConfidence(
  detectedFrom: string[],
  hasPort: boolean,
  hasDescription: boolean
): 'high' | 'medium' | 'low' {
  let score = 0;

  if (detectedFrom.includes('package.json')) score += 2;
  if (hasPort) score += 2;
  if (hasDescription) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
