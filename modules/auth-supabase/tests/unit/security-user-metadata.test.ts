import { describe, it, expect, vi } from 'vitest';
import { getCurrentUser, requireUser } from '../../core/context.js';
import { createSupabaseAuthHelpers } from '../../core/client.js';
import {
  requireRole,
  requirePermission,
  requireTenantMembership,
} from '../../core/guards.js';
import { AuthError } from '../../core/error.js';
import type { SupabaseAuthClient } from '../../core/types.js';

/**
 * WU-1 security regression tests.
 *
 * In Supabase, `user_metadata` is writable by the end user themselves
 * (`auth.updateUser({ data })`). It therefore must never be an authorization
 * source: roles, tenant_id and permissions may only come from server-controlled
 * claims (`app_metadata` / JWT claims issued server-side), and `user_metadata`
 * must not override `app_metadata` in the metadata handed downstream.
 */
function makeClient(user: unknown): SupabaseAuthClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as unknown as SupabaseAuthClient;
}

describe('auth-supabase — user_metadata is never an authorization source', () => {
  it('does not grant a role declared in user_metadata (self-declared admin)', async () => {
    const context = await getCurrentUser(
      makeClient({ id: 'u-1', app_metadata: {}, user_metadata: { roles: ['admin'] } })
    );

    expect(context).not.toBeNull();
    expect(context!.roles).toEqual([]);
    expect(() => requireRole(context!, 'admin')).toThrow(AuthError);
  });

  it('does not accept a tenant declared in user_metadata (cross-tenant escalation)', async () => {
    const context = await getCurrentUser(
      makeClient({ id: 'u-2', app_metadata: {}, user_metadata: { tenant_id: 'victim-tenant' } })
    );

    expect(context!.tenantId).toBeUndefined();
    expect(() => requireTenantMembership(context!, 'victim-tenant')).toThrow(AuthError);
  });

  it('does not grant permissions declared in user_metadata', async () => {
    const context = await getCurrentUser(
      makeClient({ id: 'u-3', app_metadata: {}, user_metadata: { permissions: ['billing:write'] } })
    );

    expect(context!.permissions).toEqual([]);
    expect(() => requirePermission(context!, 'billing:write')).toThrow(AuthError);
  });

  it('does not let user_metadata override app_metadata in the forwarded metadata', async () => {
    const context = await getCurrentUser(
      makeClient({
        id: 'u-4',
        app_metadata: { roles: ['member'], tenant_id: 'tenant-real', plan: 'pro' },
        user_metadata: { roles: ['admin'], tenant_id: 'victim-tenant', plan: 'evil' },
      })
    );

    expect(context!.roles).toEqual(['member']);
    expect(context!.tenantId).toBe('tenant-real');
    expect(context!.metadata?.roles).toEqual(['member']);
    expect(context!.metadata?.tenant_id).toBe('tenant-real');
    expect(context!.metadata?.plan).toBe('pro');
  });

  it('still resolves roles/tenant/permissions from app_metadata (no regression)', async () => {
    const context = await getCurrentUser(
      makeClient({
        id: 'u-5',
        app_metadata: { roles: ['admin'], tenant_id: 'tenant-1', permissions: ['billing:read'] },
        user_metadata: {},
      })
    );

    expect(context!.roles).toEqual(['admin']);
    expect(context!.tenantId).toBe('tenant-1');
    expect(context!.permissions).toEqual(['billing:read']);
    expect(() => requireRole(context!, 'admin')).not.toThrow();
    expect(() => requireTenantMembership(context!, 'tenant-1')).not.toThrow();
  });

  it('host-injected resolvers still win over any metadata (no regression)', async () => {
    const context = await getCurrentUser(
      makeClient({
        id: 'u-6',
        app_metadata: { roles: ['member'] },
        user_metadata: { roles: ['admin'], tenant_id: 'victim-tenant' },
      }),
      { roleResolver: () => ['custom-role'], tenantResolver: () => 'custom-tenant' }
    );

    expect(context!.roles).toEqual(['custom-role']);
    expect(context!.tenantId).toBe('custom-tenant');
  });

  it('rejects self-declared escalation through the helpers wired by the reference server', async () => {
    const helpers = createSupabaseAuthHelpers({
      supabaseClient: makeClient({
        id: 'u-7',
        app_metadata: {},
        user_metadata: { roles: ['admin'], tenant_id: 'victim-tenant', permissions: ['billing:write'] },
      }),
    });

    const context = await helpers.requireUser({ jwt: 'fake.jwt' });
    expect(context.roles).toEqual([]);
    expect(context.tenantId).toBeUndefined();
    expect(context.permissions).toEqual([]);

    await expect(helpers.requireRole('admin', { jwt: 'fake.jwt' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      helpers.requireTenantMembership('victim-tenant', { jwt: 'fake.jwt' })
    ).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    await expect(
      helpers.requirePermission('billing:write', { jwt: 'fake.jwt' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requireUser still fails closed for an unauthenticated request (no regression)', async () => {
    await expect(requireUser(makeClient(null))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
