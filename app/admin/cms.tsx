import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AdminUser,
  type BrokenStreamReport,
  getAdminBrokenStreamReports,
  updateBrokenStreamReportStatus,
  deleteBrokenStreamReport,
} from "@/lib/admin-service";

type StatusFilter = "all" | "pending" | "investigating" | "fixed" | "invalid";

// ─── IN-MEMORY SWR CACHE (0ms Instant Load Tanpa Reload Berulang) ──────────
let memBrokenReportsCache: BrokenStreamReport[] = [];

if (typeof window !== "undefined" && window.localStorage) {
  try {
    const raw = window.localStorage.getItem("nuenime.cached_broken_reports");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memBrokenReportsCache = parsed;
      }
    }
  } catch {}
}

const STATUS_THEME: Record<
  BrokenStreamReport["status"],
  { label: string; color: string; bgBadge: string; borderBadge: string; icon: string }
> = {
  pending: {
    label: "MENUNGGU",
    color: "#F59E0B",
    bgBadge: "rgba(245, 158, 11, 0.15)",
    borderBadge: "rgba(245, 158, 11, 0.35)",
    icon: "clock-outline",
  },
  investigating: {
    label: "SEDANG DICEK",
    color: "#38BDF8",
    bgBadge: "rgba(56, 189, 248, 0.15)",
    borderBadge: "rgba(56, 189, 248, 0.35)",
    icon: "magnify",
  },
  fixed: {
    label: "SELESAI",
    color: "#10B981",
    bgBadge: "rgba(16, 185, 129, 0.15)",
    borderBadge: "rgba(16, 185, 129, 0.35)",
    icon: "check-circle",
  },
  invalid: {
    label: "TIDAK VALID",
    color: "#EF4444",
    bgBadge: "rgba(239, 68, 68, 0.15)",
    borderBadge: "rgba(239, 68, 68, 0.35)",
    icon: "close-circle-outline",
  },
};

function formatTimeAgo(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Baru saja";
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "Baru saja";
  }
}

