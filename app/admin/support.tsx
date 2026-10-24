import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Switch,
  Alert,
  useWindowDimensions,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AdminUser,
  type SupportTicket,
  type SupportTicketMessage,
  getAdminSupportTickets,
  getSupportTicketMessages,
  sendAdminTicketReply,
  updateSupportTicketStatus,
} from "@/lib/admin-service";
import {
  type SupportConfig,
  getSupportConfig,
  saveSupportConfig,
  resetSupportConfigToDefault,
} from "@/lib/support-service";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

export default function AdminSupportScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const [activeTab, setActiveTab] = useState<"settings" | "tickets">("settings");

  // ── Support Settings State ──
  const [supportConfig, setSupportConfig] = useState<SupportConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Editable Form fields
  const [formSaweriaUrl, setFormSaweriaUrl] = useState("");
  const [formSaweriaActive, setFormSaweriaActive] = useState(true);
  const [formHeroGifUrl, setFormHeroGifUrl] = useState("");
  const [formThankYouGifUrl, setFormThankYouGifUrl] = useState("");
  const [formHeadlineBadge, setFormHeadlineBadge] = useState("");
  const [formHeadlineTitle, setFormHeadlineTitle] = useState("");
  const [formHeadlineSubtitle, setFormHeadlineSubtitle] = useState("");
  const [formSaweriaTitle, setFormSaweriaTitle] = useState("");
  const [formSaweriaDescription, setFormSaweriaDescription] = useState("");
  const [formFootnote, setFormFootnote] = useState("");
  const [formPerks, setFormPerks] = useState<Array<{ icon: string; text: string }>>([]);
  const [newPerkText, setNewPerkText] = useState("");

  // ── Tickets State ──
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Action Toast (Floating Toast persis Gamification & Gacha Theme) ──
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast(null);
    }, 3200);
  }, []);

  const currentAdmin: AdminUser = {
    id: "admin-cs",
    email: "cs@nuenime.com",
    username: "Customer Care",
    role: "super_admin",
  };

  // Load Config
  const loadConfig = async () => {
    setIsConfigLoading(true);
    try {
      const cfg = await getSupportConfig();
      setSupportConfig(cfg);
      setFormSaweriaUrl(cfg.saweriaUrl);
      setFormSaweriaActive(cfg.saweriaActive);
      setFormHeroGifUrl(cfg.heroGifUrl);
      setFormThankYouGifUrl(cfg.thankYouGifUrl);
      setFormHeadlineBadge(cfg.headlineBadge);
      setFormHeadlineTitle(cfg.headlineTitle);
      setFormHeadlineSubtitle(cfg.headlineSubtitle);
      setFormSaweriaTitle(cfg.saweriaTitle);
      setFormSaweriaDescription(cfg.saweriaDescription);
      setFormFootnote(cfg.footnote);
      setFormPerks(cfg.perks || []);
    } finally {
      setIsConfigLoading(false);
    }
  };

  // Load Tickets
  const loadTickets = async () => {
    setIsTicketsLoading(true);
    try {
      const list = await getAdminSupportTickets();
      setTickets(list);
    } finally {
      setIsTicketsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadTickets();
  }, []);

  // Save Config
  const handleSaveConfig = async () => {
    if (!formSaweriaUrl.trim()) {
      hapticWarning();
      showToast("URL Saweria tidak boleh kosong!", "error");
      return;
    }

    setIsSavingConfig(true);
    hapticLight();
    try {
      const updated: SupportConfig = {
        saweriaUrl: formSaweriaUrl.trim(),
        saweriaActive: formSaweriaActive,
        heroGifUrl: formHeroGifUrl.trim(),
        thankYouGifUrl: formThankYouGifUrl.trim(),
        headlineBadge: formHeadlineBadge.trim(),
        headlineTitle: formHeadlineTitle.trim(),
        headlineSubtitle: formHeadlineSubtitle.trim(),
        saweriaTitle: formSaweriaTitle.trim(),
        saweriaDescription: formSaweriaDescription.trim(),
        perks: formPerks,
        footnote: formFootnote.trim(),
      };

      await saveSupportConfig(updated, currentAdmin);
      setSupportConfig(updated);
      hapticSuccess();
      showToast("Pengaturan halaman Support & Saweria berhasil disimpan!", "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan pengaturan support.", "error");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Reset Config
  const handleResetConfig = () => {
    hapticWarning();
    Alert.alert(
      "Reset Pengaturan",
      "Kembalikan pengaturan halaman Support & Saweria ke default Nuenime?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset Default",
          style: "destructive",
          onPress: async () => {
            try {
              const def = await resetSupportConfigToDefault(currentAdmin);
              setSupportConfig(def);
              setFormSaweriaUrl(def.saweriaUrl);
              setFormSaweriaActive(def.saweriaActive);
              setFormHeroGifUrl(def.heroGifUrl);
              setFormThankYouGifUrl(def.thankYouGifUrl);
              setFormHeadlineBadge(def.headlineBadge);
              setFormHeadlineTitle(def.headlineTitle);
              setFormHeadlineSubtitle(def.headlineSubtitle);
              setFormSaweriaTitle(def.saweriaTitle);
              setFormSaweriaDescription(def.saweriaDescription);
              setFormFootnote(def.footnote);
              setFormPerks(def.perks || []);
              hapticSuccess();
              showToast("Pengaturan berhasil direset ke default!", "success");
            } catch (e: any) {
              hapticWarning();
              showToast(e?.message || "Gagal mereset pengaturan.", "error");
            }
          },
        },
      ]
    );
  };

  // Perks
  const handleAddPerk = () => {
    if (!newPerkText.trim()) return;
    hapticLight();
    setFormPerks([...formPerks, { icon: "heart", text: newPerkText.trim() }]);
    setNewPerkText("");
  };

  const handleRemovePerk = (index: number) => {
    hapticLight();
    setFormPerks(formPerks.filter((_, i) => i !== index));
  };

  // Tickets
  const handleOpenTicket = async (ticket: SupportTicket) => {
    hapticLight();
    setSelectedTicket(ticket);
    const msgs = await getSupportTicketMessages(ticket.id);
    setMessages(msgs);
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsSendingReply(true);
    hapticLight();
    try {
      const newMsg = await sendAdminTicketReply({
        ticketId: selectedTicket.id,
        message: replyText.trim(),
        admin: currentAdmin,
      });
      setMessages((prev) => [...prev, newMsg]);
      setReplyText("");
      const updatedList = await getAdminSupportTickets();
      setTickets(updatedList);
      const current = updatedList.find((t) => t.id === selectedTicket.id);
      if (current) setSelectedTicket(current);
      hapticSuccess();
      showToast("Balasan CS berhasil dikirim ke akun pengguna!", "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal mengirim balasan.", "error");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    if (!selectedTicket) return;
    hapticLight();
    try {
      const updated = await updateSupportTicketStatus(selectedTicket.id, status, currentAdmin);
      setTickets(updated);
      const current = updated.find((t) => t.id === selectedTicket.id);
      if (current) setSelectedTicket(current);
      hapticSuccess();
      showToast(`Status tiket diubah menjadi: ${status.toUpperCase()}`, "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal mengubah status tiket.", "error");
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.username.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, statusFilter, search]);

  const openTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.status === "open").length;
  }, [tickets]);

  return (
    <AdminLayout
      title="Customer Support & Donasi"
      subtitle="Kelola tautan Saweria, banner donasi anime, dan pantau tiket bantuan kendala pengguna"
      mobileTitle="Support"
      mobileSubtitle="Saweria & Tiket Layanan"
      activeKey="support"
    >
      {/* ─── TOP KPI STRIP (PERSIS ADMIN GAMIFICATION THEME) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View
            style={[
              styles.kpiStripIcon,
              { backgroundColor: formSaweriaActive ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)" },
            ]}
          >
            <AppIcon name="coffee" size={18} color={formSaweriaActive ? "#10B981" : "#F43F5E"} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Status Saweria</Text>
            <Text
              style={[
                styles.kpiStripVal,
                { color: formSaweriaActive ? "#10B981" : "#F43F5E" },
              ]}
              numberOfLines={1}
            >
              {formSaweriaActive ? "Aktif / Online 🟢" : "Nonaktif 🔴"}
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="inbox-outline" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Tiket Menunggu</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]} numberOfLines={1}>
              {openTicketsCount} Menunggu
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="ticket-confirmation-outline" size={18} color="#38BDF8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Total Tiket</Text>
            <Text style={[styles.kpiStripVal, { color: "#38BDF8" }]} numberOfLines={1}>
              {tickets.length} Tiket
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View
            style={[
              styles.kpiStripIcon,
              { backgroundColor: "rgba(255, 255, 255, 0.08)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" },
            ]}
          >
            <AppIcon name="link-variant" size={18} color="#CBD5E1" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Tautan Donasi</Text>
            <Text style={[styles.kpiStripVal, { color: "#FFFFFF" }]} numberOfLines={1}>
              {formSaweriaUrl ? formSaweriaUrl.replace(/^https?:\/\//, "") : "saweria.co/..."}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER (PERSIS GAMIFICATION THEME) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.infoBannerTitle}>Pusat Pengaturan Layanan Bantuan & Dukungan Komunitas Nuenime</Text>
            <Text style={styles.infoBannerText}>
              Kelola tautan Saweria, banner animasi GIF hero, serta poin manfaat dukungan pada aplikasi pengguna.
              Setiap tiket kendala yang diajukan pemain dapat dibalas langsung secara real-time dan tersinkronisasi dengan akun pengguna.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (CHIP STYLE SILVER LIQUID GLASS) ─── */}
      <View style={[styles.tabNavWrap, !isWide && styles.tabNavWrapMobile]}>
        {[
          {
            key: "settings",
            label: isWide ? "Pengaturan Donasi & Saweria" : "Saweria",
            icon: "coffee",
          },
          {
            key: "tickets",
            label: isWide
              ? `Tiket Layanan (${openTicketsCount} Terbuka)`
              : `Tiket (${openTicketsCount})`,
            icon: "inbox-outline",
          },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as "settings" | "tickets");
            }}
            style={[
              styles.tabBtn,
              !isWide && styles.tabBtnMobile,
              activeTab === t.key && styles.tabBtnActive,
            ]}
          >
            <AppIcon
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabBtnText,
                !isWide && styles.tabBtnTextMobile,
                activeTab === t.key && styles.tabBtnTextActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ─── FLOATING ACTION TOAST (PERSIS GACHA & GAMIFICATION THEME) ─── */}
      {actionToast && (
        <View
          style={[
            styles.floatingToast,
            !isWide && styles.floatingToastMobile,
            actionToast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <AppIcon
            name={actionToast.type === "error" ? "alert-circle" : "check-circle"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{actionToast.message}</Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 1: SUPPORT & SAWERIA SETTINGS
         ══════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <View style={styles.contentWrap}>
          {isConfigLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingText}>Memuat konfigurasi support & donasi dari database...</Text>
            </View>
          ) : (
            <View style={[styles.twoColumnsLayout, !isWide && styles.twoColumnsLayoutMobile]}>
              {/* KOLOM KIRI: FORM PENGATURAN SAWERIA */}
              <View
                style={[
                  styles.contentCard,
                  isWide ? styles.formCardFlex : styles.formCardFlexMobile,
                  !isWide && styles.contentCardMobile,
                ]}
              >
                <View style={[styles.cardHeaderRow, !isWide && styles.cardHeaderRowMobile]}>
                  <View style={[styles.cardHeaderTitleRow, !isWide && styles.cardHeaderTitleRowMobile]}>
                    <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="coffee" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle}>Konfigurasi Tautan & Konten Saweria</Text>
                      <Text style={styles.cardSubtitle}>
                        Atur tautan Saweria resmi Nuenime, status donasi aktif, serta teks ajakan donasi.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardHeaderBtns, !isWide && styles.cardHeaderBtnsMobile]}>
                    <Pressable
                      style={[styles.silverLiquidSecondaryBtn, !isWide && styles.silverLiquidSecondaryBtnMobile]}
                      onPress={handleResetConfig}
                    >
                      <AppIcon name="refresh" size={13} color="#CBD5E1" />
                      <Text style={styles.silverLiquidSecondaryBtnText} numberOfLines={1}>Reset Default</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.primaryActionBtnSilverMini, !isWide && styles.primaryActionBtnSilverMiniMobile, isSavingConfig && { opacity: 0.6 }]}
                      onPress={handleSaveConfig}
                      disabled={isSavingConfig}
                    >
                      {isSavingConfig ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="check" size={14} color="#FFFFFF" />
                          <Text style={styles.primaryActionBtnSilverMiniText} numberOfLines={1}>Simpan Pengaturan</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>

                {/* Saweria Link Input */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>URL Saweria Nuenime</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formSaweriaUrl}
                    onChangeText={setFormSaweriaUrl}
                    placeholder="https://saweria.co/Nuenime"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />
                  <Text style={styles.fieldHint}>Tautan Saweria yang otomatis dibuka saat pengguna menekan tombol donasi.</Text>
                </View>

                {/* Toggle Status Donasi (Persis Gamification / System Toggle) */}
                <View style={[styles.toggleRow, !isWide && styles.toggleRowMobile]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.toggleTitle}>Status Penerimaan Donasi</Text>
                    <Text style={styles.toggleDesc}>
                      {formSaweriaActive
                        ? "Donasi Saweria aktif. Tombol donasi ditampilkan di aplikasi penonton."
                        : "Donasi Saweria dinonaktifkan sementara di aplikasi penonton."}
                    </Text>
                  </View>
                  <Switch
                    value={formSaweriaActive}
                    onValueChange={setFormSaweriaActive}
                    thumbColor={formSaweriaActive ? "#10B981" : "#94A3B8"}
                    trackColor={{ false: "rgba(255, 255, 255, 0.08)", true: "rgba(16, 185, 129, 0.35)" }}
                  />
                </View>

                {/* GIF URLs */}
                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1, minWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>URL GIF Hero Anime (Banner Atas)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formHeroGifUrl}
                      onChangeText={setFormHeroGifUrl}
                      placeholder="https://media1.giphy.com/.../giphy.gif"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                    />
                    <Text style={styles.fieldHint}>Animasi anime di latar belakang banner kartu donasi.</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1, minWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>URL GIF Ucapan Terima Kasih (Arigatou)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formThankYouGifUrl}
                      onChangeText={setFormThankYouGifUrl}
                      placeholder="https://media2.giphy.com/.../giphy.gif"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                    />
                    <Text style={styles.fieldHint}>GIF chibi atau anime yang muncul setelah donasi diklik.</Text>
                  </View>
                </View>

                {/* Headlines */}
                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: isWide ? 1 : undefined, minWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>Teks Badge Hero</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formHeadlineBadge}
                      onChangeText={setFormHeadlineBadge}
                      placeholder="NUENIME"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: isWide ? 2 : undefined, minWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>Judul Banner</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formHeadlineTitle}
                      onChangeText={setFormHeadlineTitle}
                      placeholder="Jaga Nuenime Tetap Hidup"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Subjudul Banner</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formHeadlineSubtitle}
                    onChangeText={setFormHeadlineSubtitle}
                    placeholder="Setiap dukungan kamu sangat berarti untuk operasional server..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Deskripsi Kartu */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Kartu Saweria</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                    multiline
                    value={formSaweriaDescription}
                    onChangeText={setFormSaweriaDescription}
                    placeholder="Dukung Nuenime lewat Saweria untuk operasional server dan pembaruan anime harian..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Perks Editor */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Daftar Manfaat & Tujuan Dukungan (Perks)</Text>
                  <View style={styles.perksList}>
                    {formPerks.map((p, idx) => (
                      <View key={idx} style={styles.perkItemRow}>
                        <AppIcon name={p.icon || "heart"} size={14} color="#38BDF8" />
                        <Text style={styles.perkItemText}>{p.text}</Text>
                        <Pressable
                          onPress={() => handleRemovePerk(idx)}
                          style={styles.removePerkBtn}
                          hitSlop={6}
                        >
                          <AppIcon name="close" size={13} color="#F43F5E" />
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.addPerkRow, !isWide && styles.addPerkRowMobile]}>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        { flex: 1, minWidth: 160 },
                        !isWide && { flex: undefined, width: "100%", minWidth: 0 },
                      ]}
                      value={newPerkText}
                      onChangeText={setNewPerkText}
                      placeholder="Tambah poin manfaat baru..."
                      placeholderTextColor="#64748B"
                    />
                    <Pressable
                      style={[
                        styles.primaryActionBtnSilverMini,
                        !isWide && { width: "100%", justifyContent: "center", paddingVertical: 10 },
                      ]}
                      onPress={handleAddPerk}
                    >
                      <AppIcon name="plus" size={14} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnSilverMiniText}>Tambah Poin</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Footnote */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Catatan Kaki (Footnote)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formFootnote}
                    onChangeText={setFormFootnote}
                    placeholder="Dukungan bersifat sukarela tanpa paksaan..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Tombol Simpan Utama (Silver Liquid Glass) */}
                <Pressable
                  style={[styles.primaryActionBtnSilver, !isWide && styles.primaryActionBtnSilverMobile, isSavingConfig && { opacity: 0.6 }]}
                  onPress={handleSaveConfig}
                  disabled={isSavingConfig}
                >
                  {isSavingConfig ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnSilverText}>Simpan Pengaturan Saweria</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* KOLOM KANAN: LIVE PREVIEW DUKUNGAN (PERSIS MOCKUP AESTHETIC) */}
              <View
                style={[
                  styles.contentCard,
                  isWide ? styles.previewCardFlex : styles.previewCardFlexMobile,
                  !isWide && styles.contentCardMobile,
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="cellphone" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>Live Preview Tampilan Mobile</Text>
                    <Text style={styles.cardSubtitle}>
                      Pratinjau tampilan kartu donasi yang dilihat pengguna di aplikasi mobile.
                    </Text>
                  </View>
                </View>

                <View style={styles.mockPhone}>
                  {/* Phone Speaker & Dynamic Pill */}
                  <View style={styles.mockSpeakerBar}>
                    <View style={styles.mockSpeakerPill} />
                  </View>

                  {/* Hero image preview */}
                  <View style={styles.mockHero}>
                    {formHeroGifUrl ? (
                      <Image
                        source={{ uri: formHeroGifUrl }}
                        style={styles.mockHeroImg}
                      />
                    ) : (
                      <View style={styles.mockHeroFallback}>
                        <Text style={{ color: "#94A3B8", fontSize: 11, fontFamily: "Nunito-Regular" }}>
                          [GIF Hero Anime Banner]
                        </Text>
                      </View>
                    )}
                    <View style={styles.mockHeroOverlay} />
                    <View style={styles.mockHeroText}>
                      <Text style={styles.mockBadge}>{formHeadlineBadge || "NUENIME"}</Text>
                      <Text style={styles.mockTitle}>
                        {formHeadlineTitle || "Jaga Nuenime Tetap Hidup"}
                      </Text>
                      <Text style={styles.mockSub} numberOfLines={2}>
                        {formHeadlineSubtitle || "Dukungan kamu sangat berarti untuk kami..."}
                      </Text>
                    </View>
                  </View>

                  {/* Saweria card mock */}
                  <View style={styles.mockCard}>
                    <View style={styles.mockCardTop}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppIcon name="coffee" size={14} color="#F59E0B" />
                        <Text style={styles.mockSaweriaTitle}>{formSaweriaTitle || "Saweria"}</Text>
                      </View>
                      <View
                        style={[
                          styles.mockPill,
                          {
                            backgroundColor: formSaweriaActive
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(244, 63, 94, 0.15)",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: formSaweriaActive ? "#10B981" : "#F43F5E",
                            fontSize: 9.5,
                            fontFamily: "Nunito-Black",
                          }}
                        >
                          {formSaweriaActive ? "AKTIF" : "OFFLINE"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.mockDesc} numberOfLines={2}>
                      {formSaweriaDescription || "Dukung Nuenime lewat Saweria..."}
                    </Text>

                    <View style={styles.mockUrlBox}>
                      <AppIcon name="earth" size={12} color="#CBD5E1" />
                      <Text style={styles.mockUrlText} numberOfLines={1}>
                        {formSaweriaUrl || "saweria.co/Nuenime"}
                      </Text>
                    </View>

                    {/* Mock Silver Glass Button */}
                    <View style={styles.mockBtn}>
                      <AppIcon name="coffee" size={13} color="#FFFFFF" />
                      <Text style={styles.mockBtnText}>Dukung Sekarang</Text>
                    </View>
                  </View>

                  {/* Mock Perks List (Manfaat Donasi) */}
                  {formPerks && formPerks.length > 0 && (
                    <View style={styles.mockPerksCard}>
                      <Text style={styles.mockPerksHeader}>Dukungan kamu digunakan untuk:</Text>
                      <View style={styles.mockPerksList}>
                        {formPerks.map((p, idx) => (
                          <View key={idx} style={styles.mockPerkRow}>
                            <View style={styles.mockPerkDot}>
                              <AppIcon name={p.icon || "heart"} size={10} color="#38BDF8" />
                            </View>
                            <Text style={styles.mockPerkText} numberOfLines={1}>
                              {p.text}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Thank you gif mock */}
                  <View style={styles.mockThankYou}>
                    {formThankYouGifUrl ? (
                      <Image
                        source={{ uri: formThankYouGifUrl }}
                        style={{ width: "100%", height: 75 }}
                        resizeMode="contain"
                      />
                    ) : null}
                    <Text style={styles.mockThankYouText}>
                      Arigatou gozaimasu atas dukunganmu!
                    </Text>
                  </View>

                  {/* Mock Footnote */}
                  {formFootnote ? (
                    <View style={styles.mockFootnoteWrap}>
                      <Text style={styles.mockFootnoteText}>
                        {formFootnote}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {/* Bottom Breathing Spacer */}
          <View style={{ height: isWide ? 16 : 40 }} />
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: CS TICKETS (TIKET LAYANAN PENGGUNA)
         ══════════════════════════════════════════════════════ */}
      {activeTab === "tickets" && (
        <View style={styles.contentWrap}>
          {/* FILTER BAR PERSIS GAMIFICATION LEADERBOARD FILTER */}
          <View style={styles.filterCard}>
            <View style={[styles.searchRow, !isWide && styles.searchRowMobile]}>
              <View style={[styles.searchInputWrap, !isWide && styles.searchInputWrapMobile]}>
                <AppIcon name="magnify" size={16} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari ID tiket, username, atau kata kunci keluhan..."
                  placeholderTextColor="#64748B"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View style={[styles.tierChipsRow, !isWide && styles.tierChipsRowMobile]}>
                {[
                  { key: "all", label: "Semua Status" },
                  { key: "open", label: "Menunggu" },
                  { key: "in_progress", label: "Diproses" },
                  { key: "resolved", label: "Selesai" },
                ].map((st) => (
                  <Pressable
                    key={st.key}
                    style={[
                      styles.tierChip,
                      statusFilter === st.key && styles.tierChipActive,
                    ]}
                    onPress={() => {
                      hapticLight();
                      setStatusFilter(st.key);
                    }}
                  >
                    <Text
                      style={[
                        styles.tierChipText,
                        statusFilter === st.key && styles.tierChipTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* SPLIT VIEW KONTEN TIKET */}
          <View style={[styles.splitView, !isWide && styles.splitViewMobile]}>
            {/* KIRI: DAFTAR TIKET */}
            {(isWide || !selectedTicket) && (
              <View
                style={[
                  styles.contentCard,
                  isWide ? styles.leftPaneFlex : styles.leftPaneFlexMobile,
                  !isWide && styles.contentCardMobile,
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="inbox-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>Daftar Tiket Pengguna ({filteredTickets.length})</Text>
                    <Text style={styles.cardSubtitle}>
                      Pilih salah satu tiket untuk membaca detail dan membalas pengguna secara langsung.
                    </Text>
                  </View>
                </View>

                {isTicketsLoading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#38BDF8" />
                    <Text style={styles.loadingText}>Memuat tiket layanan...</Text>
                  </View>
                ) : filteredTickets.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="inbox-outline" size={40} color="#64748B" />
                    <Text style={styles.emptyTitle}>Tidak Ada Tiket Ditemukan</Text>
                    <Text style={styles.emptySubtitle}>
                      Tidak ada tiket kendala yang cocok dengan filter atau pencarian saat ini.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.ticketList} showsVerticalScrollIndicator={false}>
                    {filteredTickets.map((t) => {
                      const isSelected = selectedTicket?.id === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          style={[
                            styles.ticketCard,
                            isSelected && styles.ticketCardActive,
                          ]}
                          onPress={() => handleOpenTicket(t)}
                        >
                          <View style={styles.ticketTopRow}>
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>
                                {t.category.toUpperCase()}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.statusBadge,
                                t.status === "open" && styles.statusOpen,
                                t.status === "in_progress" && styles.statusInProgress,
                                t.status === "resolved" && styles.statusResolved,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  t.status === "open" && { color: "#F59E0B" },
                                  t.status === "in_progress" && { color: "#38BDF8" },
                                  t.status === "resolved" && { color: "#10B981" },
                                ]}
                              >
                                {t.status === "open" ? "MENUNGGU" : t.status === "in_progress" ? "DIPROSES" : "SELESAI"}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.ticketSubject} numberOfLines={1}>
                            {t.subject}
                          </Text>
                          <Text style={styles.ticketDesc} numberOfLines={2}>
                            {t.description}
                          </Text>

                          <View style={styles.ticketFooter}>
                            <Text style={styles.ticketUser}>@{t.username}</Text>
                            <Text style={styles.ticketTime}>
                              {new Date(t.createdAt).toLocaleDateString("id-ID")}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* KANAN: DETAIL PERCAKAPAN TIKET */}
            {(isWide || selectedTicket) && (
              <View
                style={[
                  styles.contentCard,
                  isWide ? styles.rightPaneFlex : styles.rightPaneFlexMobile,
                  !isWide && styles.contentCardMobile,
                ]}
              >
                {selectedTicket ? (
                  <View style={styles.ticketDetail}>
                    {!isWide && (
                      <Pressable
                        style={styles.backToTicketsBtnMobile}
                        onPress={() => setSelectedTicket(null)}
                      >
                        <AppIcon name="arrow-left" size={14} color="#CBD5E1" />
                        <Text style={styles.backToTicketsBtnText}>
                          Kembali ke Daftar Tiket
                        </Text>
                      </Pressable>
                    )}

                    <View style={[styles.detailHeader, !isWide && styles.detailHeaderMobile]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.detailId}>#{selectedTicket.id}</Text>
                        <Text style={styles.detailSubject}>
                          {selectedTicket.subject}
                        </Text>
                        <Text style={styles.detailMeta}>
                          Dari @{selectedTicket.username} · {selectedTicket.userEmail}
                        </Text>
                      </View>

                      {/* Status Action Buttons (Silver Liquid Glass with semantic accent) */}
                      <View style={[styles.statusActionRow, !isWide && styles.statusActionRowMobile]}>
                        <Pressable
                          style={[
                            styles.actionBtnGlass,
                            !isWide && styles.actionBtnGlassMobile,
                            selectedTicket.status === "open" && styles.btnOpenGlassActive,
                          ]}
                          onPress={() => handleStatusChange("open")}
                        >
                          <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                          <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>Buka</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.actionBtnGlass,
                            !isWide && styles.actionBtnGlassMobile,
                            selectedTicket.status === "in_progress" && styles.btnProgressGlassActive,
                          ]}
                          onPress={() => handleStatusChange("in_progress")}
                        >
                          <View style={[styles.dot, { backgroundColor: "#38BDF8" }]} />
                          <Text style={[styles.actionBtnText, { color: "#38BDF8" }]}>Proses</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.actionBtnGlass,
                            !isWide && styles.actionBtnGlassMobile,
                            selectedTicket.status === "resolved" && styles.btnResolveGlassActive,
                          ]}
                          onPress={() => handleStatusChange("resolved")}
                        >
                          <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                          <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Selesai</Text>
                        </Pressable>
                      </View>
                    </View>

                    <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
                      <View style={styles.initialMsg}>
                        <Text style={styles.initialLabel}>KELUHAN AWAL PENGGUNA:</Text>
                        <Text style={styles.initialText}>
                          {selectedTicket.description}
                        </Text>
                      </View>

                      {messages.map((m) => (
                        <View
                          key={m.id}
                          style={[
                            styles.messageBubble,
                            m.isAdmin
                              ? styles.msgAdmin
                              : styles.msgUser,
                          ]}
                        >
                          <View style={styles.msgHeader}>
                            <Text style={styles.msgSender}>{m.senderName}</Text>
                            <Text style={styles.msgTime}>
                              {new Date(m.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>
                          <Text style={styles.msgBody}>{m.message}</Text>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Reply Box (Silver Liquid Glass Border) */}
                    <View style={[styles.replyBox, !isWide && styles.replyBoxMobile]}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Ketik balasan CS ke pengguna..."
                        placeholderTextColor="#64748B"
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                      />
                      <Pressable
                        style={[
                          styles.primaryActionBtnSilverMini,
                          !isWide && { width: "100%", justifyContent: "center", paddingVertical: 10 },
                          isSendingReply && { opacity: 0.6 },
                        ]}
                        onPress={handleSendReply}
                        disabled={isSendingReply}
                      >
                        {isSendingReply ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <AppIcon name="send" size={14} color="#FFFFFF" />
                            <Text style={styles.primaryActionBtnSilverMiniText}>Kirim Balasan</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <AppIcon name="inbox-outline" size={44} color="#64748B" />
                    <Text style={styles.emptyTitle}>Pilih Tiket Layanan</Text>
                    <Text style={styles.emptySubtitle}>
                      Pilih salah satu tiket di kolom kiri untuk melihat riwayat percakapan dan membalas keluhan pengguna.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Bottom Breathing Spacer */}
          <View style={{ height: isWide ? 16 : 40 }} />
        </View>
      )}
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  // ── Top KPI Strip (Persis Admin Gamification Theme)
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 16,
  },
  kpiStripMobile: {
    flexWrap: "wrap",
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
    flexBasis: "47%",
    minWidth: 130,
    gap: 8,
  },
  kpiStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiStripLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  kpiStripVal: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Info Banner (Persis Admin Gamification Theme)
  infoBanner: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 14,
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
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  infoBannerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },

  // ── Tab Navigation (Chip Style Silver Liquid Glass)
  tabNavWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabNavWrapMobile: {
    gap: 6,
    marginBottom: 12,
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
  tabBtnMobile: {
    flexGrow: 1,
    minWidth: "46%",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ── Floating Action Toast (Persis Gamification Theme)
  floatingToast: {
    position: "absolute",
    top: 14,
    right: 20,
    maxWidth: "92%",
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
  floatingToastMobile: {
    left: 14,
    right: 14,
    maxWidth: "100%",
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
  contentWrap: {
    gap: 16,
  },

  // ── Generic Content Card (Persis Gamification & Gacha Theme)
  contentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 16,
  },
  contentCardMobile: {
    padding: 14,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  cardHeaderRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  cardHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  cardHeaderTitleRowMobile: {
    width: "100%",
    minWidth: 0,
  },
  cardHeaderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  cardHeaderBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeaderBtnsMobile: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },

  // ── Form Inputs (Silver Liquid Glass Border)
  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  twoColumnsLayout: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  twoColumnsLayoutMobile: {
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  formCardFlex: {
    flex: 1.3,
    minWidth: 320,
  },
  formCardFlexMobile: {
    width: "100%",
    minWidth: 0,
  },
  previewCardFlex: {
    flex: 1,
    minWidth: 280,
  },
  previewCardFlexMobile: {
    width: "100%",
    minWidth: 0,
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 14,
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    width: "100%",
  },

  // ── Toggle Switch Row (Persis Gamification / System)
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  toggleRowMobile: {
    padding: 12,
    gap: 10,
  },
  toggleTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  toggleDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Perks List
  perksList: {
    gap: 8,
    marginTop: 2,
  },
  perkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  perkItemText: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  removePerkBtn: {
    padding: 4,
  },
  addPerkRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  addPerkRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },

  // ── Preview Column (Phone Mockup)
  mockPhone: {
    backgroundColor: "#080B10",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    gap: 10,
    overflow: "hidden",
  },
  mockSpeakerBar: {
    alignItems: "center",
    paddingBottom: 2,
  },
  mockSpeakerPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  mockHero: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  mockHeroImg: {
    width: "100%",
    height: "100%",
  },
  mockHeroFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111622",
    alignItems: "center",
    justifyContent: "center",
  },
  mockHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9, 13, 20, 0.58)",
  },
  mockHeroText: {
    position: "absolute",
    bottom: 8,
    left: 10,
    right: 10,
    gap: 2,
  },
  mockBadge: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  mockTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  mockSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.8)",
  },
  mockCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    gap: 8,
  },
  mockCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mockSaweriaTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  mockPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  mockDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },
  mockUrlBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mockUrlText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#CBD5E1",
    flex: 1,
  },
  mockBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mockBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  mockPerksCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 10,
    gap: 6,
  },
  mockPerksHeader: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
    letterSpacing: 0.2,
  },
  mockPerksList: {
    gap: 4,
  },
  mockPerkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mockPerkDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  mockPerkText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#E2E8F0",
    flex: 1,
  },
  mockThankYou: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  mockThankYouText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#CBD5E1",
  },
  mockFootnoteWrap: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
  },
  mockFootnoteText: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 13,
  },

  // ── Filter Card & Search Row (Persis Gamification Filter)
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  searchRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 260,
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
    minWidth: 0,
    width: "100%",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  tierChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tierChipsRowMobile: {
    width: "100%",
  },
  tierChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tierChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  tierChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  tierChipTextActive: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
  },

  // ── Split View Tickets
  splitView: {
    flexDirection: "row",
    gap: 16,
    minHeight: 520,
    alignItems: "flex-start",
  },
  splitViewMobile: {
    flexDirection: "column",
    minHeight: undefined,
    gap: 16,
  },
  leftPaneFlex: {
    flex: 2,
    minWidth: 280,
  },
  leftPaneFlexMobile: {
    width: "100%",
    minWidth: 0,
  },
  rightPaneFlex: {
    flex: 3,
    minWidth: 320,
  },
  rightPaneFlexMobile: {
    width: "100%",
    minWidth: 0,
  },
  ticketList: {
    maxHeight: 520,
  },
  ticketCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  ticketCardActive: {
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderColor: "rgba(56, 189, 248, 0.30)",
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#CBD5E1",
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusOpen: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusInProgress: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  statusResolved: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
  },
  ticketSubject: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  ticketDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    lineHeight: 16,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  ticketUser: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  ticketTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  // ── Ticket Detail View
  ticketDetail: {
    flex: 1,
    gap: 12,
  },
  backToTicketsBtnMobile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignSelf: "flex-start",
  },
  backToTicketsBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingBottom: 10,
    flexWrap: "wrap",
    gap: 10,
  },
  detailHeaderMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  detailId: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  detailSubject: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  detailMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 1,
  },

  // ── Status Action Buttons (Silver Liquid Glass with semantic accent)
  statusActionRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  statusActionRowMobile: {
    width: "100%",
  },
  actionBtnGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  actionBtnGlassMobile: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  btnOpenGlassActive: {
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(245, 158, 11, 0.14)",
  },
  btnProgressGlassActive: {
    borderColor: "rgba(56, 189, 248, 0.35)",
    backgroundColor: "rgba(56, 189, 248, 0.14)",
  },
  btnResolveGlassActive: {
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(16, 185, 129, 0.14)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },

  messagesList: {
    maxHeight: 320,
  },
  initialMsg: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 10,
    gap: 4,
  },
  initialLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  initialText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: "85%",
  },
  msgAdmin: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(56, 189, 248, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  msgUser: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  msgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
    gap: 12,
  },
  msgSender: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  msgTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  msgBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#F8FAFC",
    lineHeight: 17,
  },

  // ── Reply Box
  replyBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 8,
    alignItems: "flex-end",
  },
  replyBoxMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  replyInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    maxHeight: 80,
    minHeight: 36,
    padding: 0,
  },

  // ── Empty State Card
  emptyCard: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 320,
  },

  // ── SILVER LIQUID GLASS BUTTONS (PERSIS GAMIFICATION THEME)
  primaryActionBtnSilver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnSilverMobile: {
    width: "100%",
    paddingVertical: 13,
    justifyContent: "center",
  },
  primaryActionBtnSilverText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
    flexShrink: 1,
  },
  primaryActionBtnSilverMini: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  primaryActionBtnSilverMiniMobile: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  primaryActionBtnSilverMiniText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  silverLiquidSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 7,
  },
  silverLiquidSecondaryBtnMobile: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  silverLiquidSecondaryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  dangerLiquidBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dangerLiquidBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
  },
});
