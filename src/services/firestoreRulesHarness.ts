/**
 * Firebase Firestore Emulator Lifecycle & `@firebase/rules-unit-testing` Harness
 *
 * Connects directly to the official Firebase Firestore Emulator (`cloud-firestore-emulator`)
 * using `@firebase/rules-unit-testing` (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`)
 * and the official `firebase/firestore` client SDK (`getDoc`, `getDocs`, `setDoc`, `updateDoc`,
 * `deleteDoc`, `serverTimestamp`, `Timestamp`).
 *
 * Supports two execution modes against the real Firebase Firestore Emulator:
 * 1. External CLI Runner (`firebase emulators:exec --only firestore ...`):
 *    Automatically discovers the active emulator via `FIRESTORE_EMULATOR_HOST`.
 * 2. Standalone Test Runner (`npm test` / `tsx --test firestore.rules.test.ts`):
 *    If `FIRESTORE_EMULATOR_HOST` is not already listening, automatically starts the official
 *    `cloud-firestore-emulator` Java binary on `127.0.0.1:8080`, uploads `firestore.rules`
 *    via `@firebase/rules-unit-testing`'s `/emulator/v1/projects/{projectId}:securityRules`
 *    endpoint, and stops the managed emulator process on test suite teardown.
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import {
  doc as firestoreDoc,
  collection as firestoreCollection,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';

export {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  type RulesTestEnvironment,
  type RulesTestContext,
};

const DEFAULT_EMULATOR_HOST = '127.0.0.1';
const DEFAULT_EMULATOR_PORT = 8088;
const DEFAULT_PROJECT_ID = 'demo-omnistream-xr';

let managedEmulatorProcess: ChildProcess | null = null;
let activeEmulatorEndpoint: { host: string; port: number } | null = null;

/**
 * Typed wrapper around `firebase/firestore` `doc()` that accepts the compat Firestore
 * instance returned by `@firebase/rules-unit-testing`'s `RulesTestContext.firestore()`.
 */
export function doc(db: ReturnType<RulesTestContext['firestore']> | Firestore, docPath: string) {
  const cleanPath = docPath.startsWith('/') ? docPath.slice(1) : docPath;
  return firestoreDoc(db as unknown as Firestore, cleanPath);
}

/**
 * Typed wrapper around `firebase/firestore` `collection()` that accepts the compat Firestore
 * instance returned by `@firebase/rules-unit-testing`'s `RulesTestContext.firestore()`.
 */
export function collection(
  db: ReturnType<RulesTestContext['firestore']> | Firestore,
  collectionPath: string
) {
  const cleanPath = collectionPath.startsWith('/') ? collectionPath.slice(1) : collectionPath;
  return firestoreCollection(db as unknown as Firestore, cleanPath);
}

/**
 * Creates a real `firebase/firestore` `Timestamp` for testing forged/custom client timestamps.
 */
export function customTimestamp(epochMs: number): Timestamp {
  return Timestamp.fromMillis(epochMs);
}

async function isEmulatorReachable(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`http://${host}:${port}/`, { signal: controller.signal });
    const body = (await res.text()).trim();
    clearTimeout(timer);
    return res.ok && body === 'Ok';
  } catch {
    return false;
  }
}

function parseHostPort(hostAndPort: string): { host: string; port: number } {
  const parsed = new URL(`http://${hostAndPort}`);
  return {
    host: parsed.hostname || DEFAULT_EMULATOR_HOST,
    port: Number(parsed.port || DEFAULT_EMULATOR_PORT),
  };
}

function resolveJavaBinary(): string {
  const candidates = ['/usr/local/bin/java', '/usr/local/jre/bin/java', '/usr/bin/java'];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  try {
    const whichJava = execSync('which java', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whichJava) return whichJava;
  } catch {
    // Provision portable Temurin 21 JRE if missing in a clean CI container
  }

  const jreDir = '/usr/local/jre';
  fs.mkdirSync(jreDir, { recursive: true });
  execSync(
    'curl -sL "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse" | tar -xz -C /usr/local/jre --strip-components=1 && ln -sf /usr/local/jre/bin/java /usr/local/bin/java',
    { stdio: 'inherit' }
  );
  return '/usr/local/bin/java';
}

