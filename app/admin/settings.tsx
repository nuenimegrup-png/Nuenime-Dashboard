import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminLayout } from "@/components/admin/admin-layout";
import { supabase } from "@/lib/supabase";
import { AppIcon } from "@/components/app-icon";
import { readNsfwPreference, writeAdminNsfwPreference } from "@/lib/nsfw-preference";
import {
  getAdminMaintenanceConfig,
  saveAdminMaintenanceConfig,
  type MaintenanceModeConfig,
  logAdminAction,
  getAdminAuditLogs,
  type AuditLogItem,
  type AdminUser,
  canManageSystem,
  canManageFinance,
  canManageUsers,
  canModerate,
} from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

type SettingsCategory =
  | "general"
  | "connectivity"
  | "security"
  | "notifications"
  | "maintenance"
  | "audit";

interface GeneralSettingsConfig {
  appName: string;
  adminTitle: string;
  appDescription: string;
  appUrl: string;
  timezone: string;
  dateFormat: string;
  language: string;
  sessionTimeoutMinutes: number;
  requireHighRiskConfirmation: boolean;
  notifyOnNewTransaction: boolean;
  notifyOnNewUser: boolean;
  notifyOnSystemError: boolean;
  showVersionInfo: boolean;
  appVersion: string;
}

const STORAGE_GENERAL_SETTINGS = "nuenime.admin.general_settings";

const DEFAULT_SETTINGS: GeneralSettingsConfig = {
  appName: "Nuenime - Streaming Anime Indonesia",
  adminTitle: "Nuenime Admin Console",
  appDescription: "Platform streaming anime sub Indo resmi dengan katalog ribuan episode, avatar border, dan gacha wallpaper profil.",
  appUrl: "https://nuenime.com",
  timezone: "Asia/Jakarta (WIB)",
  dateFormat: "DD/MM/YYYY HH:mm",
  language: "Bahasa Indonesia",
  sessionTimeoutMinutes: 60,
  requireHighRiskConfirmation: true,
  notifyOnNewTransaction: true,
  notifyOnNewUser: false,
  notifyOnSystemError: true,
  showVersionInfo: true,
  appVersion: "1.0.4-prod",
};

