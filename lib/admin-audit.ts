import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

// ─── ROLE-BASED ACCESS CONTROL (RBAC) ───
export type AdminRole = "super_admin" | "finance_admin" | "moderator";

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
}

export function canManageFinance(role: AdminRole): boolean {
  return role === "super_admin" || role === "finance_admin";
}

export function canManageUsers(role: AdminRole): boolean {
  return role === "super_admin" || role === "finance_admin";
}

export function canModerate(role: AdminRole): boolean {
  return role === "super_admin" || role === "moderator";
}

export function canManageSystem(role: AdminRole): boolean {
  return role === "super_admin";
}

// ─── AUDIT LOG ENTRY ───
export interface AuditLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: AdminRole;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  createdAt: string;
}

export const STORAGE_AUDIT_LOGS = "nuenime.admin.audit_logs";

/**
 * Mencatat tindakan penting admin ke dalam audit log
 */
export async function logAdminAction(params: {
  admin: AdminUser;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
}): Promise<AuditLogItem> {
  const item: AuditLogItem = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    adminId: params.admin.id,
    adminEmail: params.admin.email,
    adminRole: params.admin.role,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: new Date().toISOString(),
  };

  try {
    const raw = await AsyncStorage.getItem(STORAGE_AUDIT_LOGS);
    const list: AuditLogItem[] = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    // Simpan hingga 500 entri terbaru
    await AsyncStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify(list.slice(0, 500)));

    // Simpan ke Supabase jika terhubung
    try {
      await supabase.from("admin_audit_logs").insert({
        id: item.id,
        admin_id: item.adminId,
        admin_email: item.adminEmail,
        admin_role: item.adminRole,
        action: item.action,
        target_type: item.targetType,
        target_id: item.targetId,
        details: item.details,
        created_at: item.createdAt,
      });
    } catch {}
  } catch {}

  return item;
}

export async function getAdminAuditLogs(): Promise<AuditLogItem[]> {
  try {
    // 1. Coba ambil data riwayat dari Supabase
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: AuditLogItem[] = data.map((d: any) => ({
          id: d.id,
          adminId: d.admin_id || "admin",
          adminEmail: d.admin_email || "admin@nuenime.com",
          adminRole: (d.admin_role as AdminRole) || "super_admin",
          action: d.action,
          targetType: d.target_type || "system",
          targetId: d.target_id || "",
          details: typeof d.details === "string" ? JSON.parse(d.details) : (d.details || {}),
          createdAt: d.created_at,
        }));
        await AsyncStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify(mapped));
        return mapped;
      }
    } catch {}

    // 2. Fallback ke local cache AsyncStorage
    const raw = await AsyncStorage.getItem(STORAGE_AUDIT_LOGS);
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}
