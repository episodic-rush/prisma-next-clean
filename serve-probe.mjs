import { startPrismaDevServer } from '@prisma/dev';
import { createTelemetryDb } from './apps/telemetry-backend/src/db.ts';
import { createHandler } from './apps/telemetry-backend/src/handler.ts';
import { startNodeTelemetryServer } from './apps/telemetry-backend/src/node-server.ts';
import { applyTelemetrySchema } from './tests/utils/schema.ts';

const dev = await startPrismaDevServer({ databaseConnectTimeoutMillis: 1000, databaseIdleTimeoutMillis: 1000 });
const u = new URL(dev.database.connectionString);
if (u.hostname === 'localhost' || u.hostname === '::1') u.hostname = '127.0.0.1';
await applyTelemetrySchema(u.toString());
const db = createTelemetryDb(u.toString());
const s = await startNodeTelemetryServer({ port: 0, handler: createHandler({ db }) });
console.log('LISTENING_ON ' + s.port);