function resolveFirestoreEmulatorJar(): string {
  const cacheDir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  const findJar = (): string | null => {
    if (!fs.existsSync(cacheDir)) return null;
    const files = fs
      .readdirSync(cacheDir)
      .filter((f) => f.startsWith('cloud-firestore-emulator') && f.endsWith('.jar'))
      .sort()
      .reverse();
    return files.length > 0 ? path.join(cacheDir, files[0]) : null;
  };

  const existingJar = findJar();
  if (existingJar) return existingJar;

  execSync('firebase setup:emulators:firestore', { stdio: 'inherit' });
  const downloadedJar = findJar();
  if (!downloadedJar) {
    throw new Error(
      `Failed to locate cloud-firestore-emulator JAR in ${cacheDir}. Run 'firebase setup:emulators:firestore'.`
    );
  }
  return downloadedJar;
}

/**
 * Ensures the official Firebase Firestore Emulator is running and reachable,
 * setting `process.env.FIRESTORE_EMULATOR_HOST` for `@firebase/rules-unit-testing`.
 */
export async function ensureFirestoreEmulator(): Promise<{ host: string; port: number }> {
  if (activeEmulatorEndpoint && (await isEmulatorReachable(activeEmulatorEndpoint.host, activeEmulatorEndpoint.port))) {
    return activeEmulatorEndpoint;
  }

  const envHostPort = process.env.FIRESTORE_EMULATOR_HOST
    ? parseHostPort(process.env.FIRESTORE_EMULATOR_HOST)
    : { host: DEFAULT_EMULATOR_HOST, port: DEFAULT_EMULATOR_PORT };

  if (await isEmulatorReachable(envHostPort.host, envHostPort.port)) {
    process.env.FIRESTORE_EMULATOR_HOST = `${envHostPort.host}:${envHostPort.port}`;
    activeEmulatorEndpoint = envHostPort;
    return envHostPort;
  }

  const javaBin = resolveJavaBinary();
  const jarPath = resolveFirestoreEmulatorJar();
  const host = DEFAULT_EMULATOR_HOST;
  const port = DEFAULT_EMULATOR_PORT;

  managedEmulatorProcess = spawn(
    javaBin,
    ['-Duser.language=en', '-jar', jarPath, '--host', host, '--port', String(port)],
    {
      stdio: 'ignore',
      detached: false,
    }
  );

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isEmulatorReachable(host, port)) {
      process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
      activeEmulatorEndpoint = { host, port };
      return activeEmulatorEndpoint;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await stopManagedFirestoreEmulator();
  throw new Error(`Timed out waiting for Firebase Firestore Emulator on ${host}:${port}`);
}

/**
 * Stops the managed Firebase Firestore Emulator process if it was spawned by this harness.
 */
export async function stopManagedFirestoreEmulator(): Promise<void> {
  if (managedEmulatorProcess) {
    const proc = managedEmulatorProcess;
    managedEmulatorProcess = null;
    activeEmulatorEndpoint = null;
    proc.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process already exited
        }
        resolve();
      }, 1500);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  try {
    if (fs.existsSync('firestore-debug.log')) {
      fs.unlinkSync('firestore-debug.log');
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Initializes an official `@firebase/rules-unit-testing` `RulesTestEnvironment`
 * backed by the running Firebase Firestore Emulator and loads `firestore.rules`.
 */
export async function initializeRulesTestEnvironment(options?: {
  projectId?: string;
  rulesPath?: string;
  rulesSource?: string;
}): Promise<RulesTestEnvironment> {
  const { host, port } = await ensureFirestoreEmulator();
  setLogLevel('error');

  const projectId =
    options?.projectId ||
    `${DEFAULT_PROJECT_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const rules =
    options?.rulesSource ??
    fs.readFileSync(options?.rulesPath || 'firestore.rules', 'utf8');

  return initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules,
    },
  });
}
