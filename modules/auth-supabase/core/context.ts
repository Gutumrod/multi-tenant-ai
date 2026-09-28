import { AuthError } from './error.js';
import type { 
  AuthContext, 
  GetCurrentUserOptions, 
  SupabaseAuthClient
} from './types.js';

/**
 * Resolves current user session into a normalized AuthContext.
 */
export async function getCurrentUser(
  client: SupabaseAuthClient,
  options?: GetCurrentUserOptions
): Promise<AuthContext | null> {
  const { data, error } = await client.auth.getUser(options?.jwt);

  if (error) {
    // If Supabase returns an error, we check if it's a session error
    const isInvalidSession = 
      error.status === 401 || 
      error.code === 'jwt_expired' || 
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('expired');

    if (isInvalidSession) {
      throw new AuthError({
        message: error.message,
        code: 'INVALID_SESSION',
        status: 401,
        cause: error
      });
    }
    
    // For other errors (network, etc.), we return null as it might be an unauthenticated state
    return null;
  }

  const user = data.user;
  if (!user) return null;

  // 1. Resolve Roles
  // WU-1 SECURITY: authorization reads server-controlled claims only
  // (`app_metadata`, which the end user cannot write). `user_metadata` is
  // user-writable in Supabase (`auth.updateUser({ data })`) and must never be
  // an authorization source — see security-user-metadata.test.ts.
  let roles: string[] = [];
  if (options?.roleResolver) {
    roles = await options.roleResolver(user);
  } else {
    // Default role resolution
    const metadataRoles = user.app_metadata?.roles as string[] | undefined;
    roles = metadataRoles || (user.role ? [user.role] : []);
  }

  // 2. Resolve Tenant
  let tenantId: string | undefined;
  if (options?.tenantResolver) {
    tenantId = await options.tenantResolver(user);
  } else {
    // Default tenant resolution (server-controlled claim only)
    tenantId = user.app_metadata?.tenant_id as string | undefined;
  }

  // 3. Resolve Permissions
  let permissions: string[] = [];
  if (options?.permissionResolver) {
    permissions = await options.permissionResolver(user, roles);
  } else {
    // Default permission resolution (server-controlled claim only)
    permissions = (user.app_metadata?.permissions as string[] | undefined) || [];
  }

  const context: AuthContext = {
    userId: user.id,
    email: user.email,
    roles,
    tenantId,
    permissions,
    // `user_metadata` is deliberately NOT spread here: it is user-writable and
    // would otherwise override `app_metadata` with attacker-controlled values.
    metadata: {
      ...user.app_metadata
    }
  };

  return Object.freeze(context);
}

/**
 * Requires an authenticated user session.
 */
export async function requireUser(
  client: SupabaseAuthClient,
  options?: GetCurrentUserOptions
): Promise<AuthContext> {
  const context = await getCurrentUser(client, options);
  
  if (!context) {
    throw new AuthError({
      message: 'Authentication required',
      code: 'UNAUTHENTICATED',
      status: 401
    });
  }

  return context;
}
