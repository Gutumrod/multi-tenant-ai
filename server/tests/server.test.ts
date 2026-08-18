import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('multi-tenant-ai reference server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  describe('GET /health', () => {
    it('returns 200 { ok: true } without tenant header', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    });
  });

  describe('GET /whoami (tenant-gated)', () => {
    it('returns 400 when x-tenant-id header is missing', async () => {
      const response = await fetch(`${baseUrl}/whoami`);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Missing or invalid x-tenant-id header',
      });
    });

    it('returns tenant context when valid x-tenant-id header is provided', async () => {
      const response = await fetch(`${baseUrl}/whoami`, {
        headers: {
          'x-tenant-id': 'tenant-test-123',
        },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        tenantId: 'tenant-test-123',
        metadata: {
          resolvedVia: 'header',
          headerName: 'x-tenant-id',
        },
      });
    });
  });

  describe('GET /me (tenant + auth gated)', () => {
    it('returns 400 when x-tenant-id header is missing', async () => {
      const response = await fetch(`${baseUrl}/me`);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Missing or invalid x-tenant-id header',
      });
    });

    it('returns 503 when Supabase auth is not configured on the server', async () => {
      const response = await fetch(`${baseUrl}/me`, {
        headers: {
          'x-tenant-id': 'tenant-test-123',
        },
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: 'Auth not configured on this server instance',
      });
    });
  });

  describe('POST /ai/demo (tenant + auth gated)', () => {
    it('returns 400 when x-tenant-id header is missing', async () => {
      const response = await fetch(`${baseUrl}/ai/demo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'Hello world' }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Missing or invalid x-tenant-id header',
      });
    });

    it('is rejected by auth gate when auth is unconfigured or unauthorized', async () => {
      const response = await fetch(`${baseUrl}/ai/demo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-test-123',
        },
        body: JSON.stringify({ prompt: 'Hello world' }),
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: 'Auth not configured on this server instance',
      });
    });
  });

  describe('POST /subscription/subscribe (tenant + auth gated)', () => {
    it('returns 400 when x-tenant-id header is missing', async () => {
      const response = await fetch(`${baseUrl}/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Missing or invalid x-tenant-id header',
      });
    });

    it('is rejected by auth gate when auth is unconfigured', async () => {
      const response = await fetch(`${baseUrl}/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-test-123',
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: 'Auth not configured on this server instance',
      });
    });
  });
});
