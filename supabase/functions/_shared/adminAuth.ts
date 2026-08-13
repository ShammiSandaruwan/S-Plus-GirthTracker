import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AdminAuthResult {
  ok: boolean;
  status?: number;
  error?: string;
  user?: any;
  adminUserId?: string;
  role?: 'superadmin' | 'admin' | 'manager';
  canInviteUsers?: boolean;
  estateIds?: string[];
  estateCodes?: string[];
  estateNames?: string[];
}

export async function resolveAdminAuth(
  supabaseAdmin: ReturnType<typeof createClient>,
  adminToken: string | null
): Promise<AdminAuthResult> {
  if (!adminToken) return { ok: false, status: 401, error: 'Missing authorization token' };

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(adminToken);
  if (userError || !user) return { ok: false, status: 401, error: 'Invalid or expired admin session' };

  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('id, role, can_invite_users, admin_user_estates(estate_id, expires_at, estates(code, name))')
    .eq('auth_uid', user.id)
    .eq('active', true)
    .single();

  if (adminError || !adminUser) {
    return { ok: false, status: 403, error: 'Unauthorized: User is not an active admin' };
  }

  // Filter out expired estate assignments — single enforcement point
  const now = new Date();
  const activeEstateRows = (adminUser.admin_user_estates || []).filter((r: any) =>
    !r.expires_at || new Date(r.expires_at) > now
  );

  return {
    ok: true,
    user,
    adminUserId: adminUser.id,
    role: adminUser.role,
    canInviteUsers: adminUser.can_invite_users === true,
    estateIds: activeEstateRows.map((r: any) => r.estate_id),
    estateCodes: activeEstateRows.map((r: any) => r.estates?.code).filter(Boolean),
    estateNames: activeEstateRows.map((r: any) => r.estates?.name).filter(Boolean),
  };
}
