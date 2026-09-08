import type { Mt01SupabaseClient } from './client.js';
import { PersistenceError, toPersistenceError } from './errors.js';

export type TenantRole = 'owner' | 'admin' | 'member';

export type PersistedTenant = {
  id: string;
  slug: string;
  name: string;
  createdBy?: string;
  deletedAt?: Date;
};

export type PersistedMembership = {
  tenantId: string;
  userId: string;
  role: TenantRole;
  active: boolean;
};

export interface TenancyRepository {
  getTenant(tenantId: string): Promise<PersistedTenant | null>;
  getMembership(tenantId: string, userId: string): Promise<PersistedMembership | null>;
  listMembershipsForUser(userId: string): Promise<PersistedMembership[]>;
  createTenant(input: { slug: string; name: string; createdBy: string }): Promise<PersistedTenant>;
  upsertMembership(input: PersistedMembership): Promise<void>;
}

function assertRole(role: string): asserts role is TenantRole {
  if (!['owner', 'admin', 'member'].includes(role)) {
    throw new PersistenceError('PERSISTENCE_INVALID_DATA', 'Persisted membership role is invalid');
  }
}

export function createSupabaseTenancyRepository(client: Mt01SupabaseClient): TenancyRepository {
  return {
    async getTenant(tenantId: string): Promise<PersistedTenant | null> {
      const { data, error } = await client.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      if (error) throw toPersistenceError('get tenant', error);
      if (!data) return null;
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        createdBy: data.created_by ?? undefined,
        deletedAt: data.deleted_at ? new Date(data.deleted_at) : undefined,
      };
    },

    async getMembership(tenantId: string, userId: string): Promise<PersistedMembership | null> {
      const { data, error } = await client
        .from('memberships')
        .select('tenant_id,user_id,role,active')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw toPersistenceError('get membership', error);
      if (!data) return null;
      assertRole(data.role);
      return { tenantId: data.tenant_id, userId: data.user_id, role: data.role, active: data.active };
    },

    async listMembershipsForUser(userId: string): Promise<PersistedMembership[]> {
      const { data, error } = await client
        .from('memberships')
        .select('tenant_id,user_id,role,active')
        .eq('user_id', userId)
        .order('tenant_id');
      if (error) throw toPersistenceError('list memberships', error);
      return (data ?? []).map((row) => {
        assertRole(row.role);
        return { tenantId: row.tenant_id, userId: row.user_id, role: row.role, active: row.active };
      });
    },

    async createTenant(input): Promise<PersistedTenant> {
      const { data, error } = await client
        .from('tenants')
        .insert({ slug: input.slug, name: input.name, created_by: input.createdBy })
        .select('*')
        .single();
      if (error) throw toPersistenceError('create tenant', error);
      return { id: data.id, slug: data.slug, name: data.name, createdBy: data.created_by ?? undefined };
    },

    async upsertMembership(input: PersistedMembership): Promise<void> {
      const { error } = await client.from('memberships').upsert({
        tenant_id: input.tenantId,
        user_id: input.userId,
        role: input.role,
        active: input.active,
      }, { onConflict: 'tenant_id,user_id' });
      if (error) throw toPersistenceError('upsert membership', error);
    },
  };
}
