import { randomUUID } from 'node:crypto';

export interface TelemetryEventPayload {
  installationId: string;
  version: string;
  command: string;
  runtimeName: string;
  runtimeVersion: string;
  os: string;
  arch: string;
  flags?: string[];
  packageManager?: string | null;
  databaseTarget?: string | null;
  tsVersion?: string | null;
  agent?: string | null;
  extensions?: string[];
}

/**
 * Builds a valid telemetry event with unique identifiers so runs against a
 * shared/real database never collide. Any field can be overridden.
 */
export function validEvent(overrides: Partial<TelemetryEventPayload> = {}): TelemetryEventPayload {
  return {
    installationId: `install-${randomUUID()}`,
    version: '0.16.0',
    command: 'init',
    runtimeName: 'node',
    runtimeVersion: '24.0.0',
    os: 'linux',
    arch: 'x64',
    ...overrides,
  };
}
