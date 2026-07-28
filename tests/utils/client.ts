import request from 'supertest';
import { startPrismaDevServer } from '@prisma/dev';
import { createTelemetryDb, type TelemetryDb } from '../../apps/telemetry-backend/src/db';
import { createHandler } from '../../apps/telemetry-backend/src/handler';
import { startNodeTelemetryServer } from '../../apps/telemetry-backend/src/node-server';
import type { TelemetryServer } from '../../apps/telemetry-backend/src/server-runtime';
import { applyTelemetrySchema } from './schema';

export interface TestClient {
  post(path: string): request.Test;
  get(path: string): request.Test;
  patch(path: string): request.Test;
  put(path: string): request.Test;
  delete(path: string): request.Test;
  close(): Promise<void>;
}

// Deployed mode: hit a real URL over HTTP.
class RemoteClient implements TestClient {
  constructor(private baseUrl: string) {}
  post(path: string) {
    return request(this.baseUrl).post(path);
  }
  get(path: string) {
    return request(this.baseUrl).get(path);
  }
  patch(path: string) {
    return request(this.baseUrl).patch(path);
  }
  put(path: string) {
    return request(this.baseUrl).put(path);
  }
  delete(path: string) {
    return request(this.baseUrl).delete(path);
  }
  async close() {}
}

interface PrismaDevServer {
  database: { connectionString: string };
  close(): Promise<void>;
}

/**
 * Local mode: boot the real telemetry backend in-process against an in-memory
 * Postgres (@prisma/dev — a WASM PGlite server), with the schema applied from
 * the committed contract. No external services are required.
 */
class LocalClient implements TestClient {
  private baseUrl!: string;
  private devServer!: PrismaDevServer;
  private httpServer!: TelemetryServer;
  private db!: TelemetryDb;

  async init() {
    this.devServer = (await startPrismaDevServer({
      databaseConnectTimeoutMillis: 1000,
      databaseIdleTimeoutMillis: 1000,
    })) as unknown as PrismaDevServer;

    // PGlite advertises `localhost`; force IPv4 so `pg` doesn't stall on ::1.
    const url = new URL(this.devServer.database.connectionString);
    if (url.hostname === 'localhost' || url.hostname === '::1') {
      url.hostname = '127.0.0.1';
    }
    const connectionString = url.toString();

    await applyTelemetrySchema(connectionString);

    this.db = createTelemetryDb(connectionString);
    // No rate limiter in local mode: parallel test requests must not 429.
    this.httpServer = await startNodeTelemetryServer({
      port: 0,
      handler: createHandler({ db: this.db }),
    });
    this.baseUrl = `http://127.0.0.1:${this.httpServer.port}`;
  }

  post(path: string) {
    return request(this.baseUrl).post(path);
  }
  get(path: string) {
    return request(this.baseUrl).get(path);
  }
  patch(path: string) {
    return request(this.baseUrl).patch(path);
  }
  put(path: string) {
    return request(this.baseUrl).put(path);
  }
  delete(path: string) {
    return request(this.baseUrl).delete(path);
  }

  async close() {
    await this.httpServer?.stop();
    await this.db?.runtime().close();
    await this.devServer?.close();
  }
}

export async function createClient(): Promise<TestClient> {
  const appUrl = process.env['APP_URL'];
  if (appUrl) {
    console.log(`[test] Running against deployed app: ${appUrl}`);
    return new RemoteClient(appUrl);
  }
  console.log('[test] Running locally with in-memory Postgres');
  const client = new LocalClient();
  await client.init();
  return client;
}
