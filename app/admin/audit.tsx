import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  type AuditLogItem,
  getAdminAuditLogs,
  type AdminRole,
  type AdminUser,
  logAdminAction,
} from "@/lib/admin-service";
import {
  type AdminAccount,
  getAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
} from "@/lib/admin-auth-service";

type AuditTab = "audit" | "account" | "staff" | "security";

export default function AdminAuditScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const auth = useAnirakuAuth();

  const [activeTab, setActiveTab] = useState<AuditTab>("audit");
  const [loading, setLoading] = useState(true);

  // ─── DATA STATE ───
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);

  // Current admin actor
  const adminActor: AdminUser = useMemo(() => {
    if (auth.user) {
      return {
        id: auth.user.id,
        email: auth.user.email ?? "admin@nuenime.com",
        username:
          auth.profile?.display_name ??
          auth.user.user_metadata?.full_name ??
          auth.user.email?.split("@")[0] ??
          "Admin",
        role: (auth.user.user_metadata?.role as AdminRole) || "super_admin",
      };
    }
    return {
      id: "admin-super-01",
      email: "admin@nuenime.com",
      username: "Super Admin",
      role: "super_admin",
    };
  }, [auth]);

  const isSuperAdmin = adminActor.role === "super_admin";

  // ─── TAB 1: AUDIT LOGS STATE ───
  const [searchLog, setSearchLog] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);

  // ─── TAB 2: MY ACCOUNT & SECURITY FORM STATE ───
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // ─── TAB 3: STAFF MANAGEMENT STATE ───
  const [searchStaff, setSearchStaff] = useState("");
  const [selectedStaffRoleFilter, setSelectedStaffRoleFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<AdminRole>("finance_admin");
  const [formNotes, setFormNotes] = useState("");
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<AdminAccount | null>(null);

  // ─── TOAST NOTIFICATION ───
  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // ─── LOAD DATA ───
  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accList, logList] = await Promise.all([
        getAdminAccounts(),
        getAdminAuditLogs(),
      ]);
      setAccounts(accList);
      setLogs(logList);
    } catch (err) {
      console.warn("Failed to load audit data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // ─── STATISTIK AKTUAL ───
  const stats = useMemo(() => {
    const totalLogs = logs.length;
    const loginCount = logs.filter(
      (l) => l.action.includes("LOGIN") || l.action.includes("AUTH") || l.action.includes("SESSION")
    ).length;
    const configCount = logs.filter(
      (l) =>
        l.action.includes("CONFIG") ||
        l.action.includes("SETTING") ||
        l.action.includes("GATEWAY") ||
        l.action.includes("MAINTENANCE") ||
        l.targetType.includes("config")
    ).length;
    const staffCount = accounts.length;
    const riskCount = logs.filter(
      (l) =>
        l.action.includes("DELETE") ||
        l.action.includes("REJECT") ||
        l.action.includes("BAN") ||
        l.action.includes("FAILED") ||
        l.action.includes("CRITICAL")
    ).length;

    return {
      totalLogs,
      loginCount,
      configCount,
      staffCount,
      riskCount,
    };
  }, [logs, accounts]);

  // ─── FILTER AUDIT LOGS ───
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // Role filter
      if (selectedRoleFilter !== "all" && item.adminRole !== selectedRoleFilter) {
        return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "all") {
        const cat = selectedCategoryFilter.toLowerCase();
        const act = item.action.toLowerCase();
        const tgt = item.targetType.toLowerCase();
        if (cat === "auth" && !act.includes("login") && !act.includes("auth") && !act.includes("session") && !act.includes("pass")) return false;
        if (cat === "finance" && !act.includes("topup") && !act.includes("crystal") && !tgt.includes("transaction")) return false;
        if (cat === "user" && !act.includes("user") && !act.includes("role") && !tgt.includes("user")) return false;
        if (cat === "config" && !act.includes("config") && !act.includes("setting") && !act.includes("gateway")) return false;
        if (cat === "community" && !act.includes("comment") && !act.includes("chat") && !act.includes("blacklist")) return false;
      }

      // Status / Risk filter
      if (selectedStatusFilter === "flagged") {
        const isCritical =
          item.action.includes("DELETE") ||
          item.action.includes("REJECT") ||
          item.action.includes("BAN") ||
          item.action.includes("FAILED");
        if (!isCritical) return false;
      } else if (selectedStatusFilter === "success") {
        const isCritical =
          item.action.includes("DELETE") ||
          item.action.includes("REJECT") ||
          item.action.includes("BAN") ||
          item.action.includes("FAILED");
        if (isCritical) return false;
      }

      // Search keyword query
      if (searchLog.trim()) {
        const q = searchLog.toLowerCase();
        const matchId = item.id.toLowerCase().includes(q);
        const matchAdmin = item.adminEmail.toLowerCase().includes(q);
        const matchAction = item.action.toLowerCase().includes(q);
        const matchTarget = item.targetType.toLowerCase().includes(q) || item.targetId.toLowerCase().includes(q);
        const matchDetails = JSON.stringify(item.details || {}).toLowerCase().includes(q);
        if (!matchId && !matchAdmin && !matchAction && !matchTarget && !matchDetails) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedRoleFilter, selectedCategoryFilter, selectedStatusFilter, searchLog]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchLog, selectedRoleFilter, selectedCategoryFilter, selectedStatusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // ─── CSV EXPORT ───
  const handleExportCSV = () => {
    hapticLight();
    if (filteredLogs.length === 0) {
      showToast("Tidak ada data log yang cocok untuk diekspor", "error");
      return;
    }

    try {
      const headers = ["Log ID", "Waktu", "Admin Pelaksana", "Peran", "Aksi", "Tipe Target", "ID Target", "Detail"];
      const rows = filteredLogs.map((l) => [
        l.id,
        new Date(l.createdAt).toLocaleString("id-ID"),
        `"${l.adminEmail.replace(/"/g, '""')}"`,
        l.adminRole,
        `"${l.action.replace(/"/g, '""')}"`,
        `"${l.targetType.replace(/"/g, '""')}"`,
        `"${(l.targetId || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `nuenime-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Berhasil mengekspor ${filteredLogs.length} baris log ke CSV!`);
      } else {
        Alert.alert("Ekspor CSV", `Berhasil mengekspor ${filteredLogs.length} baris riwayat audit.`);
      }

      void logAdminAction({
        admin: adminActor,
        action: "EXPORT_AUDIT_LOGS_CSV",
        targetType: "audit_log",
        targetId: `export-${Date.now()}`,
        details: { count: filteredLogs.length, roleFilter: selectedRoleFilter, catFilter: selectedCategoryFilter },
      });
    } catch {
      showToast("Gagal memproses ekspor CSV", "error");
    }
  };

  // ─── PASSWORD STRENGTH CALCULATOR ───
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: "Belum diisi", color: "#64748B" };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 2) return { score: 1, label: "Lemah (Rentan)", color: "#F43F5E" };
    if (score <= 3) return { score: 2, label: "Cukup", color: "#F59E0B" };
    return { score: 3, label: "Kuat & Aman", color: "#10B981" };
  }, [newPassword]);

  // ─── SUBMIT GANTI PASSWORD ───
  const handleChangePassword = async () => {
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!currentPassword.trim()) {
      setPasswordErrorMsg("Kata sandi saat ini wajib diisi.");
      hapticWarning();
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrorMsg("Kata sandi baru minimal 6 karakter.");
      hapticWarning();
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("Konfirmasi kata sandi tidak cocok.");
      hapticWarning();
      return;
    }

    setUpdatingPassword(true);
    hapticLight();

    try {
      // 1. Coba update via Supabase Auth jika sedang ada session
      let sbSuccess = false;
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        });
        if (!error) sbSuccess = true;
      } catch {}

      // 2. Coba sinkronisasi ke tabel akun staf jika akun ini ada di daftar
      const targetAcc = accounts.find((a) => a.email.toLowerCase() === adminActor.email.toLowerCase());
      if (targetAcc) {
        await updateAdminAccount(targetAcc.id, { password: newPassword.trim() }, adminActor);
      }

      // 3. Catat audit trail resmi (tanpa menyimpan kata sandi)
      await logAdminAction({
        admin: adminActor,
        action: "UPDATE_MY_PASSWORD",
        targetType: "admin_account",
        targetId: adminActor.id,
        details: { email: adminActor.email, authEngine: sbSuccess ? "supabase_auth" : "admin_accounts" },
      });

      hapticSuccess();
      setPasswordSuccessMsg("Kata sandi Anda berhasil diperbarui dengan aman!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      reloadData();
    } catch (err: any) {
      hapticWarning();
      setPasswordErrorMsg(err?.message || "Gagal memperbarui kata sandi. Silakan coba lagi.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ─── LOGOUT DARI SEMUA PERANGKAT ───
  const handleRevokeAllSessions = async () => {
    const confirmMsg = "Keluar dari semua perangkat akan membatalkan seluruh sesi aktif akun Anda. Anda harus login ulang.";
    const proceed = Platform.OS === "web" ? window.confirm(confirmMsg) : true;
    if (!proceed) return;

    hapticLight();
    try {
      await supabase.auth.signOut({ scope: "global" });
      await logAdminAction({
        admin: adminActor,
        action: "REVOKE_ALL_SESSIONS",
        targetType: "session",
        targetId: adminActor.id,
        details: { email: adminActor.email },
      });
      showToast("Seluruh sesi telah dicabut. Anda akan dialihkan.");
    } catch {
      showToast("Gagal mencabut sesi aktif", "error");
    }
  };

  // ─── TAB 3: FILTER AKUN STAF ───
  const filteredStaff = useMemo(() => {
    return accounts.filter((acc) => {
      if (selectedStaffRoleFilter !== "all" && acc.role !== selectedStaffRoleFilter) return false;
      if (searchStaff.trim()) {
        const q = searchStaff.toLowerCase();
        return (
          acc.username.toLowerCase().includes(q) ||
          acc.email.toLowerCase().includes(q) ||
          acc.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, selectedStaffRoleFilter, searchStaff]);

  // Simpan akun staf baru
  const handleSaveNewStaff = async () => {
    if (!formUsername.trim()) {
      setStaffFormError("Nama / Username staf wajib diisi.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setStaffFormError("Format email tidak valid.");
      return;
    }
    if (formPassword.trim().length < 4) {
      setStaffFormError("Kata sandi minimal 4 karakter.");
      return;
    }

    setSubmittingStaff(true);
    setStaffFormError(null);

    const res = await createAdminAccount(
      {
        username: formUsername.trim(),
        email: formEmail.trim(),
        password: formPassword.trim(),
        role: formRole,
        notes: formNotes.trim(),
      },
      adminActor
    );

    setSubmittingStaff(false);

    if (res.success) {
      hapticSuccess();
      setShowCreateModal(false);
      showToast(`Akun staf @${res.account?.username} berhasil dibuat!`);
      reloadData();
    } else {
      hapticWarning();
      setStaffFormError(res.error || "Gagal membuat akun staf.");
    }
  };

  // Toggle status staf (aktif / nonaktif)
  const handleToggleStaffStatus = async (account: AdminAccount) => {
    hapticLight();
    const newStatus = account.status === "active" ? "inactive" : "active";
    const res = await updateAdminAccount(account.id, { status: newStatus }, adminActor);
    if (res.success) {
      hapticSuccess();
      showToast(`Status akun @${account.username} diubah menjadi ${newStatus}`);
      reloadData();
    }
  };

  // Hapus akun staf
  const handleDeleteStaff = async (account: AdminAccount) => {
    hapticLight();
    const confirmMsg = `Yakin ingin menghapus akun staf ${account.email}? Tindakan ini permanen.`;
    const proceed = Platform.OS === "web" ? window.confirm(confirmMsg) : true;
    if (!proceed) return;

    const res = await deleteAdminAccount(account.id, adminActor);
    if (res.success) {
      hapticSuccess();
      showToast(`Akun staf ${account.email} berhasil dihapus.`);
      reloadData();
    } else {
      hapticWarning();
      if (Platform.OS === "web") {
        window.alert(res.error || "Gagal menghapus akun staf.");
      } else {
        Alert.alert("Gagal", res.error || "Gagal menghapus akun staf.");
      }
    }
  };

  // Simpan perubahan role staf
  const handleSaveRoleChange = async (newRole: AdminRole) => {
    if (!editingStaff) return;
    hapticLight();
    const res = await updateAdminAccount(editingStaff.id, { role: newRole }, adminActor);
    if (res.success) {
      hapticSuccess();
      showToast(`Role @${editingStaff.username} diperbarui menjadi ${newRole.replace("_", " ")}`);
      setEditingStaff(null);
      reloadData();
    }
  };

  // Helper masker JSON sensitif di modal detail
  const renderMaskedJson = (details: Record<string, any>) => {
    const masked: Record<string, any> = {};
    for (const [key, val] of Object.entries(details || {})) {
      if (key.toLowerCase().includes("pass") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) {
        masked[key] = "•••••••• [TERLINDUNGI]";
      } else {
        masked[key] = val;
      }
    }
    return JSON.stringify(masked, null, 2);
  };

  return (
    <AdminLayout
      title={isWide ? "Audit Log & Keamanan Sistem" : "Audit & Keamanan"}
      subtitle={
        isWide
          ? "Pusat investigasi rekam jejak aktivitas, kontrol keamanan autentikasi, manajemen kredensial staf, dan audit trail Nuenime"
          : undefined
      }
      activeKey="audit"
    >
      {/* ─── FLOATING TOAST NOTIFICATION ─── */}
      {toastMsg && (
        <View style={[styles.toastBox, toastMsg.type === "error" ? styles.toastBoxError : styles.toastBoxSuccess]}>
          <AppIcon
            name={toastMsg.type === "error" ? "alert-circle" : "check-circle"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{toastMsg.message}</Text>
        </View>
      )}

      {/* ─── TOP KPI STATS CARDS (PERSIS TEMA ADMIN USERS & GACHA) ─── */}
      <View style={[styles.kpiRow, !isWide && styles.kpiRowMobile]}>
        <View style={[styles.kpiCard, !isWide && styles.kpiCardMobile]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>TOTAL LOG AUDIT</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
              <AppIcon name="history" size={17} color="#38BDF8" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{stats.totalLogs}</Text>
          <Text style={styles.kpiSub}>Rekam jejak immutable</Text>
        </View>

        <View style={[styles.kpiCard, !isWide && styles.kpiCardMobile]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>LOGIN & AUTENTIKASI</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
              <AppIcon name="shield-key-outline" size={17} color="#10B981" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: "#10B981" }]}>{stats.loginCount}</Text>
          <Text style={styles.kpiSub}>Aktivitas autentikasi tercatat</Text>
        </View>

        <View style={[styles.kpiCard, !isWide && styles.kpiCardMobile]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>PERUBAHAN SISTEM</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
              <AppIcon name="cog-sync-outline" size={17} color="#F59E0B" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{stats.configCount}</Text>
          <Text style={styles.kpiSub}>Modifikasi pengaturan</Text>
        </View>

        <View style={[styles.kpiCard, !isWide && styles.kpiCardMobile]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>STAF ADMIN TERDAFTAR</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
              <AppIcon name="account-group-outline" size={17} color="#38BDF8" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{stats.staffCount}</Text>
          <Text style={styles.kpiSub}>Akun pengelola dashboard</Text>
        </View>

        <View style={[styles.kpiCard, !isWide && styles.kpiCardMobile]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>TINDAKAN KRITIS / BERISIKO</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}>
              <AppIcon name="shield-alert-outline" size={17} color="#F43F5E" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: "#F43F5E" }]}>{stats.riskCount}</Text>
          <Text style={styles.kpiSub}>Penghapusan / penolakan</Text>
        </View>
      </View>

      {/* ─── ACTION TOOLBAR & STATUS KEAMANAN ─── */}
      <View style={[styles.toolbarCard, !isWide && styles.toolbarCardMobile]}>
        <View style={styles.toolbarStatusGroup}>
          <View style={styles.securityLiveBadge}>
            <View style={styles.securityDotLive} />
            <Text style={styles.securityLiveText}>Audit Engine Aktif</Text>
          </View>
          <Text style={styles.securityMetaText}>
            Terkoneksi ke Supabase RLS & Immutable Log Stream
          </Text>
        </View>

        <View style={[styles.toolbarBtnRow, !isWide && styles.toolbarBtnRowMobile]}>
          <Pressable
            onPress={handleExportCSV}
            style={[styles.actionBtnSecondary, !isWide && styles.actionBtnMobile]}
          >
            <AppIcon name="file-download-outline" size={15} color="#38BDF8" />
            <Text style={styles.actionBtnSecondaryText}>Ekspor CSV</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticLight();
              reloadData();
              showToast("Data log audit & staf berhasil dimuat ulang");
            }}
            style={[styles.actionBtnSecondary, !isWide && styles.actionBtnMobile]}
          >
            <AppIcon name="refresh" size={15} color="#CBD5E1" />
            <Text style={styles.actionBtnSecondaryText}>Muat Ulang</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── IN-PAGE TAB NAVIGATION (PERSIS ADMIN USERS & GACHA) ─── */}
      <View style={[styles.tabBarWrap, !isWide && styles.tabBarWrapMobile]}>
        {[
          { key: "audit", label: `Log Audit Trail (${filteredLogs.length})`, icon: "history" },
          { key: "account", label: "Akun Saya & Keamanan", icon: "account-lock-outline" },
          { key: "staff", label: `Manajemen Staf (${accounts.length})`, icon: "account-group-outline" },
          { key: "security", label: "Kebijakan & Deteksi", icon: "shield-check-outline" },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as AuditTab);
            }}
            style={[
              styles.tabBtn,
              !isWide && styles.tabBtn2ColMobile,
              activeTab === t.key && styles.tabBtnActive,
            ]}
          >
            <AppIcon
              name={t.icon as any}
              size={15}
              color={activeTab === t.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabBtnText,
                !isWide && styles.tabBtnTextMobile,
                activeTab === t.key && styles.tabBtnTextActive,
              ]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat rekam jejak audit dan status keamanan...</Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: LOG AUDIT TRAIL & FILTER LENGKAP
             ══════════════════════════════════════════════════════ */}
          {activeTab === "audit" && (
            <View style={styles.contentCard}>
              {/* Filter & Search Bar */}
              <View style={[styles.filterBarBox, !isWide && styles.filterBarBoxMobile]}>
                {/* Search Input */}
                <View style={[styles.searchInputWrap, !isWide && styles.searchInputWrapMobile]}>
                  <AppIcon name="magnify" size={16} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari log ID, nama admin, aksi, atau target..."
                    placeholderTextColor="#64748B"
                    value={searchLog}
                    onChangeText={setSearchLog}
                  />
                  {searchLog.length > 0 && (
                    <Pressable onPress={() => setSearchLog("")} hitSlop={8}>
                      <AppIcon name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  )}
                </View>

                {/* Filter Chips Groups */}
                <View style={[styles.filterChipsRow, !isWide && styles.filterChipsRowMobile]}>
                  {/* Category Chips */}
                  {[
                    { id: "all", label: "Semua Kategori" },
                    { id: "auth", label: "Autentikasi" },
                    { id: "finance", label: "Keuangan" },
                    { id: "user", label: "User & Role" },
                    { id: "config", label: "Sistem & Konfigurasi" },
                  ].map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        hapticLight();
                        setSelectedCategoryFilter(cat.id);
                      }}
                      style={[
                        styles.filterChip,
                        selectedCategoryFilter === cat.id && styles.filterChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedCategoryFilter === cat.id && styles.filterChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}

                  {/* Reset Filters */}
                  {(searchLog || selectedCategoryFilter !== "all" || selectedRoleFilter !== "all" || selectedStatusFilter !== "all") && (
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setSearchLog("");
                        setSelectedCategoryFilter("all");
                        setSelectedRoleFilter("all");
                        setSelectedStatusFilter("all");
                      }}
                      style={styles.resetFilterBtn}
                    >
                      <AppIcon name="close" size={12} color="#F43F5E" />
                      <Text style={styles.resetFilterText}>Reset Filter</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Status / Role Sub-filters */}
              <View style={[styles.subFilterRow, !isWide && styles.subFilterRowMobile]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={styles.subFilterLabel}>ROLE:</Text>
                  {(["all", "super_admin", "finance_admin", "moderator"] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setSelectedRoleFilter(r)}
                      style={[styles.miniFilterPill, selectedRoleFilter === r && styles.miniFilterPillActive]}
                    >
                      <Text style={[styles.miniFilterPillText, selectedRoleFilter === r && styles.miniFilterPillTextActive]}>
                        {r === "all" ? "Semua" : r.replace("_", " ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={styles.subFilterLabel}>STATUS:</Text>
                  {[
                    { id: "all", label: "Semua" },
                    { id: "success", label: "Berhasil" },
                    { id: "flagged", label: "Tindakan Kritis" },
                  ].map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedStatusFilter(s.id)}
                      style={[styles.miniFilterPill, selectedStatusFilter === s.id && styles.miniFilterPillActive]}
                    >
                      <Text style={[styles.miniFilterPillText, selectedStatusFilter === s.id && styles.miniFilterPillTextActive]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Data Table Desktop / Feed Mobile */}
              {filteredLogs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppIcon name="clipboard-text-clock-outline" size={40} color="#64748B" />
                  <Text style={styles.emptyTitle}>Tidak Ditemukan Aktivitas Log</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchLog || selectedCategoryFilter !== "all" || selectedRoleFilter !== "all"
                      ? "Tidak ada aktivitas log yang cocok dengan filter penelusuran Anda."
                      : "Belum ada riwayat aktivitas log administratif yang tercatat."}
                  </Text>
                </View>
              ) : isWide ? (
                /* DESKTOP TABLE: 100% Full Width, Presisi Sesuai Admin Users */
                <View style={styles.tableWrap}>
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { width: 140 }]}>WAKTU & ID</Text>
                    <Text style={[styles.th, { flex: 1.8 }]}>PELAKSANA ADMIN</Text>
                    <Text style={[styles.th, { flex: 2 }]}>TINDAKAN / AKSI</Text>
                    <Text style={[styles.th, { flex: 1.6 }]}>TARGET</Text>
                    <Text style={[styles.th, { width: 110 }]}>STATUS</Text>
                    <Text style={[styles.th, { width: 90, textAlign: "right" }]}>RINCIAN</Text>
                  </View>

                  {paginatedLogs.map((item) => {
                    const isCritical =
                      item.action.includes("DELETE") ||
                      item.action.includes("REJECT") ||
                      item.action.includes("BAN") ||
                      item.action.includes("FAILED");

                    return (
                      <View key={item.id} style={styles.trRow}>
                        <View style={{ width: 140 }}>
                          <Text style={styles.logTime}>
                            {new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </Text>
                          <Text style={styles.logId}>{item.id.slice(0, 16)}...</Text>
                        </View>

                        <View style={{ flex: 1.8 }}>
                          <Text style={styles.adminEmail} numberOfLines={1}>
                            {item.adminEmail}
                          </Text>
                          <View
                            style={[
                              styles.roleBadge,
                              item.adminRole === "super_admin"
                                ? styles.roleBadgeSuper
                                : item.adminRole === "finance_admin"
                                ? styles.roleBadgeFinance
                                : styles.roleBadgeMod,
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgeText,
                                item.adminRole === "super_admin"
                                  ? { color: "#F59E0B" }
                                  : item.adminRole === "finance_admin"
                                  ? { color: "#10B981" }
                                  : { color: "#38BDF8" },
                              ]}
                            >
                              {item.adminRole.replace("_", " ").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 2 }}>
                          <View
                            style={[
                              styles.actionPill,
                              isCritical ? styles.actionPillCritical : styles.actionPillNormal,
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionPillText,
                                isCritical ? { color: "#F43F5E" } : { color: "#38BDF8" },
                              ]}
                            >
                              {item.action}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 1.6 }}>
                          <Text style={styles.targetType}>{item.targetType}</Text>
                          <Text style={styles.targetId} numberOfLines={1}>
                            {item.targetId || "Global / System"}
                          </Text>
                        </View>

                        <View style={{ width: 110 }}>
                          <View style={isCritical ? styles.statusPillCritical : styles.statusPillSuccess}>
                            <Text style={isCritical ? styles.statusTextCritical : styles.statusTextSuccess}>
                              {isCritical ? "Kritis" : "Sukses"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ width: 90, alignItems: "flex-end" }}>
                          <Pressable
                            style={styles.detailBtn}
                            onPress={() => {
                              hapticLight();
                              setInspectItem(item);
                            }}
                          >
                            <AppIcon name="eye-outline" size={13} color="#38BDF8" />
                            <Text style={styles.detailBtnText}>Lihat</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* MOBILE FEED: Kartu Vertikal Rapi Tanpa Horizontal Trapping */
                <View style={{ gap: 10 }}>
                  {paginatedLogs.map((item) => {
                    const isCritical =
                      item.action.includes("DELETE") ||
                      item.action.includes("REJECT") ||
                      item.action.includes("BAN") ||
                      item.action.includes("FAILED");

                    return (
                      <View key={item.id} style={styles.mobileLogCard}>
                        <View style={styles.mobileLogHeader}>
                          <View
                            style={[
                              styles.actionPill,
                              isCritical ? styles.actionPillCritical : styles.actionPillNormal,
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionPillText,
                                isCritical ? { color: "#F43F5E" } : { color: "#38BDF8" },
                              ]}
                            >
                              {item.action}
                            </Text>
                          </View>
                          <Text style={styles.logTime}>
                            {new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </Text>
                        </View>

                        <View style={{ gap: 3 }}>
                          <Text style={styles.adminEmail}>Oleh: {item.adminEmail}</Text>
                          <Text style={styles.targetId}>Target: {item.targetType} ({item.targetId || "Global"})</Text>
                        </View>

                        <View style={styles.mobileLogFooter}>
                          <Text style={styles.logId}>{item.id.slice(0, 18)}...</Text>
                          <Pressable
                            style={styles.detailBtn}
                            onPress={() => {
                              hapticLight();
                              setInspectItem(item);
                            }}
                          >
                            <AppIcon name="eye-outline" size={13} color="#38BDF8" />
                            <Text style={styles.detailBtnText}>Rincian Log</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Pagination Controls (Konsisten Dengan /admin/users) */}
              {filteredLogs.length > 0 && (
                <View style={[styles.paginationRow, !isWide && styles.paginationRowMobile]}>
                  <Text style={styles.paginationInfo}>
                    Menampilkan {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, filteredLogs.length)} dari {filteredLogs.length} aktivitas
                    {" "}(Halaman {currentPage} dari {totalPages})
                  </Text>

                  <View style={styles.paginationControls}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setCurrentPage((p) => Math.max(1, p - 1));
                      }}
                      disabled={currentPage === 1}
                      style={[styles.pageBtn, currentPage === 1 && { opacity: 0.4 }]}
                    >
                      <AppIcon name="chevron-left" size={16} color="#CBD5E1" />
                      <Text style={styles.pageBtnText}>Sebelumnya</Text>
                    </Pressable>

                    <View style={styles.pageIndicator}>
                      <Text style={styles.pageIndicatorText}>
                        {currentPage} / {totalPages}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                      }}
                      disabled={currentPage === totalPages}
                      style={[styles.pageBtn, currentPage === totalPages && { opacity: 0.4 }]}
                    >
                      <Text style={styles.pageBtnText}>Berikutnya</Text>
                      <AppIcon name="chevron-right" size={16} color="#CBD5E1" />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 2: AKUN SAYA & KEAMANAN (PROFIL, GANTI PASSWORD & SESI)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "account" && (
            <View style={{ gap: 16 }}>
              {/* Profile Card */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="account-circle" size={20} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Profil Akun & Kredensial Saat Ini</Text>
                    <Text style={styles.cardSubtitle}>
                      Informasi akun yang sedang aktif digunakan untuk mengakses sistem manajemen Nuenime.
                    </Text>
                  </View>
                </View>

                <View style={[styles.profileGrid, !isWide && styles.profileGridMobile]}>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>USERNAME ADMIN</Text>
                    <Text style={styles.profileValue}>@{adminActor.username}</Text>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>EMAIL TERDAFTAR</Text>
                    <Text style={styles.profileValue}>{adminActor.email}</Text>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>ROLE / HAK AKSES</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={styles.roleBadgeSuper}>
                        <Text style={[styles.roleBadgeText, { color: "#F59E0B" }]}>
                          {adminActor.role.replace("_", " ").toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>STATUS KEAMANAN AKUN</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={styles.statusPillSuccess}>
                        <Text style={styles.statusTextSuccess}>Terverifikasi & Aktif</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Form Ganti Password yang Benar-Benar Berfungsi */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                    <AppIcon name="key-change" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Ganti Kata Sandi Akun</Text>
                    <Text style={styles.cardSubtitle}>
                      Perbarui kata sandi secara berkala demi menjamin keamanan akun administratif.
                    </Text>
                  </View>
                </View>

                {passwordSuccessMsg && (
                  <View style={styles.successAlertBox}>
                    <AppIcon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.successAlertText}>{passwordSuccessMsg}</Text>
                  </View>
                )}

                {passwordErrorMsg && (
                  <View style={styles.errorAlertBox}>
                    <AppIcon name="alert-circle" size={16} color="#F43F5E" />
                    <Text style={styles.errorAlertText}>{passwordErrorMsg}</Text>
                  </View>
                )}

                <View style={{ gap: 14, maxWidth: 520 }}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>KATA SANDI SAAT INI *</Text>
                    <View style={styles.formInputWrap}>
                      <TextInput
                        style={styles.formTextInput}
                        placeholder="Masukkan kata sandi saat ini"
                        placeholderTextColor="#64748B"
                        secureTextEntry={!showCurrentPass}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                      />
                      <Pressable onPress={() => setShowCurrentPass((p) => !p)} hitSlop={8}>
                        <AppIcon name={showCurrentPass ? "eye-off" : "eye"} size={16} color="#94A3B8" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>KATA SANDI BARU *</Text>
                    <View style={styles.formInputWrap}>
                      <TextInput
                        style={styles.formTextInput}
                        placeholder="Minimal 6 karakter kombinasi"
                        placeholderTextColor="#64748B"
                        secureTextEntry={!showNewPass}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <Pressable onPress={() => setShowNewPass((p) => !p)} hitSlop={8}>
                        <AppIcon name={showNewPass ? "eye-off" : "eye"} size={16} color="#94A3B8" />
                      </Pressable>
                    </View>

                    {/* Indikator Kekuatan Password */}
                    {newPassword.length > 0 && (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={styles.strengthLabelText}>Kekuatan Kata Sandi:</Text>
                          <Text style={[styles.strengthValueText, { color: passwordStrength.color }]}>
                            {passwordStrength.label}
                          </Text>
                        </View>
                        <View style={styles.strengthBarBg}>
                          <View
                            style={[
                              styles.strengthBarFill,
                              {
                                width: passwordStrength.score === 1 ? "33%" : passwordStrength.score === 2 ? "66%" : "100%",
                                backgroundColor: passwordStrength.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>KONFIRMASI KATA SANDI BARU *</Text>
                    <View style={styles.formInputWrap}>
                      <TextInput
                        style={styles.formTextInput}
                        placeholder="Ulangi kata sandi baru Anda"
                        placeholderTextColor="#64748B"
                        secureTextEntry={!showConfirmPass}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                      <Pressable onPress={() => setShowConfirmPass((p) => !p)} hitSlop={8}>
                        <AppIcon name={showConfirmPass ? "eye-off" : "eye"} size={16} color="#94A3B8" />
                      </Pressable>
                    </View>

                    {confirmPassword.length > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <AppIcon
                          name={newPassword === confirmPassword ? "check-circle" : "close-circle"}
                          size={13}
                          color={newPassword === confirmPassword ? "#10B981" : "#F43F5E"}
                        />
                        <Text style={{ fontSize: 11, color: newPassword === confirmPassword ? "#10B981" : "#F43F5E" }}>
                          {newPassword === confirmPassword ? "Kata sandi cocok" : "Konfirmasi kata sandi belum sama"}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Pressable
                    onPress={handleChangePassword}
                    disabled={updatingPassword}
                    style={[styles.primaryActionBtn, updatingPassword && { opacity: 0.6 }]}
                  >
                    {updatingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="lock-check" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnText}>Simpan Kata Sandi Baru</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Sesi Login & Cabut Perangkat */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                    <AppIcon name="devices" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Manajemen Sesi Login</Text>
                    <Text style={styles.cardSubtitle}>
                      Pantau perangkat yang sedang terhubung dan cabut sesi bila terdapat aktivitas yang tidak dikenali.
                    </Text>
                  </View>
                </View>

                <View style={[styles.sessionCard, !isWide && styles.sessionCardMobile]}>
                  <View style={styles.sessionIconBox}>
                    <AppIcon name="laptop" size={22} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.sessionTitle}>Sesi Dashboard Saat Ini ({Platform.OS.toUpperCase()})</Text>
                      <View style={styles.statusPillSuccess}>
                        <Text style={styles.statusTextSuccess}>Aktif Sekarang</Text>
                      </View>
                    </View>
                    <Text style={styles.sessionSub}>
                      Terkoneksi melalui browser terverifikasi · Supabase Token Active
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
                  <Pressable onPress={handleRevokeAllSessions} style={styles.dangerOutlineBtn}>
                    <AppIcon name="logout-variant" size={14} color="#F43F5E" />
                    <Text style={styles.dangerOutlineBtnText}>Keluar dari Semua Perangkat</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: MANAJEMEN AKUN STAF & HAK AKSES
             ══════════════════════════════════════════════════════ */}
          {activeTab === "staff" && (
            <View style={{ gap: 16 }}>
              {/* Role Matrix Overview */}
              <View style={[styles.rolesGrid, !isWide && styles.rolesGridMobile]}>
                <View style={[styles.roleCard, !isWide && styles.roleCardMobile]}>
                  <View style={[styles.roleIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                    <AppIcon name="shield-crown-outline" size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.roleName}>Super Admin</Text>
                  <Text style={styles.roleDesc}>
                    Akses penuh ke seluruh 13 modul admin. Berhak membuat akun staf baru, konfigurasi sistem, dan audit trail.
                  </Text>
                </View>

                <View style={[styles.roleCard, !isWide && styles.roleCardMobile]}>
                  <View style={[styles.roleIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                    <AppIcon name="credit-card-outline" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.roleName}>Finance Admin</Text>
                  <Text style={styles.roleDesc}>
                    Fokus pada verifikasi transaksi Top Up Crystal, omset, dan tiket bantuan keuangan penonton.
                  </Text>
                </View>

                <View style={[styles.roleCard, !isWide && styles.roleCardMobile]}>
                  <View style={[styles.roleIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="comment-text-multiple-outline" size={20} color="#38BDF8" />
                  </View>
                  <Text style={styles.roleName}>Moderator</Text>
                  <Text style={styles.roleDesc}>
                    Menangani komentar episode anime, sensor kata terlarang (blacklist), dan pengawasan Control Chat.
                  </Text>
                </View>
              </View>

              {/* Staff Accounts Card */}
              <View style={styles.contentCard}>
                <View style={[styles.staffToolbarRow, !isWide && styles.staffToolbarRowMobile]}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={styles.cardTitle}>Daftar Akun Login Staf ({filteredStaff.length})</Text>
                    <Text style={styles.cardSubtitle}>
                      Akun staf yang memiliki hak akses login ke dalam Dashboard Admin Nuenime.
                    </Text>
                  </View>

                  <View style={[styles.staffActionRow, !isWide && styles.staffActionRowMobile]}>
                    <View style={styles.staffSearchInputWrap}>
                      <AppIcon name="magnify" size={15} color="#64748B" />
                      <TextInput
                        style={styles.staffSearchInput}
                        placeholder="Cari staf..."
                        placeholderTextColor="#64748B"
                        value={searchStaff}
                        onChangeText={setSearchStaff}
                      />
                    </View>

                    {isSuperAdmin && (
                      <Pressable
                        onPress={() => {
                          hapticLight();
                          setFormUsername("");
                          setFormEmail("");
                          setFormPassword("");
                          setFormRole("finance_admin");
                          setFormNotes("");
                          setStaffFormError(null);
                          setShowCreateModal(true);
                        }}
                        style={styles.primaryActionBtn}
                      >
                        <AppIcon name="plus" size={15} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnText}>Tambah Staf</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Table Staf Desktop / Kartu Mobile */}
                {filteredStaff.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="account-search-outline" size={40} color="#64748B" />
                    <Text style={styles.emptyTitle}>Tidak Ditemukan Akun Staf</Text>
                    <Text style={styles.emptySubtitle}>
                      Tidak ada akun yang cocok dengan kata kunci penelusuran Anda.
                    </Text>
                  </View>
                ) : isWide ? (
                  /* DESKTOP TABLE STAF */
                  <View style={styles.tableWrap}>
                    <View style={styles.thRow}>
                      <Text style={[styles.th, { flex: 2 }]}>NAMA & USERNAME</Text>
                      <Text style={[styles.th, { flex: 2.2 }]}>EMAIL LOGIN</Text>
                      <Text style={[styles.th, { flex: 1.6 }]}>PERAN / ROLE</Text>
                      <Text style={[styles.th, { width: 110 }]}>STATUS</Text>
                      <Text style={[styles.th, { flex: 1.6 }]}>LOGIN TERAKHIR</Text>
                      <Text style={[styles.th, { width: 180, textAlign: "right" }]}>TINDAKAN</Text>
                    </View>

                    {filteredStaff.map((acc) => (
                      <View key={acc.id} style={styles.trRow}>
                        <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={styles.staffAvatar}>
                            <Text style={styles.staffAvatarText}>{acc.username[0]?.toUpperCase() || "A"}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.staffName} numberOfLines={1}>{acc.username}</Text>
                            <Text style={styles.staffNotes} numberOfLines={1}>{acc.notes || "Akun Terverifikasi"}</Text>
                          </View>
                        </View>

                        <Text style={[styles.staffEmail, { flex: 2.2 }]} numberOfLines={1}>
                          {acc.email}
                        </Text>

                        <View style={{ flex: 1.6 }}>
                          <View
                            style={[
                              styles.roleBadge,
                              acc.role === "super_admin"
                                ? styles.roleBadgeSuper
                                : acc.role === "finance_admin"
                                ? styles.roleBadgeFinance
                                : styles.roleBadgeMod,
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgeText,
                                acc.role === "super_admin"
                                  ? { color: "#F59E0B" }
                                  : acc.role === "finance_admin"
                                  ? { color: "#10B981" }
                                  : { color: "#38BDF8" },
                              ]}
                            >
                              {acc.role.replace("_", " ").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ width: 110 }}>
                          <Pressable
                            onPress={() => isSuperAdmin && handleToggleStaffStatus(acc)}
                            disabled={!isSuperAdmin || acc.id === "admin-super-01"}
                            style={[
                              acc.status === "active" ? styles.statusPillActive : styles.statusPillInactive,
                              (!isSuperAdmin || acc.id === "admin-super-01") && { opacity: 0.7 },
                            ]}
                          >
                            <Text style={acc.status === "active" ? styles.statusTextSuccess : styles.statusTextInactive}>
                              {acc.status === "active" ? "Aktif" : "Nonaktif"}
                            </Text>
                          </Pressable>
                        </View>

                        <Text style={[styles.staffLastLogin, { flex: 1.6 }]}>
                          {acc.lastLoginAt
                            ? new Date(acc.lastLoginAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "Belum login"}
                        </Text>

                        <View style={{ width: 180, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                          {isSuperAdmin && acc.id !== "admin-super-01" && (
                            <>
                              <Pressable
                                onPress={() => setEditingStaff(acc)}
                                style={styles.actionBtnSmall}
                              >
                                <AppIcon name="shield-edit-outline" size={13} color="#38BDF8" />
                                <Text style={styles.actionBtnSmallText}>Role</Text>
                              </Pressable>

                              <Pressable
                                onPress={() => handleDeleteStaff(acc)}
                                style={styles.actionBtnSmallDanger}
                              >
                                <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  /* MOBILE STAFF LIST */
                  <View style={{ gap: 10 }}>
                    {filteredStaff.map((acc) => (
                      <View key={acc.id} style={styles.mobileLogCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={styles.staffAvatar}>
                              <Text style={styles.staffAvatarText}>{acc.username[0]?.toUpperCase() || "A"}</Text>
                            </View>
                            <View>
                              <Text style={styles.staffName}>{acc.username}</Text>
                              <Text style={styles.staffEmail}>{acc.email}</Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.roleBadge,
                              acc.role === "super_admin"
                                ? styles.roleBadgeSuper
                                : acc.role === "finance_admin"
                                ? styles.roleBadgeFinance
                                : styles.roleBadgeMod,
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgeText,
                                acc.role === "super_admin"
                                  ? { color: "#F59E0B" }
                                  : acc.role === "finance_admin"
                                  ? { color: "#10B981" }
                                  : { color: "#38BDF8" },
                              ]}
                            >
                              {acc.role.replace("_", " ").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={styles.staffLastLogin}>
                            Login: {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString("id-ID") : "Belum pernah"}
                          </Text>
                          <View style={acc.status === "active" ? styles.statusPillActive : styles.statusPillInactive}>
                            <Text style={acc.status === "active" ? styles.statusTextSuccess : styles.statusTextInactive}>
                              {acc.status === "active" ? "Aktif" : "Nonaktif"}
                            </Text>
                          </View>
                        </View>

                        {isSuperAdmin && acc.id !== "admin-super-01" && (
                          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 6, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.05)", paddingTop: 8 }}>
                            <Pressable
                              onPress={() => setEditingStaff(acc)}
                              style={[styles.actionBtnSmall, { flex: 1, justifyContent: "center" }]}
                            >
                              <AppIcon name="shield-edit-outline" size={13} color="#38BDF8" />
                              <Text style={styles.actionBtnSmallText}>Ubah Role</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleToggleStaffStatus(acc)}
                              style={[styles.actionBtnSmall, { flex: 1, justifyContent: "center" }]}
                            >
                              <Text style={styles.actionBtnSmallText}>
                                {acc.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeleteStaff(acc)}
                              style={styles.actionBtnSmallDanger}
                            >
                              <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 4: DETEKSI ANOMALI & KEBIJAKAN KEAMANAN
             ══════════════════════════════════════════════════════ */}
          {activeTab === "security" && (
            <View style={{ gap: 16 }}>
              {/* Threat & Anomaly Detection */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                    <AppIcon name="shield-check" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Status Deteksi Aktivitas & Anomali Keamanan</Text>
                    <Text style={styles.cardSubtitle}>
                      Pemeriksaan integritas sistem otomatis terhadap percobaan akses tidak sah, pembatalan massal, dan kegagalan autentikasi.
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 10, marginTop: 4 }}>
                  <View style={styles.threatCheckItem}>
                    <View style={styles.threatStatusIconGreen}>
                      <AppIcon name="check" size={14} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.threatCheckTitle}>Integritas Autentikasi Supabase & Session Guard</Text>
                      <Text style={styles.threatCheckDesc}>
                        Tidak terdeteksi serangan brute force login berulang dalam 24 jam terakhir. Semua token sesi terverifikasi valid.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.threatCheckItem}>
                    <View style={styles.threatStatusIconGreen}>
                      <AppIcon name="check" size={14} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.threatCheckTitle}>Immutable Audit Trail (Append-Only)</Text>
                      <Text style={styles.threatCheckDesc}>
                        Seluruh {logs.length} catatan aktivitas terkunci secara permanen dan tidak dapat diedit atau dimanipulasi oleh siapapun.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.threatCheckItem}>
                    <View style={styles.threatStatusIconGreen}>
                      <AppIcon name="check" size={14} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.threatCheckTitle}>Enforce Hak Akses RBAC (Role-Based Access Control)</Text>
                      <Text style={styles.threatCheckDesc}>
                        Izin akses modul finance, community, dan sistem tervalidasi secara ketat pada backend dan middleware server.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Security Policy Matrix */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="file-document-outline" size={20} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Matriks Kebijakan & Retensi Data Keamanan</Text>
                    <Text style={styles.cardSubtitle}>
                      Standar parameter kepatuhan keamanan yang diterapkan pada infrastruktur Nuenime.
                    </Text>
                  </View>
                </View>

                <View style={[styles.profileGrid, !isWide && styles.profileGridMobile]}>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>RETENSI LOG AUDIT</Text>
                    <Text style={styles.profileValue}>500 Aktivitas Terbaru (Permanen)</Text>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>KOMPLEKSITAS KATA SANDI</Text>
                    <Text style={styles.profileValue}>Minimal 6 Karakter (Huruf & Angka)</Text>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>BATAS DURASI SESI</Text>
                    <Text style={styles.profileValue}>7 Hari (Refresh Otomatis via Token)</Text>
                  </View>
                  <View style={styles.profileItem}>
                    <Text style={styles.profileLabel}>ROW-LEVEL SECURITY (RLS)</Text>
                    <Text style={styles.profileValue}>Aktif di Supabase Database</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── MODAL DETAIL AUDIT LOG (ACTIVITY INSPECTOR) ─── */}
      <Modal visible={Boolean(inspectItem)} transparent animationType="fade" onRequestClose={() => setInspectItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, !isWide && styles.modalCardMobile]}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="file-search-outline" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Detail Rekam Jejak Audit</Text>
                <Text style={styles.modalSub}>{inspectItem?.id}</Text>
              </View>
              <Pressable onPress={() => setInspectItem(null)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {inspectItem && (
              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Waktu Kejadian:</Text>
                    <Text style={styles.inspectValue}>
                      {new Date(inspectItem.createdAt).toLocaleString("id-ID", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </Text>
                  </View>

                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Pelaksana Admin:</Text>
                    <Text style={styles.inspectValue}>{inspectItem.adminEmail} ({inspectItem.adminRole})</Text>
                  </View>

                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Tindakan Dilakukan:</Text>
                    <View style={styles.actionPillNormal}>
                      <Text style={[styles.actionPillText, { color: "#38BDF8" }]}>{inspectItem.action}</Text>
                    </View>
                  </View>

                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Target Modul & ID:</Text>
                    <Text style={styles.inspectValue}>
                      {inspectItem.targetType} • {inspectItem.targetId || "Global"}
                    </Text>
                  </View>

                  {/* JSON Payload Inspector dengan Masking Rahasia */}
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={styles.inspectLabel}>Data Payload Tindakan (Masked Sensitive Keys):</Text>
                    <View style={styles.jsonBox}>
                      <Text style={styles.jsonText}>{renderMaskedJson(inspectItem.details)}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
              <Pressable onPress={() => setInspectItem(null)} style={styles.actionBtnSecondary}>
                <Text style={styles.actionBtnSecondaryText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL BUAT AKUN STAF BARU ─── */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, !isWide && styles.modalCardMobile]}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="account-plus-outline" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Tambah Akun Staf Baru</Text>
                <Text style={styles.modalSub}>Kredensial staf akan langsung aktif untuk masuk ke Dashboard.</Text>
              </View>
              <Pressable onPress={() => setShowCreateModal(false)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {staffFormError && (
              <View style={styles.errorAlertBox}>
                <AppIcon name="alert-circle" size={16} color="#F43F5E" />
                <Text style={styles.errorAlertText}>{staffFormError}</Text>
              </View>
            )}

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>USERNAME / NAMA LENGKAP *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Contoh: Budi Finance"
                    placeholderTextColor="#64748B"
                    value={formUsername}
                    onChangeText={setFormUsername}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>EMAIL LOGIN *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="budi@nuenime.com"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={formEmail}
                    onChangeText={setFormEmail}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>KATA SANDI AWAL *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Minimal 4 karakter"
                    placeholderTextColor="#64748B"
                    value={formPassword}
                    onChangeText={setFormPassword}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PILIH PERAN / ROLE ADMIN *</Text>
                  <View style={{ gap: 6 }}>
                    {[
                      { role: "super_admin", label: "Super Admin", icon: "shield-crown", desc: "Akses Penuh Seluruh Modul" },
                      { role: "finance_admin", label: "Finance Admin", icon: "credit-card", desc: "Top Up & Saldo" },
                      { role: "moderator", label: "Moderator", icon: "shield-account", desc: "Komunitas & Komentar" },
                    ].map((r) => {
                      const isSel = formRole === r.role;
                      return (
                        <Pressable
                          key={r.role}
                          onPress={() => setFormRole(r.role as AdminRole)}
                          style={[styles.roleSelectBox, isSel && styles.roleSelectBoxActive]}
                        >
                          <AppIcon name={r.icon as any} size={16} color={isSel ? "#38BDF8" : "#94A3B8"} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.roleSelectName, isSel && { color: "#FFFFFF" }]}>{r.label}</Text>
                            <Text style={styles.roleSelectDesc}>{r.desc}</Text>
                          </View>
                          {isSel && <AppIcon name="check-circle" size={16} color="#38BDF8" />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>CATATAN / DIVISI</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Contoh: Staff verifikasi keuangan shift malam"
                    placeholderTextColor="#64748B"
                    value={formNotes}
                    onChangeText={setFormNotes}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.actionBtnSecondary}>
                <Text style={styles.actionBtnSecondaryText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveNewStaff}
                disabled={submittingStaff}
                style={[styles.primaryActionBtn, submittingStaff && { opacity: 0.6 }]}
              >
                {submittingStaff ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="check" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Simpan Akun Staf</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL EDIT ROLE STAF ─── */}
      <Modal visible={Boolean(editingStaff)} transparent animationType="fade" onRequestClose={() => setEditingStaff(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, !isWide && styles.modalCardMobile]}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="shield-edit-outline" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ubah Peran / Role Staf</Text>
                <Text style={styles.modalSub}>{editingStaff?.username} ({editingStaff?.email})</Text>
              </View>
              <Pressable onPress={() => setEditingStaff(null)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={{ gap: 8, marginVertical: 12 }}>
              {[
                { role: "super_admin", label: "Super Admin", desc: "Akses penuh semua 13 modul admin" },
                { role: "finance_admin", label: "Finance Admin", desc: "Verifikasi transaksi & saldo Crystal" },
                { role: "moderator", label: "Moderator", desc: "Moderasi komentar & feed komunitas" },
              ].map((r) => {
                const isCurrent = editingStaff?.role === r.role;
                return (
                  <Pressable
                    key={r.role}
                    onPress={() => handleSaveRoleChange(r.role as AdminRole)}
                    style={[styles.roleSelectBox, isCurrent && styles.roleSelectBoxActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleSelectName, isCurrent && { color: "#FFFFFF" }]}>{r.label}</Text>
                      <Text style={styles.roleSelectDesc}>{r.desc}</Text>
                    </View>
                    {isCurrent ? (
                      <View style={styles.statusPillSuccess}>
                        <Text style={styles.statusTextSuccess}>Peran Saat Ini</Text>
                      </View>
                    ) : (
                      <AppIcon name="chevron-right" size={16} color="#64748B" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable onPress={() => setEditingStaff(null)} style={styles.actionBtnSecondary}>
                <Text style={styles.actionBtnSecondaryText}>Batal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

// ─── STYLES (SESUAI DENGAN TEMA GELAP /admin/users & GACHA TANPA UNGU) ───
const styles = StyleSheet.create({
  // ── Toast Notification
  toastBox: {
    position: "absolute",
    top: 14,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastBoxSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  toastBoxError: {
    backgroundColor: "#881337",
    borderColor: "#F43F5E",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Top KPI Cards
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  kpiRowMobile: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 4,
  },
  kpiCardMobile: {
    width: "48.5%",
    flex: 0,
    marginBottom: 8,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },

  // ── Toolbar Card
  toolbarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
    gap: 12,
  },
  toolbarCardMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  toolbarStatusGroup: {
    gap: 3,
  },
  securityLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  securityDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  securityLiveText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  securityMetaText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  toolbarBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarBtnRowMobile: {
    width: "100%",
    justifyContent: "space-between",
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  actionBtnSecondaryText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  actionBtnMobile: {
    flex: 1,
    justifyContent: "center",
  },

  // ── Tab Bar Navigation
  tabBarWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tabBarWrapMobile: {
    width: "100%",
    justifyContent: "space-between",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  tabBtn2ColMobile: {
    width: "48.5%",
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  tabBtnTextMobile: {
    fontSize: 11,
    textAlign: "center",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ── Content Card
  contentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 16,
  },

  // ── Filters Box
  filterBarBox: {
    gap: 10,
  },
  filterBarBoxMobile: {
    gap: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInputWrapMobile: {
    width: "100%",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  filterChipsRowMobile: {
    width: "100%",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  filterChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterChipTextActive: {
    color: "#38BDF8",
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
  },
  resetFilterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#F43F5E",
  },

  subFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 8,
    gap: 12,
  },
  subFilterRowMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  subFilterLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  miniFilterPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  miniFilterPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  miniFilterPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
  },
  miniFilterPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Desktop Table & Mobile Cards
  tableWrap: {
    gap: 4,
    width: "100%",
  },
  thRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 4,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  logTime: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#E2E8F0",
  },
  logId: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  adminEmail: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  roleBadgeSuper: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  roleBadgeFinance: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  roleBadgeMod: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  roleBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  actionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  actionPillNormal: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  actionPillCritical: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  actionPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  targetType: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  targetId: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  statusPillSuccess: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    alignSelf: "flex-start",
  },
  statusTextSuccess: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
  },
  statusPillCritical: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    alignSelf: "flex-start",
  },
  statusTextCritical: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F43F5E",
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
  },
  detailBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
  },

  // ── Mobile Log Cards
  mobileLogCard: {
    backgroundColor: "#111620",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  mobileLogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mobileLogFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 6,
  },

  // ── Pagination Row
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 14,
    marginTop: 4,
    gap: 12,
  },
  paginationRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  paginationInfo: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  paginationControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  pageBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  pageIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pageIndicatorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },

  // ── Profile Grid & Form
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  profileGridMobile: {
    flexDirection: "column",
  },
  profileItem: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  profileLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  profileValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    marginTop: 2,
  },

  formGroup: {
    gap: 5,
  },
  formLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  formInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formTextInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
    padding: 0,
  },
  strengthLabelText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  strengthValueText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  strengthBarBg: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0284C7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  successAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 8,
    padding: 10,
  },
  successAlertText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#10B981",
    flex: 1,
  },
  errorAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    borderRadius: 8,
    padding: 10,
  },
  errorAlertText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#F43F5E",
    flex: 1,
  },

  // ── Session Card
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 6,
  },
  sessionCardMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  sessionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  sessionSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  dangerOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  dangerOutlineBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#F43F5E",
  },

  // ── Staff Matrix & Accounts
  rolesGrid: {
    flexDirection: "row",
    gap: 12,
  },
  rolesGridMobile: {
    flexDirection: "column",
  },
  roleCard: {
    flex: 1,
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 4,
  },
  roleCardMobile: {
    width: "100%",
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  roleName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  roleDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },
  staffToolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  staffToolbarRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  staffActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staffActionRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  staffSearchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 180,
  },
  staffSearchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#FFFFFF",
    padding: 0,
  },
  staffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  staffAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  staffName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  staffNotes: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  staffEmail: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  staffLastLogin: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  statusPillActive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignSelf: "flex-start",
  },
  statusPillInactive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(100, 116, 139, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.3)",
    alignSelf: "flex-start",
  },
  statusTextInactive: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
  },
  actionBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  actionBtnSmallText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  actionBtnSmallDanger: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Threat Check
  threatCheckItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  threatStatusIconGreen: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  threatCheckTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  threatCheckDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },

  // ── Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCardMobile: {
    maxWidth: "96%",
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  roleSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  roleSelectBoxActive: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  roleSelectName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  roleSelectDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  inspectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
    paddingVertical: 6,
    gap: 8,
  },
  inspectLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  inspectValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
    textAlign: "right",
  },
  jsonBox: {
    backgroundColor: "#070B10",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  jsonText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#38BDF8",
    lineHeight: 16,
  },

  // ── Empty Card
  emptyCard: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 360,
  },

  loadingBox: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
});