export default function AdminBrokenStreamScreen() {
  const auth = useAnirakuAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const [loading, setLoading] = useState(() => memBrokenReportsCache.length === 0);
  const [reports, setReports] = useState<BrokenStreamReport[]>(() => memBrokenReportsCache);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedReport, setSelectedReport] = useState<BrokenStreamReport | null>(null);
  const [reportToDelete, setReportToDelete] = useState<BrokenStreamReport | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const adminUser: AdminUser = auth.user
    ? {
        id: auth.user.id,
        email: auth.user.email ?? "admin@nuenime.com",
        username: auth.user.user_metadata?.username ?? auth.user.email?.split("@")[0] ?? "Admin",
        role: "super_admin",
      }
    : {
        id: "admin-super",
        email: "superadmin@nuenime.com",
        username: "Super Admin",
        role: "super_admin",
      };

  const loadData = useCallback(async (isManual = false) => {
    if (isManual || memBrokenReportsCache.length === 0) setLoading(true);
    try {
      const list = await getAdminBrokenStreamReports();
      memBrokenReportsCache = list;
      setReports(list);
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("nuenime.cached_broken_reports", JSON.stringify(list));
        } catch {}
      }
    } catch (err) {
      console.warn("[AdminBrokenStream] Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── FILTERED REPORTS ───
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (r.animeTitle || "").toLowerCase().includes(q);
        const matchReporter = (r.reporter || "").toLowerCase().includes(q);
        const matchDesc = (r.issueDescription || "").toLowerCase().includes(q);
        const matchServer = (r.serverName || "").toLowerCase().includes(q);
        const matchEp = `episode ${r.episodeNumber}`.includes(q) || `ep ${r.episodeNumber}`.includes(q);
        if (!matchTitle && !matchReporter && !matchDesc && !matchServer && !matchEp) return false;
      }

      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  // ─── COUNTS ───
  const totalCount = reports.length;
  const pendingCount = useMemo(() => reports.filter((r) => r.status === "pending").length, [reports]);
  const investigatingCount = useMemo(() => reports.filter((r) => r.status === "investigating").length, [reports]);
  const fixedCount = useMemo(() => reports.filter((r) => r.status === "fixed").length, [reports]);
  const invalidCount = useMemo(() => reports.filter((r) => r.status === "invalid").length, [reports]);

  // ─── UPDATE STATUS HANDLER ───
  const handleUpdateStatus = async (id: string, newStatus: BrokenStreamReport["status"]) => {
    setActionLoading(true);
    hapticLight();
    try {
      const updated = await updateBrokenStreamReportStatus(id, newStatus, adminUser);
      setReports(updated);
      memBrokenReportsCache = updated;
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
      hapticSuccess();
      showToast(`Status laporan berhasil diubah menjadi: ${STATUS_THEME[newStatus].label}`, "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal memperbarui status laporan.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── DELETE REPORT HANDLER ───
  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setActionLoading(true);
    hapticLight();
    try {
      const res = await deleteBrokenStreamReport(reportToDelete.id, adminUser);
      if (res.success) {
        const next = reports.filter((r) => r.id !== reportToDelete.id);
        setReports(next);
        memBrokenReportsCache = next;
        if (selectedReport && selectedReport.id === reportToDelete.id) {
          setSelectedReport(null);
        }
        setReportToDelete(null);
        hapticSuccess();
        showToast("Laporan berhasil dihapus dari sistem.", "success");
      } else {
        showToast(res.error || "Gagal menghapus laporan.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Terjadi kesalahan sistem saat menghapus laporan.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Laporan Video & Streaming Rusak"
      subtitle={`Pantau kendala video, buffering, dan link broken dari seluruh penonton APK Nuenime (${totalCount} Total)`}
      mobileTitle="Laporan Rusak"
      mobileSubtitle="Laporan kendala video penonton"
      activeKey="cms"
    >
      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <View style={[styles.toastBanner, toast.type === "error" && styles.toastError]}>
          <AppIcon
            name={toast.type === "error" ? "alert-circle-outline" : "check-circle"}
            size={16}
            color={toast.type === "error" ? "#EF4444" : "#10B981"}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* ─── TOP KPI STRIP (Identik UI Inventory & Border Avatar) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="alert-circle-outline" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Total Laporan</Text>
            <Text style={styles.kpiStripVal}>{totalCount} Tiket</Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="clock-outline" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Menunggu Tindakan</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]}>{pendingCount} Menunggu</Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="magnify" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Sedang Diperiksa</Text>
            <Text style={[styles.kpiStripVal, { color: "#38BDF8" }]}>{investigatingCount} Kasus</Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Selesai Diperbaiki</Text>
            <Text style={[styles.kpiStripVal, { color: "#10B981" }]}>{fixedCount} Selesai</Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER & REFRESH ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Panduan Penanganan Laporan Rusak</Text>
            <Text style={styles.infoBannerText}>
              Setiap kali penonton di aplikasi APK menekan tombol 🚩 Report pada video, laporan akan masuk secara
              real-time ke sini. Ubah status menjadi "Sedang Dicek" saat memperbaiki server, lalu "Selesai" jika video
              sudah dapat diputar normal kembali.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            hapticLight();
            void loadData(true);
          }}
          style={styles.refreshBtn}
        >
          <AppIcon name="refresh" size={13} color="#94A3B8" />
          <Text style={styles.refreshBtnText}>Muat Ulang</Text>
        </Pressable>
      </View>

      {/* ─── FILTER & SEARCH SECTION (Identik UI Inventory & Border Avatar) ─── */}
      <View style={styles.filterCard}>
        <View style={[styles.topFilterHeader, !isWide && styles.topFilterHeaderMobile]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.filterSectionTitle}>Daftar Laporan Penonton</Text>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{filteredReports.length} Laporan</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <AppIcon name="magnify" size={18} color="#94A3B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari judul anime, episode, pelapor, server, atau kendala..."
              placeholderTextColor="#64748B"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                <AppIcon name="close" size={14} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Status Chips Filter */}
        <View style={[styles.statusFilterRow, !isWide && styles.statusFilterGridMobile]}>
          {[
            { key: "all", label: `Semua Status (${totalCount})` },
            { key: "pending", label: `Menunggu (${pendingCount})`, color: "#F59E0B" },
            { key: "investigating", label: `Sedang Dicek (${investigatingCount})`, color: "#38BDF8" },
            { key: "fixed", label: `Selesai (${fixedCount})`, color: "#10B981" },
            { key: "invalid", label: `Tidak Valid (${invalidCount})`, color: "#EF4444" },
          ].map((f) => {
            const isActive = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  hapticLight();
                  setStatusFilter(f.key as any);
                }}
                style={[
                  styles.statusFilterChip,
                  isActive && styles.statusFilterChipActive,
                  isActive && f.color ? { borderColor: f.color } : null,
                ]}
              >
                {f.color ? (
                  <View style={[styles.statusDot, { backgroundColor: f.color }]} />
                ) : null}
                <Text
                  style={[
                    styles.statusFilterText,
                    isActive && styles.statusFilterTextActive,
                    isActive && f.color ? { color: f.color } : null,
                  ]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ─── GRID KARTU LAPORAN RUSAK (Identik UI Inventory & Border Avatar) ─── */}
      {loading && reports.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat daftar laporan video rusak...</Text>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppIcon name="alert-circle-outline" size={40} color="#334155" />
          <Text style={styles.emptyTitle}>Tidak Ada Laporan yang Cocok</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? "Coba ubah kata kunci pencarian atau sesuaikan filter status penanganan."
              : "Semua server streaming video saat ini berjalan lancar tanpa laporan kendala dari penonton."}
          </Text>
          {searchQuery ? (
            <Pressable
              onPress={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              style={styles.resetFilterBtn}
            >
              <AppIcon name="refresh" size={13} color="#FFFFFF" />
              <Text style={styles.resetFilterBtnText}>Reset Pencarian</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.cardGrid}>
          {filteredReports.map((r) => {
            const theme = STATUS_THEME[r.status] || STATUS_THEME.pending;
            return (
              <View
                key={r.id}
                style={[
                  styles.reportCard,
                  isWide ? styles.reportCardDesktop : styles.reportCardMobile,
                  r.status === "pending" && { borderColor: "rgba(245, 158, 11, 0.28)" },
                  r.status === "investigating" && { borderColor: "rgba(56, 189, 248, 0.28)" },
                ]}
              >
                {/* Header Row: Status Badge & Time */}
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: theme.bgBadge, borderColor: theme.borderBadge },
                    ]}
                  >
                    <View style={[styles.statusBadgeDot, { backgroundColor: theme.color }]} />
                    <Text style={[styles.statusBadgeText, { color: theme.color }]}>{theme.label}</Text>
                  </View>

                  <Text style={styles.timeText}>{formatTimeAgo(r.createdAt)}</Text>
                </View>

                {/* Anime & Episode Title Box */}
                <View style={styles.animeHeaderBox}>
                  <View style={styles.animeIconBox}>
                    <AppIcon name="television-play" size={18} color="#A855F7" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.animeTitleText} numberOfLines={1}>
                      {r.animeTitle}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.epPill}>
                        <Text style={styles.epPillText}>Episode {r.episodeNumber}</Text>
                      </View>
                      <View style={styles.serverPill}>
                        <AppIcon name="server" size={10} color="#94A3B8" />
                        <Text style={styles.serverPillText} numberOfLines={1}>
                          {r.serverName}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Pelapor Info Strip */}
                <View style={styles.reporterStrip}>
                  <View style={styles.reporterAvatarBox}>
                    {r.reporterAvatar ? (
                      <Image source={{ uri: r.reporterAvatar }} style={styles.reporterAvatar} contentFit="cover" />
                    ) : (
                      <AppIcon name="account" size={13} color="#94A3B8" />
                    )}
                  </View>
                  <Text style={styles.reporterNameText} numberOfLines={1}>
                    @{r.reporter}
                  </Text>
                </View>

                {/* Issue Description Quote Box */}
                <View style={styles.issueBox}>
                  <View style={{ marginTop: 2 }}>
                    <AppIcon name="message-alert-outline" size={13} color="#CBD5E1" />
                  </View>
                  <Text style={styles.issueText} numberOfLines={3}>
                    {r.issueDescription}
                  </Text>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.cardActionsRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSelectedReport(r);
                    }}
                    style={styles.detailBtn}
                  >
                    <AppIcon name="clipboard-text-outline" size={13} color="#CBD5E1" />
                    <Text style={styles.detailBtnText}>Detail</Text>
                  </Pressable>

                  {r.status === "pending" && (
                    <Pressable
                      disabled={actionLoading}
                      onPress={() => handleUpdateStatus(r.id, "investigating")}
                      style={styles.investBtn}
                    >
                      <AppIcon name="magnify" size={13} color="#FFFFFF" />
                      <Text style={styles.investBtnText}>Mulai Cek</Text>
                    </Pressable>
                  )}

                  {r.status === "investigating" && (
                    <Pressable
                      disabled={actionLoading}
                      onPress={() => handleUpdateStatus(r.id, "fixed")}
                      style={styles.fixBtn}
                    >
                      <AppIcon name="check" size={13} color="#FFFFFF" />
                      <Text style={styles.fixBtnText}>Selesai</Text>
                    </Pressable>
                  )}

                  {r.status === "fixed" && (
                    <View style={styles.fixedDoneTag}>
                      <AppIcon name="check-all" size={12} color="#10B981" />
                      <Text style={styles.fixedDoneTagText}>Diperbaiki</Text>
                    </View>
                  )}

                  <Pressable
                    disabled={actionLoading}
                    onPress={() => {
                      hapticLight();
                      setReportToDelete(r);
                    }}
                    style={styles.deleteBtn}
                  >
                    <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── MODAL DETAIL LAPORAN ─── */}
      <Modal visible={selectedReport !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={styles.modalHeaderIconWrap}>
                  <AppIcon name="clipboard-text-outline" size={18} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Detail Laporan Rusak</Text>
                  <Text style={styles.modalHeaderSub}>ID Tiket: {selectedReport?.id}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setSelectedReport(null)}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={16} color="#94A3B8" />
              </Pressable>
            </View>

            {selectedReport && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Anime Box */}
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Anime & Episode:</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedReport.animeTitle} — Episode {selectedReport.episodeNumber}
                  </Text>
                </View>

                {/* Server & Reporter */}
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Server / Track:</Text>
                  <Text style={styles.modalDetailValue}>{selectedReport.serverName}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Pelapor Akun:</Text>
                  <Text style={styles.modalDetailValue}>
                    @{selectedReport.reporter} {selectedReport.userId ? `(${selectedReport.userId})` : "(Guest)"}
                  </Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Waktu Masuk:</Text>
                  <Text style={styles.modalDetailValue}>
                    {new Date(selectedReport.createdAt).toLocaleString("id-ID")} ({formatTimeAgo(selectedReport.createdAt)})
                  </Text>
                </View>

                {/* Description */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.modalDetailLabel}>Keterangan Detail Kendala:</Text>
                  <View style={styles.modalIssueBox}>
                    <Text style={styles.modalIssueText}>{selectedReport.issueDescription}</Text>
                  </View>
                </View>

                {/* Status Switcher */}
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.modalDetailLabel}>UBAH STATUS PENANGANAN:</Text>
                  <View style={styles.modalStatusRow}>
                    {(["pending", "investigating", "fixed", "invalid"] as const).map((st) => {
                      const theme = STATUS_THEME[st];
                      const isCurrent = selectedReport.status === st;
                      return (
                        <Pressable
                          key={st}
                          disabled={actionLoading}
                          onPress={() => handleUpdateStatus(selectedReport.id, st)}
                          style={[
                            styles.modalStatusChip,
                            isCurrent && {
                              backgroundColor: theme.bgBadge,
                              borderColor: theme.color,
                            },
                          ]}
                        >
                          <View style={[styles.statusDot, { backgroundColor: theme.color }]} />
                          <Text
                            style={[
                              styles.modalStatusText,
                              isCurrent && { color: theme.color, fontWeight: "800" },
                            ]}
                          >
                            {theme.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  if (selectedReport) {
                    setReportToDelete(selectedReport);
                  }
                }}
                style={styles.modalDeleteActionBtn}
              >
                <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                <Text style={styles.modalDeleteActionText}>Hapus Laporan</Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedReport(null)}
                style={styles.modalDoneBtn}
              >
                <Text style={styles.modalDoneBtnText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL KONFIRMASI HAPUS ─── */}
      <Modal visible={reportToDelete !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconWrap}>
                <AppIcon name="trash-can-outline" size={20} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteModalTitle}>Hapus Laporan Ini?</Text>
                <Text style={styles.deleteModalSubtitle}>Tindakan ini permanen dan tidak dapat dibatalkan</Text>
              </View>
            </View>

            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailLabel}>Anime:</Text>
              <Text style={styles.modalDetailValue} numberOfLines={1}>
                {reportToDelete?.animeTitle} (Ep. {reportToDelete?.episodeNumber})
              </Text>
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                disabled={actionLoading}
                onPress={() => setReportToDelete(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={actionLoading}
                onPress={handleDeleteReport}
                style={styles.modalConfirmDeleteBtn}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmDeleteText}>Hapus Laporan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

// ─── STYLES (Identik Presisi dengan Inventory & Border Avatar) ──────────
const styles = StyleSheet.create({
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  toastError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },

  // KPI Top Strip
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 16,
    gap: 16,
    marginBottom: 14,
  },
  kpiStripMobile: {
    flexWrap: "wrap",
    gap: 12,
  },
  kpiStripItem: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kpiStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiStripLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#64748B",
  },
  kpiStripVal: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // Info Banner
  infoBanner: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoBannerTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  infoBannerText: {
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
  },
  refreshBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },

  // Filter Card
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
    marginBottom: 16,
  },
  topFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topFilterHeaderMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  filterSectionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  badgePillText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
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
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  statusFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusFilterGridMobile: {
    gap: 6,
  },
  statusFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusFilterChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusFilterText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  statusFilterTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Loading & Empty States
  loadingWrap: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyWrap: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1117",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 420,
    lineHeight: 18,
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  resetFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Card Grid (Identik dengan borderGrid)
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  reportCard: {
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 10,
  },
  reportCardDesktop: {
    width: "32.2%",
    minWidth: 280,
  },
  reportCardMobile: {
    width: "100%",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
  },

  // Anime Header
  animeHeaderBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  animeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  animeTitleText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  epPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  epPillText: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "800",
  },
  serverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  serverPillText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },

  // Reporter Strip
  reporterStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  reporterAvatarBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reporterAvatar: {
    width: "100%",
    height: "100%",
  },
  reporterNameText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },

  // Issue Quote Box
  issueBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  issueText: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 11.5,
    lineHeight: 16,
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  detailBtnText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
  },
  investBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#38BDF8",
  },
  investBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
  },
  fixBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  fixBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
  },
  fixedDoneTag: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  fixedDoneTagText: {
    color: "#10B981",
    fontSize: 10.5,
    fontWeight: "800",
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal Detail Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    backgroundColor: "#0D1117",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalHeaderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalHeaderSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 16,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  modalDetailLabel: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "700",
  },
  modalDetailValue: {
    color: "#F1F5F9",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  modalIssueBox: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 6,
  },
  modalIssueText: {
    color: "#E2E8F0",
    fontSize: 12.5,
    lineHeight: 18,
  },
  modalStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  modalStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalStatusText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  modalDeleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  modalDeleteActionText: {
    color: "#F43F5E",
    fontSize: 12,
    fontWeight: "800",
  },
  modalDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modalDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },

  // Delete Modal
  deleteModalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    gap: 14,
  },
  deleteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteModalSubtitle: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
  },
  modalConfirmDeleteBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmDeleteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
