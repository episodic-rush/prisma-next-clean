import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type TestClient } from './utils/client';
import { validEvent } from './utils/payload';

describe('routing & method handling', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await createClient();
  }, 180_000);

  afterAll(async () => {
    await client.close();
  });

  it('returns 404 for an unknown path', async () => {
    const res = await client.get(`/unknown-${Date.now()}`);
    expect(res.status).toBe(404);
  });

  it('returns 405 for GET on /events', async () => {
    const res = await client.get('/events');
    expect(res.status).toBe(405);
  });

  it('returns 405 for PUT on /events', async () => {
    const res = await client.put('/events').send(validEvent());
    expect(res.status).toBe(405);
  });

  it('returns 405 for DELETE on /events', async () => {
    const res = await client.delete('/events');
    expect(res.status).toBe(405);
  });

  it('returns 405 for PATCH on /events', async () => {
    const res = await client.patch('/events').send(validEvent());
    expect(res.status).toBe(405);
  });

  it('rejects an oversized declared content-length with 413', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .set('content-length', String(64 * 1024))
      .send(validEvent());
    expect(res.status).toBe(413);
  });
});
