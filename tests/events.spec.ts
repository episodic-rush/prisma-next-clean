import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type TestClient } from './utils/client';
import { validEvent } from './utils/payload';

describe('POST /events — happy path', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await createClient();
  }, 180_000);

  afterAll(async () => {
    await client.close();
  });

  it('accepts a minimal required payload with 202', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent());
    expect(res.status).toBe(202);
  });

  it('accepts a payload with all optional fields populated', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(
        validEvent({
          flags: ['--force', '--yes'],
          packageManager: 'pnpm',
          databaseTarget: 'postgres',
          tsVersion: '5.9.2',
          agent: 'claude-code',
          extensions: ['postgis'],
        }),
      );
    expect(res.status).toBe(202);
  });

  it('accepts explicit nulls for the optional string fields', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(
        validEvent({
          packageManager: null,
          databaseTarget: null,
          tsVersion: null,
          agent: null,
        }),
      );
    expect(res.status).toBe(202);
  });

  it('ingests repeated events for the same installation', async () => {
    const installationId = `install-shared-${Date.now()}`;
    for (const command of ['init', 'migrate', 'studio']) {
      const res = await client
        .post('/events')
        .set('content-type', 'application/json')
        .send(validEvent({ installationId, command }));
      expect(res.status).toBe(202);
    }
  });

  it('returns an empty body on success', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent());
    expect(res.status).toBe(202);
    expect(res.text ?? '').toBe('');
  });
});