export default function AdminSettingsScreen() {
  const auth = useAnirakuAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  // Active Category Tab
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [initialLoading, setInitialLoading] = useState(true);

  // Settings State
  const [settings, setSettings] = useState<GeneralSettingsConfig>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<GeneralSettingsConfig>(DEFAULT_SETTINGS);

  // NSFW Global 18+ Filter State
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [savedNsfwEnabled, setSavedNsfwEnabled] = useState(false);
  const [savingNsfw, setSavingNsfw] = useState(false);

  // Connectivity & Latency State
  const [supabaseStatus, setSupabaseStatus] = useState<"checking" | "connected" | "fallback">("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [checkingPing, setCheckingPing] = useState(false);

  // Maintenance Config State
  const [maintenance, setMaintenance] = useState<MaintenanceModeConfig>({
    isActive: false,
    message: "Server sedang dalam pemeliharaan berkala untuk peningkatan performa.",
    iconUrl: "https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png",
    primaryButtonText: "Cek Status Server",
    secondaryButtonText: "Discord Support",
    secondaryButtonUrl: "",
  });
  const [savedMaintenance, setSavedMaintenance] = useState<MaintenanceModeConfig>(maintenance);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [searchAudit, setSearchAudit] = useState("");

  // Process / Action States
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Confirmation Modals State
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Current Admin Actor
  const adminActor: AdminUser = useMemo(() => {
    return {
      id: auth.user?.id || "admin-master",
      email: auth.user?.email || "admin@nuenime.com",
      username: auth.profile?.display_name || auth.profile?.username || "Super Admin",
      role: "super_admin",
    };
  }, [auth.user, auth.profile]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Ping & check connection to Supabase
  const checkConnection = useCallback(async () => {
    setCheckingPing(true);
    setSupabaseStatus("checking");
    const t0 = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const diff = Date.now() - t0;
      setLatencyMs(diff);
      if (error) {
        setSupabaseStatus("fallback");
      } else {
        setSupabaseStatus("connected");
      }
    } catch {
      setSupabaseStatus("fallback");
      setLatencyMs(null);
    } finally {
      setCheckingPing(false);
    }
  }, []);

  // Load All Configuration on Mount
  const loadAllSettings = useCallback(async () => {
    setInitialLoading(true);
    try {
      // 1. General settings
      const rawGen = await AsyncStorage.getItem(STORAGE_GENERAL_SETTINGS);
      if (rawGen) {
        try {
          const parsed = JSON.parse(rawGen);
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          setSettings(merged);
          setSavedSettings(merged);
        } catch {}
      }

      // 2. NSFW preference
      const nsfw = await readNsfwPreference();
      setNsfwEnabled(nsfw);
      setSavedNsfwEnabled(nsfw);

      // 3. Maintenance mode
      const maint = await getAdminMaintenanceConfig();
      setMaintenance(maint);
      setSavedMaintenance(maint);

      // 4. Ping Supabase
      await checkConnection();

      // 5. Audit logs
      const logs = await getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn("[settings.tsx] load error:", err);
    } finally {
      setInitialLoading(false);
    }
  }, [checkConnection]);

  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  // Compute Unsaved Changes Count
  const unsavedCount = useMemo(() => {
    let count = 0;
    if (settings.appName !== savedSettings.appName) count++;
    if (settings.adminTitle !== savedSettings.adminTitle) count++;
    if (settings.appDescription !== savedSettings.appDescription) count++;
    if (settings.appUrl !== savedSettings.appUrl) count++;
    if (settings.timezone !== savedSettings.timezone) count++;
    if (settings.dateFormat !== savedSettings.dateFormat) count++;
    if (settings.language !== savedSettings.language) count++;
    if (settings.sessionTimeoutMinutes !== savedSettings.sessionTimeoutMinutes) count++;
    if (settings.requireHighRiskConfirmation !== savedSettings.requireHighRiskConfirmation) count++;
    if (settings.notifyOnNewTransaction !== savedSettings.notifyOnNewTransaction) count++;
    if (settings.notifyOnNewUser !== savedSettings.notifyOnNewUser) count++;
    if (settings.notifyOnSystemError !== savedSettings.notifyOnSystemError) count++;
    if (settings.showVersionInfo !== savedSettings.showVersionInfo) count++;
    if (settings.appVersion !== savedSettings.appVersion) count++;
    if (nsfwEnabled !== savedNsfwEnabled) count++;
    if (maintenance.isActive !== savedMaintenance.isActive) count++;
    if (maintenance.message !== savedMaintenance.message) count++;
    if (maintenance.secondaryButtonText !== savedMaintenance.secondaryButtonText) count++;
    if (maintenance.secondaryButtonUrl !== savedMaintenance.secondaryButtonUrl) count++;
    return count;
  }, [settings, savedSettings, nsfwEnabled, savedNsfwEnabled, maintenance, savedMaintenance]);

  const hasUnsavedChanges = unsavedCount > 0;

  // Toggle NSFW with instant save & synchronization
  const handleToggleNsfw = async (val: boolean) => {
    hapticLight();
    setNsfwEnabled(val);
    setSavingNsfw(true);
    const res = await writeAdminNsfwPreference(val);
    setSavingNsfw(false);
    if (res.success) {
      setSavedNsfwEnabled(val);
      hapticSuccess();
      showToast(
        val
          ? "Filter 18+ diaktifkan! Pengguna kini dapat melihat anime kategori dewasa."
          : "Filter 18+ dinonaktifkan! Seluruh anime dewasa disembunyikan (Aman).",
        "success"
      );
      await logAdminAction({
        admin: adminActor,
        action: "UPDATE_NSFW_PREFERENCE",
        targetType: "system_settings",
        targetId: "nsfw_filter",
        details: { nsfwEnabled: val },
      });
      getAdminAuditLogs().then(setAuditLogs);
    } else {
      hapticWarning();
      setNsfwEnabled(!val);
      showToast(res.error || "Gagal mengubah konfigurasi konten 18+.", "error");
    }
  };

  // Save All Unsaved Configuration
  const handleSaveAll = async () => {
    if (!hasUnsavedChanges) {
      showToast("Seluruh pengaturan sudah dalam kondisi tersimpan.", "success");
      return;
    }

    setIsSaving(true);
    hapticLight();

    try {
      // 1. Save general settings
      await AsyncStorage.setItem(STORAGE_GENERAL_SETTINGS, JSON.stringify(settings));

      // 2. Save NSFW preference if changed
      if (nsfwEnabled !== savedNsfwEnabled) {
        await writeAdminNsfwPreference(nsfwEnabled);
        setSavedNsfwEnabled(nsfwEnabled);
      }

      // 3. Save Maintenance mode if changed
      if (
        maintenance.isActive !== savedMaintenance.isActive ||
        maintenance.message !== savedMaintenance.message ||
        maintenance.secondaryButtonText !== savedMaintenance.secondaryButtonText ||
        maintenance.secondaryButtonUrl !== savedMaintenance.secondaryButtonUrl
      ) {
        await saveAdminMaintenanceConfig(maintenance, adminActor);
        setSavedMaintenance(maintenance);
      }

      // 4. Log admin action
      await logAdminAction({
        admin: adminActor,
        action: "SAVE_SYSTEM_SETTINGS",
        targetType: "system_settings",
        targetId: "global_config",
        details: {
          modifiedFieldsCount: unsavedCount,
          appName: settings.appName,
          maintenanceActive: maintenance.isActive,
          nsfwEnabled,
          sessionTimeout: settings.sessionTimeoutMinutes,
        },
      });

      setSavedSettings(settings);
      hapticSuccess();
      showToast("Seluruh perubahan pengaturan sistem berhasil disimpan ke database!", "success");

      // Refresh audit logs
      const logs = await getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan pengaturan.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Revert Unsaved Changes
  const handleRevertChanges = () => {
    if (!hasUnsavedChanges) return;
    Alert.alert(
      "Batalkan Perubahan?",
      "Seluruh formulir pengaturan yang belum disimpan akan dikembalikan ke nilai sebelumnya.",
      [
        { text: "Lanjutkan Mengedit", style: "cancel" },
        {
          text: "Ya, Batalkan",
          style: "destructive",
          onPress: () => {
            hapticLight();
            setSettings(savedSettings);
            setNsfwEnabled(savedNsfwEnabled);
            setMaintenance(savedMaintenance);
            showToast("Perubahan yang belum disimpan telah dibatalkan.", "success");
          },
        },
      ]
    );
  };

  // Purge Admin Local Cache
  const handleConfirmClearCache = async () => {
    setClearingCache(true);
    hapticLight();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const adminKeys = keys.filter(
        (k) =>
          k.startsWith("nuenime.admin.") &&
          k !== STORAGE_GENERAL_SETTINGS &&
          k !== "nuenime.admin.session"
      );
      for (const k of adminKeys) {
        await AsyncStorage.removeItem(k);
      }

      await logAdminAction({
        admin: adminActor,
        action: "CLEAR_LOCAL_CACHE",
        targetType: "cache",
        targetId: "admin_storage",
        details: { clearedKeysCount: adminKeys.length },
      });

      setShowClearCacheModal(false);
      hapticSuccess();
      showToast(`Cache lokal admin berhasil dibersihkan (${adminKeys.length} entri)!`, "success");
      loadAllSettings();
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal membersihkan cache.", "error");
    } finally {
      setClearingCache(false);
    }
  };

  // Export Backup Configuration (JSON)
  const handleExportBackup = async () => {
    hapticLight();
    const backupData = {
      exportedAt: new Date().toISOString(),
      exportedBy: adminActor.email,
      settings,
      nsfwEnabled,
      maintenance,
      supabaseStatus,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);

    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(jsonStr);
        showToast("Salinan JSON konfigurasi berhasil disalin ke clipboard!", "success");
      } catch {
        Alert.alert("Data Backup JSON", jsonStr);
      }
    } else {
      Alert.alert("Data Backup JSON", jsonStr);
    }
  };

  // Restore Configuration from JSON
  const handleApplyRestore = async () => {
    if (!restoreJsonInput.trim()) {
      showToast("Silakan tempel kode JSON backup yang valid.", "error");
      return;
    }

    setRestoring(true);
    hapticLight();
    try {
      const parsed = JSON.parse(restoreJsonInput.trim());
      if (!parsed || typeof parsed !== "object") throw new Error("Format JSON tidak valid.");

      if (parsed.settings && typeof parsed.settings === "object") {
        const merged = { ...DEFAULT_SETTINGS, ...parsed.settings };
        setSettings(merged);
        await AsyncStorage.setItem(STORAGE_GENERAL_SETTINGS, JSON.stringify(merged));
        setSavedSettings(merged);
      }
      if (typeof parsed.nsfwEnabled === "boolean") {
        setNsfwEnabled(parsed.nsfwEnabled);
        await writeAdminNsfwPreference(parsed.nsfwEnabled);
        setSavedNsfwEnabled(parsed.nsfwEnabled);
      }
      if (parsed.maintenance && typeof parsed.maintenance === "object") {
        setMaintenance(parsed.maintenance);
        await saveAdminMaintenanceConfig(parsed.maintenance, adminActor);
        setSavedMaintenance(parsed.maintenance);
      }

      await logAdminAction({
        admin: adminActor,
        action: "RESTORE_CONFIG_BACKUP",
        targetType: "system_settings",
        targetId: "backup_restore",
        details: { restoredFromTimestamp: parsed.exportedAt || "unknown" },
      });

      setShowRestoreModal(false);
      setRestoreJsonInput("");
      hapticSuccess();
      showToast("Konfigurasi sistem berhasil dipulihkan dari backup!", "success");
      loadAllSettings();
    } catch (err: any) {
      hapticWarning();
      showToast("Gagal memulihkan: " + (err?.message || "Format JSON tidak valid."), "error");
    } finally {
      setRestoring(false);
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (!searchAudit.trim()) return auditLogs;
    const q = searchAudit.toLowerCase();
    return auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.adminEmail.toLowerCase().includes(q) ||
        l.targetType.toLowerCase().includes(q)
    );
  }, [auditLogs, searchAudit]);

  return (
    <AdminLayout
      title="Pengaturan Sistem"
      subtitle="Kelola konfigurasi platform, filter konten, koneksi infrastruktur, keamanan, dan preferensi aplikasi Nuenime"
      mobileTitle="Pengaturan"
      mobileSubtitle="Konfigurasi sistem"
      activeKey="settings"
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── 1. TOP HEADER ACTIONS BAR (SESUAI ADMIN USERS / FINANCE) ─── */}
        <View style={[styles.topActionBar, !isWide && styles.topActionBarMobile]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.pageHeaderTitle}>Pengaturan Sistem & Infrastruktur</Text>
              {hasUnsavedChanges ? (
                <View style={styles.unsavedBadge}>
                  <Text style={styles.unsavedBadgeText}>{unsavedCount} Belum Disimpan</Text>
                </View>
              ) : (
                <View style={styles.savedBadge}>
                  <AppIcon name="check-circle" size={11} color="#10B981" />
                  <Text style={styles.savedBadgeText}>Tersinkron</Text>
                </View>
              )}
            </View>
            <Text style={styles.pageHeaderSub}>
              Pengaturan aktif langsung mengontrol aplikasi mobile Nuenime dan portal admin.
            </Text>
          </View>

          <View style={[styles.headerButtonsRow, !isWide && styles.headerButtonsRowMobile]}>
            {hasUnsavedChanges && (
              <Pressable
                onPress={handleRevertChanges}
                style={[styles.secondaryActionBtn, !isWide && styles.btnFullMobile]}
              >
                <AppIcon name="undo-variant" size={14} color="#CBD5E1" />
                <Text style={styles.secondaryActionBtnText}>Batalkan</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                hapticLight();
                loadAllSettings();
              }}
              style={[styles.secondaryActionBtn, !isWide && styles.btnFullMobile]}
            >
              <AppIcon name="refresh" size={14} color="#CBD5E1" />
              <Text style={styles.secondaryActionBtnText}>Muat Ulang</Text>
            </Pressable>

            <Pressable
              disabled={isSaving || !hasUnsavedChanges}
              onPress={handleSaveAll}
              style={[
                styles.primaryConfirmBtn,
                (!hasUnsavedChanges || isSaving) && styles.primaryBtnDisabled,
                !isWide && styles.btnFullMobile,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name="content-save-check-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryConfirmBtnText}>Simpan Perubahan</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ─── FLOATING TOAST NOTIFICATION ─── */}
        {toastMessage && (
          <View
            style={[
              styles.floatingToast,
              toastMessage.type === "error" ? styles.toastError : styles.toastSuccess,
            ]}
          >
            <AppIcon
              name={toastMessage.type === "error" ? "alert-circle" : "check-circle"}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.toastText}>{toastMessage.message}</Text>
          </View>
        )}

        {/* ─── 2. TOP KPI STRIP (SESUAI ADMIN USERS / BORDERS) ─── */}
        <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
          {/* KPI 1: Database Status */}
          <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
            <View
              style={[
                styles.kpiStripIcon,
                {
                  backgroundColor:
                    supabaseStatus === "connected"
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(245, 158, 11, 0.12)",
                  borderColor:
                    supabaseStatus === "connected"
                      ? "rgba(16, 185, 129, 0.28)"
                      : "rgba(245, 158, 11, 0.28)",
                },
              ]}
            >
              <AppIcon
                name={supabaseStatus === "connected" ? "database-check" : "database-alert"}
                size={18}
                color={supabaseStatus === "connected" ? "#10B981" : "#F59E0B"}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kpiStripLabel} numberOfLines={1}>Status Database</Text>
              <Text
                style={[
                  styles.kpiStripVal,
                  { color: supabaseStatus === "connected" ? "#10B981" : "#F59E0B" },
                ]}
                numberOfLines={1}
              >
                {supabaseStatus === "connected"
                  ? `Online (${latencyMs ?? 0}ms)`
                  : "Standby"}
              </Text>
            </View>
          </View>

          {isWide && <View style={styles.kpiStripDivider} />}

          {/* KPI 2: Filter 18+ */}
          <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
            <View
              style={[
                styles.kpiStripIcon,
                {
                  backgroundColor: nsfwEnabled
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(16, 185, 129, 0.12)",
                  borderColor: nsfwEnabled
                    ? "rgba(239, 68, 68, 0.28)"
                    : "rgba(16, 185, 129, 0.28)",
                },
              ]}
            >
              <AppIcon
                name={nsfwEnabled ? "shield-alert" : "shield-check"}
                size={18}
                color={nsfwEnabled ? "#EF4444" : "#10B981"}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kpiStripLabel} numberOfLines={1}>Filter Konten 18+</Text>
              <Text
                style={[
                  styles.kpiStripVal,
                  { color: nsfwEnabled ? "#EF4444" : "#10B981" },
                ]}
                numberOfLines={1}
              >
                {nsfwEnabled ? "18+ Ditampilkan" : "Mode Aman Aktif"}
              </Text>
            </View>
          </View>

          {isWide && <View style={styles.kpiStripDivider} />}

          {/* KPI 3: Public Envs */}
          <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
            <View
              style={[
                styles.kpiStripIcon,
                {
                  backgroundColor: "rgba(56, 189, 248, 0.12)",
                  borderColor: "rgba(56, 189, 248, 0.28)",
                },
              ]}
            >
              <AppIcon name="code-json" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kpiStripLabel} numberOfLines={1}>Envs Runtime</Text>
              <Text style={[styles.kpiStripVal, { color: "#38BDF8" }]} numberOfLines={1}>
                {process.env.EXPO_PUBLIC_SUPABASE_URL ? "4/4 Terdeteksi" : "Konfigurasi Standby"}
              </Text>
            </View>
          </View>

          {isWide && <View style={styles.kpiStripDivider} />}

          {/* KPI 4: Unsaved Changes */}
          <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
            <View
              style={[
                styles.kpiStripIcon,
                {
                  backgroundColor: hasUnsavedChanges
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(255, 255, 255, 0.08)",
                  borderColor: hasUnsavedChanges
                    ? "rgba(245, 158, 11, 0.28)"
                    : "rgba(255, 255, 255, 0.16)",
                },
              ]}
            >
              <AppIcon
                name={hasUnsavedChanges ? "pencil-circle" : "check-all"}
                size={18}
                color={hasUnsavedChanges ? "#F59E0B" : "#CBD5E1"}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kpiStripLabel} numberOfLines={1}>Sinkronisasi</Text>
              <Text
                style={[
                  styles.kpiStripVal,
                  { color: hasUnsavedChanges ? "#F59E0B" : "#CBD5E1" },
                ]}
                numberOfLines={1}
              >
                {hasUnsavedChanges ? `${unsavedCount} Belum Simpan` : "Semua Tersimpan"}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 3. CATEGORY NAVIGATION TABS (MATCHING USERS / BORDERS / GACHA) ─── */}
        <View style={[styles.tabNavWrap, !isWide && styles.tabNavWrapMobile]}>
          {[
            { key: "general", label: "Umum & Branding", icon: "cog-outline" },
            { key: "connectivity", label: "Database & API", icon: "database-outline" },
            { key: "security", label: "Keamanan & Sesi", icon: "shield-lock-outline" },
            { key: "notifications", label: "Notifikasi & Integrasi", icon: "bell-outline" },
            { key: "maintenance", label: "Pemeliharaan & Cache", icon: "server-network" },
            { key: "audit", label: `Audit Log (${auditLogs.length})`, icon: "history" },
          ].map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => {
                hapticLight();
                setActiveCategory(cat.key as SettingsCategory);
              }}
              style={[
                styles.tabBtn,
                !isWide && styles.tabBtn2ColMobile,
                activeCategory === cat.key && styles.tabBtnActive,
              ]}
            >
              <AppIcon
                name={cat.icon as any}
                size={14}
                color={activeCategory === cat.key ? "#FFFFFF" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  !isWide && styles.tabBtnTextMobile,
                  activeCategory === cat.key && styles.tabBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── 4. CATEGORY CONTENT SECTION ─── */}
        {initialLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Memuat konfigurasi sistem Nuenime...</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {/* ══════════════════════════════════════════════════════
                CATEGORY 1: UMUM & BRANDING
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "general" && (
              <>
                {/* Global NSFW / 18+ Content Filter Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                      <AppIcon name="shield-lock" size={18} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1, minWidth: 200 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.cardTitle}>Filter Konten 18+ (Dewasa / Ecchi)</Text>
                        <View style={styles.nsfwTagPill}>
                          <Text style={styles.nsfwTagText}>18+</Text>
                        </View>
                      </View>
                      <Text style={styles.cardSubtitle}>
                        Saklar kontrol pusat konten dewasa untuk seluruh pengguna aplikasi mobile Nuenime.
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {savingNsfw && <ActivityIndicator size="small" color="#EF4444" />}
                      <Switch
                        value={nsfwEnabled}
                        onValueChange={handleToggleNsfw}
                        trackColor={{ false: "#27272A", true: "#EF4444" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusNoticeBox,
                      {
                        backgroundColor: nsfwEnabled ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                        borderColor: nsfwEnabled ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)",
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AppIcon
                        name={nsfwEnabled ? "alert-circle" : "check-circle"}
                        size={15}
                        color={nsfwEnabled ? "#EF4444" : "#10B981"}
                      />
                      <Text
                        style={[
                          styles.statusNoticeTitle,
                          { color: nsfwEnabled ? "#FCA5A5" : "#6EE7B7" },
                        ]}
                      >
                        {nsfwEnabled
                          ? "STATUS: KONTEN 18+ SEDANG DIAKTIFKAN"
                          : "STATUS: MODE AMAN AKTIF (18+ DISEMBUNYIKAN)"}
                      </Text>
                    </View>
                    <Text style={styles.statusNoticeText}>
                      {nsfwEnabled
                        ? "Semua anime berkategori dewasa/ecchi/18+ sedang ditampilkan kepada seluruh pengguna di katalog, pencarian, dan rekomendasi acak."
                        : "Semua anime berkategori dewasa/ecchi/18+ otomatis disembunyikan dari aplikasi untuk seluruh pengguna secara global (Ramah semua umur)."}
                    </Text>
                  </View>
                </View>

                {/* Identity & General Settings Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="application-cog-outline" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Identitas Platform & Lokalisasi</Text>
                      <Text style={styles.cardSubtitle}>
                        Atur nama aplikasi, deskripsi publik, zona waktu server, dan format tanggal.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGrid}>
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Nama Aplikasi (Publik):</Text>
                      <TextInput
                        value={settings.appName}
                        onChangeText={(val) => setSettings({ ...settings, appName: val })}
                        placeholder="Contoh: Nuenime - Streaming Anime"
                        placeholderTextColor="#64748B"
                        style={styles.fieldInput}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Judul Dashboard Admin:</Text>
                      <TextInput
                        value={settings.adminTitle}
                        onChangeText={(val) => setSettings({ ...settings, adminTitle: val })}
                        placeholder="Contoh: Nuenime Admin Console"
                        placeholderTextColor="#64748B"
                        style={styles.fieldInput}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>URL Domain Aplikasi:</Text>
                      <TextInput
                        value={settings.appUrl}
                        onChangeText={(val) => setSettings({ ...settings, appUrl: val })}
                        placeholder="https://nuenime.com"
                        placeholderTextColor="#64748B"
                        style={styles.fieldInput}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Zona Waktu Sistem:</Text>
                      <View style={styles.selectOptionsRow}>
                        {["Asia/Jakarta (WIB)", "Asia/Makassar (WITA)", "Asia/Jayapura (WIT)"].map((tz) => (
                          <Pressable
                            key={tz}
                            onPress={() => {
                              hapticLight();
                              setSettings({ ...settings, timezone: tz });
                            }}
                            style={[
                              styles.chipSelect,
                              settings.timezone === tz && styles.chipSelectActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipSelectText,
                                settings.timezone === tz && styles.chipSelectTextActive,
                              ]}
                            >
                              {tz}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Deskripsi Singkat Aplikasi:</Text>
                      <TextInput
                        value={settings.appDescription}
                        onChangeText={(val) => setSettings({ ...settings, appDescription: val })}
                        placeholder="Deskripsi platform..."
                        placeholderTextColor="#64748B"
                        multiline
                        numberOfLines={3}
                        style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                      />
                    </View>

                    <View style={[styles.rowTwoCols, !isWide && styles.colMobile]}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Format Tanggal & Jam:</Text>
                        <TextInput
                          value={settings.dateFormat}
                          onChangeText={(val) => setSettings({ ...settings, dateFormat: val })}
                          placeholder="DD/MM/YYYY HH:mm"
                          placeholderTextColor="#64748B"
                          style={styles.fieldInput}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Bahasa Antarmuka Default:</Text>
                        <TextInput
                          value={settings.language}
                          onChangeText={(val) => setSettings({ ...settings, language: val })}
                          placeholder="Bahasa Indonesia"
                          placeholderTextColor="#64748B"
                          style={styles.fieldInput}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                CATEGORY 2: DATABASE & API
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "connectivity" && (
              <>
                {/* Supabase Connection Status Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                      <AppIcon name="database" size={18} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Status Database & Storage Supabase</Text>
                      <Text style={styles.cardSubtitle}>
                        Pemeriksaan koneksi realtime ke Postgres cluster Supabase Nuenime.
                      </Text>
                    </View>

                    <Pressable
                      disabled={checkingPing}
                      onPress={checkConnection}
                      style={styles.secondaryActionBtn}
                    >
                      {checkingPing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="refresh" size={14} color="#FFFFFF" />
                          <Text style={styles.secondaryActionBtnText}>Uji Latensi</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <View style={styles.infoTable}>
                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Status Konektivitas:</Text>
                      <View
                        style={[
                          styles.badgePill,
                          supabaseStatus === "connected" ? styles.badgeSuccess : styles.badgeWarning,
                        ]}
                      >
                        <AppIcon
                          name={supabaseStatus === "connected" ? "check-circle" : "alert-circle"}
                          size={11}
                          color={supabaseStatus === "connected" ? "#10B981" : "#F59E0B"}
                        />
                        <Text
                          style={[
                            styles.badgePillText,
                            { color: supabaseStatus === "connected" ? "#10B981" : "#F59E0B" },
                          ]}
                        >
                          {supabaseStatus === "connected" ? "TERHUBUNG (ONLINE SUPABASE)" : "STANDBY (LOCAL PERSISTENT)"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Latensi Respon (Roundtrip Ping):</Text>
                      <Text style={styles.infoTableValueMono}>
                        {latencyMs !== null ? `${latencyMs} ms` : "Belum diuji"}
                      </Text>
                    </View>

                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Supabase Public URL:</Text>
                      <Text style={styles.infoTableValueMono} numberOfLines={1}>
                        {process.env.EXPO_PUBLIC_SUPABASE_URL || "Tersimpan di file .env"}
                      </Text>
                    </View>

                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Supabase Anon Key:</Text>
                      <Text style={styles.infoTableValueMono} numberOfLines={1}>
                        {process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
                          ? `${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.slice(0, 16)}••••••••••••••••`
                          : "Belum disetel"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Runtime Public Envs Inspector Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="code-json" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Inspektor Variabel Lingkungan Publik</Text>
                      <Text style={styles.cardSubtitle}>
                        Pemeriksaan variabel runtime klien tanpa mengekspos rahasia backend sensitif.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoTable}>
                    {[
                      { key: "EXPO_PUBLIC_SUPABASE_URL", val: process.env.EXPO_PUBLIC_SUPABASE_URL },
                      { key: "EXPO_PUBLIC_SUPABASE_ANON_KEY", val: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY },
                      { key: "EXPO_PUBLIC_ADMIN_WHATSAPP", val: process.env.EXPO_PUBLIC_ADMIN_WHATSAPP },
                      { key: "EXPO_PUBLIC_QRIS_URL", val: process.env.EXPO_PUBLIC_QRIS_URL },
                    ].map((item) => (
                      <View key={item.key} style={styles.infoTableRow}>
                        <Text style={styles.infoTableLabelMono}>{item.key}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <AppIcon
                            name={item.val ? "check" : "close"}
                            size={12}
                            color={item.val ? "#10B981" : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.infoTableStatus,
                              { color: item.val ? "#10B981" : "#64748B" },
                            ]}
                          >
                            {item.val ? "Terpasang" : "Default (Kosong)"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                CATEGORY 3: KEAMANAN & SESI
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "security" && (
              <>
                {/* Active Admin Session Info */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="account-shield" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Identitas Sesi Admin Saat Ini</Text>
                      <Text style={styles.cardSubtitle}>
                        Hak akses dan otorisasi administratif yang aktif untuk sesi login Anda.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoTable}>
                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Nama Pengguna Admin:</Text>
                      <Text style={styles.infoTableValueBold}>{adminActor.username}</Text>
                    </View>
                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Alamat Email:</Text>
                      <Text style={styles.infoTableValueMono}>{adminActor.email}</Text>
                    </View>
                    <View style={styles.infoTableRow}>
                      <Text style={styles.infoTableLabel}>Tingkatan Role:</Text>
                      <View style={[styles.badgePill, styles.badgeSuccess]}>
                        <Text style={[styles.badgePillText, { color: "#10B981" }]}>
                          SUPER ADMIN (AKSES PENUH)
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* RBAC Permission Checklist */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Matriks Hak Akses Modul:</Text>
                    <View style={styles.permissionGrid}>
                      {[
                        { label: "Kelola Sistem & Settings", allowed: canManageSystem(adminActor.role) },
                        { label: "Kelola Keuangan & Saldo", allowed: canManageFinance(adminActor.role) },
                        { label: "Kelola Akun & Role Pengguna", allowed: canManageUsers(adminActor.role) },
                        { label: "Moderasi Komunitas & Laporan", allowed: canModerate(adminActor.role) },
                      ].map((p) => (
                        <View key={p.label} style={styles.permissionItem}>
                          <AppIcon
                            name={p.allowed ? "checkbox-marked-circle" : "close-circle"}
                            size={15}
                            color={p.allowed ? "#10B981" : "#EF4444"}
                          />
                          <Text style={styles.permissionItemText}>{p.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Security Policies */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="lock-check-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Kebijakan Keamanan & Sesi</Text>
                      <Text style={styles.cardSubtitle}>
                        Batas waktu inaktivitas sesi admin dan validasi aksi berisiko tinggi.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGrid}>
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Batas Waktu Sesi Admin (Inaktivitas):</Text>
                      <View style={styles.selectOptionsRow}>
                        {[30, 60, 120, 1440].map((mins) => (
                          <Pressable
                            key={mins}
                            onPress={() => {
                              hapticLight();
                              setSettings({ ...settings, sessionTimeoutMinutes: mins });
                            }}
                            style={[
                              styles.chipSelect,
                              settings.sessionTimeoutMinutes === mins && styles.chipSelectActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipSelectText,
                                settings.sessionTimeoutMinutes === mins && styles.chipSelectTextActive,
                              ]}
                            >
                              {mins >= 1440 ? "24 Jam" : `${mins} Menit`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.switchOptionRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.switchOptionTitle}>Konfirmasi Aksi Berisiko Tinggi</Text>
                        <Text style={styles.switchOptionDesc}>
                          Wajibkan dialog konfirmasi berlapis sebelum menghapus data, memblokir akun, atau mengatur ulang saldo.
                        </Text>
                      </View>
                      <Switch
                        value={settings.requireHighRiskConfirmation}
                        onValueChange={(val) => {
                          hapticLight();
                          setSettings({ ...settings, requireHighRiskConfirmation: val });
                        }}
                        trackColor={{ false: "#27272A", true: "#10B981" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                CATEGORY 4: NOTIFIKASI & INTEGRASI
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "notifications" && (
              <>
                {/* Integration Endpoints Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="cloud-sync-outline" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Status Integrasi Layanan Eksternal</Text>
                      <Text style={styles.cardSubtitle}>
                        Status koneksi ke layanan pihak ketiga yang digunakan oleh aplikasi Nuenime.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoTable}>
                    <View style={styles.infoTableRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <AppIcon name="whatsapp" size={16} color="#25D366" />
                        <Text style={styles.infoTableLabel}>WhatsApp Dukungan CS Admin</Text>
                      </View>
                      <View style={[styles.badgePill, styles.badgeSuccess]}>
                        <Text style={[styles.badgePillText, { color: "#10B981" }]}>AKTIF</Text>
                      </View>
                    </View>

                    <View style={styles.infoTableRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <AppIcon name="qrcode-scan" size={16} color="#38BDF8" />
                        <Text style={styles.infoTableLabel}>QRIS Dynamic Payment Gateway</Text>
                      </View>
                      <View style={[styles.badgePill, styles.badgeSuccess]}>
                        <Text style={[styles.badgePillText, { color: "#10B981" }]}>TERPASANG</Text>
                      </View>
                    </View>

                    <View style={styles.infoTableRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <AppIcon name="bell-ring-outline" size={16} color="#F59E0B" />
                        <Text style={styles.infoTableLabel}>Expo Push Broadcast Service</Text>
                      </View>
                      <View style={[styles.badgePill, styles.badgeSuccess]}>
                        <Text style={[styles.badgePillText, { color: "#10B981" }]}>READY</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Notification Alert Toggles */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="bell-cog-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Preferensi Peringatan Admin</Text>
                      <Text style={styles.cardSubtitle}>
                        Pilih jenis aktivitas sistem yang memicu notifikasi langsung ke administrator.
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 14 }}>
                    <View style={styles.switchOptionRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.switchOptionTitle}>Notifikasi Transaksi Top Up Baru</Text>
                        <Text style={styles.switchOptionDesc}>
                          Kirim notifikasi audio/visual saat ada permintaan top up Crystal yang perlu diverifikasi finance.
                        </Text>
                      </View>
                      <Switch
                        value={settings.notifyOnNewTransaction}
                        onValueChange={(val) => {
                          hapticLight();
                          setSettings({ ...settings, notifyOnNewTransaction: val });
                        }}
                        trackColor={{ false: "#27272A", true: "#10B981" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    <View style={styles.switchOptionRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.switchOptionTitle}>Notifikasi Pendaftaran Akun Baru</Text>
                        <Text style={styles.switchOptionDesc}>
                          Catat notifikasi audit saat pengguna baru berhasil mendaftar akun di aplikasi Nuenime.
                        </Text>
                      </View>
                      <Switch
                        value={settings.notifyOnNewUser}
                        onValueChange={(val) => {
                          hapticLight();
                          setSettings({ ...settings, notifyOnNewUser: val });
                        }}
                        trackColor={{ false: "#27272A", true: "#10B981" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    <View style={styles.switchOptionRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.switchOptionTitle}>Notifikasi Kesalahan & Exception Sistem</Text>
                        <Text style={styles.switchOptionDesc}>
                          Kirim peringatan darurat jika terjadi kegagalan koneksi database atau timeout request kritis.
                        </Text>
                      </View>
                      <Switch
                        value={settings.notifyOnSystemError}
                        onValueChange={(val) => {
                          hapticLight();
                          setSettings({ ...settings, notifyOnSystemError: val });
                        }}
                        trackColor={{ false: "#27272A", true: "#10B981" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                CATEGORY 5: PEMELIHARAAN & CACHE
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "maintenance" && (
              <>
                {/* Maintenance Mode Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="alert-decagram-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Mode Pemeliharaan Server (Maintenance)</Text>
                      <Text style={styles.cardSubtitle}>
                        Alihkan pengguna ke layar pemeliharaan saat sedang melakukan perbaikan berkala.
                      </Text>
                    </View>

                    <Switch
                      value={maintenance.isActive}
                      onValueChange={(val) => {
                        hapticLight();
                        setMaintenance({ ...maintenance, isActive: val });
                      }}
                      trackColor={{ false: "#27272A", true: "#F59E0B" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <View style={styles.formGrid}>
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Pesan Pemberitahuan Pemeliharaan:</Text>
                      <TextInput
                        value={maintenance.message}
                        onChangeText={(val) => setMaintenance({ ...maintenance, message: val })}
                        placeholder="Server sedang dalam pemeliharaan berkala..."
                        placeholderTextColor="#64748B"
                        multiline
                        numberOfLines={3}
                        style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                      />
                    </View>

                    <View style={[styles.rowTwoCols, !isWide && styles.colMobile]}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Teks Tombol Bantuan:</Text>
                        <TextInput
                          value={maintenance.secondaryButtonText}
                          onChangeText={(val) => setMaintenance({ ...maintenance, secondaryButtonText: val })}
                          placeholder="Discord Support / CS"
                          placeholderTextColor="#64748B"
                          style={styles.fieldInput}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>URL Tautan Bantuan:</Text>
                        <TextInput
                          value={maintenance.secondaryButtonUrl}
                          onChangeText={(val) => setMaintenance({ ...maintenance, secondaryButtonUrl: val })}
                          placeholder="https://discord.gg/nuenime"
                          placeholderTextColor="#64748B"
                          style={styles.fieldInput}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Local Cache Purge Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                      <AppIcon name="trash-can-outline" size={18} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Pembersihan Cache Lokal Admin</Text>
                      <Text style={styles.cardSubtitle}>
                        Bersihkan data sementara admin dari memori peramban tanpa menghapus database pusat Supabase.
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <Text style={{ fontFamily: "Nunito-Regular", fontSize: 12, color: "#94A3B8", flex: 1, minWidth: 220 }}>
                      Gunakan saat ingin menguji ulang state default atau menyegarkan cache katalog yang tersimpan di browser.
                    </Text>

                    <Pressable
                      onPress={() => setShowClearCacheModal(true)}
                      style={styles.dangerActionBtn}
                    >
                      <AppIcon name="trash-can-outline" size={14} color="#EF4444" />
                      <Text style={styles.dangerActionBtnText}>Bersihkan Cache Lokal</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Backup & Restore Card */}
                <View style={styles.cardBox}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="backup-restore" size={18} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Ekspor & Pemulihan Konfigurasi</Text>
                      <Text style={styles.cardSubtitle}>
                        Ambil cadangan konfigurasi sistem saat ini dalam format JSON atau pulihkan dari data cadangan sebelumnya.
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={handleExportBackup}
                      style={styles.secondaryActionBtn}
                    >
                      <AppIcon name="content-copy" size={14} color="#CBD5E1" />
                      <Text style={styles.secondaryActionBtnText}>Salin Backup JSON</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setShowRestoreModal(true)}
                      style={styles.secondaryActionBtn}
                    >
                      <AppIcon name="database-import-outline" size={14} color="#38BDF8" />
                      <Text style={[styles.secondaryActionBtnText, { color: "#38BDF8" }]}>
                        Pulihkan dari Backup
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                CATEGORY 6: AUDIT LOGS & RIWAYAT
               ══════════════════════════════════════════════════════ */}
            {activeCategory === "audit" && (
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="history" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Riwayat Audit Perubahan Sistem ({filteredAuditLogs.length})</Text>
                    <Text style={styles.cardSubtitle}>
                      Rekam jejak setiap aksi administratif yang tersimpan secara permanen untuk kepatuhan & transparansi.
                    </Text>
                  </View>

                  <Pressable
                    disabled={loadingAudit}
                    onPress={async () => {
                      setLoadingAudit(true);
                      hapticLight();
                      const logs = await getAdminAuditLogs();
                      setAuditLogs(logs);
                      setLoadingAudit(false);
                      showToast("Daftar audit log berhasil dimuat ulang.", "success");
                    }}
                    style={styles.secondaryActionBtn}
                  >
                    {loadingAudit ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="refresh" size={14} color="#CBD5E1" />
                        <Text style={styles.secondaryActionBtnText}>Segarkan</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Audit Search Filter */}
                <View style={styles.searchInputWrap}>
                  <AppIcon name="magnify" size={16} color="#94A3B8" />
                  <TextInput
                    value={searchAudit}
                    onChangeText={setSearchAudit}
                    placeholder="Cari aksi (misal: SAVE_SYSTEM_SETTINGS, target, admin)..."
                    placeholderTextColor="#64748B"
                    style={styles.searchInput}
                  />
                  {searchAudit ? (
                    <Pressable onPress={() => setSearchAudit("")} style={{ padding: 4 }}>
                      <AppIcon name="close" size={14} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                </View>

                {filteredAuditLogs.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <AppIcon name="history" size={38} color="#64748B" />
                    <Text style={styles.emptyTitle}>Belum Ada Catatan Audit yang Cocok</Text>
                    <Text style={styles.emptyText}>Semua tindakan perubahan pengaturan akan otomatis tercatat di sini.</Text>
                  </View>
                ) : (
                  <View style={styles.auditList}>
                    {filteredAuditLogs.slice(0, 30).map((log) => (
                      <View key={log.id} style={styles.auditRow}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <View style={styles.actionPill}>
                              <Text style={styles.actionPillText}>{log.action}</Text>
                            </View>
                            <Text style={styles.auditTarget}>
                              Target: <Text style={{ color: "#FFFFFF" }}>{log.targetType}</Text>
                            </Text>
                          </View>
                          <Text style={styles.auditMeta}>
                            Oleh: <Text style={{ color: "#38BDF8" }}>{log.adminEmail}</Text> • ID: {log.id}
                          </Text>
                        </View>
                        <Text style={styles.auditTime}>
                          {new Date(log.createdAt).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL 1: KONFIRMASI BERSIHKAN CACHE LOKAL ─── */}
      <Modal visible={showClearCacheModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                  <AppIcon name="alert-circle" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Bersihkan Cache Lokal Admin?</Text>
                  <Text style={styles.modalSubtitle}>Tindakan ini tidak memengaruhi database Supabase.</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowClearCacheModal(false)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <Text style={{ fontFamily: "Nunito-Regular", fontSize: 13, color: "#CBD5E1", lineHeight: 18 }}>
              Seluruh riwayat cache offline di peramban Anda akan di-reset. Anda akan mendapatkan data paling mutakhir dari database server. Lanjutkan?
            </Text>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowClearCacheModal(false)}
                style={styles.secondaryActionBtn}
              >
                <Text style={styles.secondaryActionBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={clearingCache}
                onPress={handleConfirmClearCache}
                style={styles.dangerActionBtn}
              >
                {clearingCache ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.dangerActionBtnText}>Ya, Bersihkan Cache</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: PULIHKAN DARI BACKUP JSON ─── */}
      <Modal visible={showRestoreModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                  <AppIcon name="database-import-outline" size={18} color="#38BDF8" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Pulihkan Konfigurasi Sistem</Text>
                  <Text style={styles.modalSubtitle}>Tempel kode data JSON hasil ekspor backup sebelumnya.</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowRestoreModal(false)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Kode Backup JSON:</Text>
              <TextInput
                value={restoreJsonInput}
                onChangeText={setRestoreJsonInput}
                placeholder="Tempel string JSON di sini..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={6}
                style={[styles.fieldInput, { height: 120, fontFamily: "monospace", fontSize: 11 }]}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setShowRestoreModal(false);
                  setRestoreJsonInput("");
                }}
                style={styles.secondaryActionBtn}
              >
                <Text style={styles.secondaryActionBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={restoring}
                onPress={handleApplyRestore}
                style={styles.primaryConfirmBtn}
              >
                {restoring ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryConfirmBtnText}>Terapkan & Pulihkan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    gap: 16,
  },

  // ── 1. Top Header Actions Bar
  topActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    flexWrap: "wrap",
  },
  topActionBarMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: 14,
  },
  pageHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  pageHeaderSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 16,
  },
  headerButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButtonsRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
  },
  btnFullMobile: {
    width: "100%",
    justifyContent: "center",
  },
  unsavedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  unsavedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F59E0B",
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  savedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
  },

  // ── 2. Top KPI Strip (Matching Users / Borders)
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  kpiStripMobile: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  kpiStripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 130,
  },
  kpiStripItemMobile: {
    width: "48%",
    minWidth: 120,
    flex: 0,
    flexGrow: 0,
  },
  kpiStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  kpiStripLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  kpiStripVal: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
    marginTop: 1,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── 3. Tab Navigation Chips
  tabNavWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabNavWrapMobile: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabBtn2ColMobile: {
    width: "48.5%",
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
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

  // ── 4. Card Box Standard (Matching Users / Borders)
  cardBox: {
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
    gap: 12,
    flexWrap: "wrap",
  },
  cardHeaderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
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

  // ── 5. Form & Fields
  formGrid: {
    gap: 12,
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldInput: {
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
  rowTwoCols: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  colMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  // ── 6. Select Options & Chips
  selectOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipSelect: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  chipSelectActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  chipSelectText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  chipSelectTextActive: {
    color: "#38BDF8",
  },

  // ── 7. Switch Option Rows
  switchOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  switchOptionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  switchOptionDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },

  // ── 8. Notice & Info Tables
  statusNoticeBox: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusNoticeTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  statusNoticeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  nsfwTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  nsfwTagText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  infoTable: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  infoTableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
    flexWrap: "wrap",
    gap: 8,
  },
  infoTableLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  infoTableLabelMono: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  infoTableValueBold: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  infoTableValueMono: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  infoTableStatus: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },

  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgePillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  badgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.28)",
  },
  badgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.28)",
  },

  // ── 9. Permission Grid
  permissionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    width: "48.5%",
  },
  permissionItemText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#CBD5E1",
  },

  // ── 10. Buttons Matching Users.tsx
  primaryConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0284C7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    opacity: 0.6,
  },
  primaryConfirmBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  secondaryActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  dangerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  dangerActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#EF4444",
  },

  // ── 11. Audit List
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#FFFFFF",
  },
  auditList: {
    gap: 8,
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 10,
    flexWrap: "wrap",
  },
  actionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  actionPillText: {
    fontFamily: "monospace",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  auditTarget: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  auditMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  auditTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  // ── 12. Floating Toast & Empty State
  floatingToast: {
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
  toastSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#881337",
    borderColor: "#F43F5E",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  loadingWrap: {
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
  emptyWrap: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#64748B",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
  },

  // ── 13. Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
});
