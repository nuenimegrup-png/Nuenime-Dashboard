import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import {
  type DeveloperMember,
  type SocialLink,
  getDevelopers,
  saveDevelopers,
  addDeveloper,
  updateDeveloper,
  deleteDeveloper,
  resetDevelopersToDefault,
} from "@/lib/developer-service";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

const COLOR_PRESETS = [
  { label: "Silver", color: "#E2E8F0", bg: "rgba(226, 232, 240, 0.12)", border: "rgba(226, 232, 240, 0.3)" },
  { label: "Sky Blue", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  { label: "Cyan", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.15)", border: "rgba(6, 182, 212, 0.4)" },
  { label: "Gold", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  { label: "Emerald", color: "#10B981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  { label: "Rose", color: "#F43F5E", bg: "rgba(244, 63, 94, 0.15)", border: "rgba(244, 63, 94, 0.4)" },
];

export default function AdminDevelopersScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const [developers, setDevelopers] = useState<DeveloperMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Floating Action Toast (Persis Gamification Theme)
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast(null);
    }, 3200);
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDev, setEditingDev] = useState<DeveloperMember | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formTag, setFormTag] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formAvatarUri, setFormAvatarUri] = useState("");
  const [formColorIndex, setFormColorIndex] = useState(0);
  const [formFacebook, setFormFacebook] = useState("");
  const [formInstagram, setFormInstagram] = useState("");
  const [formWebsite, setFormWebsite] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getDevelopers();
      setDevelopers(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    hapticLight();
    setEditingDev(null);
    setFormName("");
    setFormTag("");
    setFormRole("");
    setFormAvatarUri("");
    setFormColorIndex(0);
    setFormFacebook("");
    setFormInstagram("");
    setFormWebsite("");
    setIsModalOpen(true);
  };

  const openEditModal = (dev: DeveloperMember) => {
    hapticLight();
    setEditingDev(dev);
    setFormName(dev.name);
    setFormTag(dev.tag);
    setFormRole(dev.role);
    setFormAvatarUri(dev.avatarUri || "");

    const cIdx = COLOR_PRESETS.findIndex((p) => p.color.toLowerCase() === dev.accentColor.toLowerCase());
    setFormColorIndex(cIdx >= 0 ? cIdx : 0);

    const fb = dev.social.find((s) => s.icon === "facebook")?.url || "";
    const ig = dev.social.find((s) => s.icon === "instagram")?.url || "";
    const web = dev.social.find((s) => s.icon === "web")?.url || "";

    setFormFacebook(fb);
    setFormInstagram(ig);
    setFormWebsite(web);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      hapticWarning();
      showToast("Nama developer tidak boleh kosong!", "error");
      return;
    }

    setIsSaving(true);
    hapticLight();

    const preset = COLOR_PRESETS[formColorIndex] || COLOR_PRESETS[0];

    const social: SocialLink[] = [
      { icon: "facebook", label: "Facebook", url: formFacebook.trim() },
      { icon: "instagram", label: "Instagram", url: formInstagram.trim() },
      { icon: "web", label: "Website", url: formWebsite.trim() },
    ];

    try {
      if (editingDev) {
        // Update
        await updateDeveloper(editingDev.id, {
          name: formName.trim(),
          tag: formTag.trim(),
          role: formRole.trim(),
          avatarUri: formAvatarUri.trim() || undefined,
          accentColor: preset.color,
          badgeBg: preset.bg,
          badgeBorder: preset.border,
          social,
        });
        hapticSuccess();
        showToast(`Data developer "${formName.trim()}" berhasil diperbarui!`, "success");
      } else {
        // Create
        await addDeveloper({
          name: formName.trim(),
          tag: formTag.trim(),
          role: formRole.trim(),
          avatarUri: formAvatarUri.trim() || undefined,
          accentColor: preset.color,
          badgeBg: preset.bg,
          badgeBorder: preset.border,
          social,
        });
        hapticSuccess();
        showToast(`Developer baru "${formName.trim()}" berhasil ditambahkan!`, "success");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan data developer.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (dev: DeveloperMember) => {
    hapticWarning();
    Alert.alert(
      "Hapus Developer",
      `Apakah Anda yakin ingin menghapus developer "${dev.name}" dari daftar tim?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDeveloper(dev.id);
              hapticSuccess();
              showToast(`Developer "${dev.name}" telah dihapus.`, "success");
              await loadData();
            } catch (err: any) {
              hapticWarning();
              showToast(err?.message || "Gagal menghapus developer.", "error");
            }
          },
        },
      ]
    );
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === developers.length - 1)
    ) {
      return;
    }

    hapticLight();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...developers];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setDevelopers(reordered);
    await saveDevelopers(reordered);
    showToast("Urutan tim developer berhasil diperbarui!", "success");
  };

  const handleResetToDefault = () => {
    hapticWarning();
    Alert.alert(
      "Reset Konfigurasi",
      "Reset daftar developer ke konfigurasi default (Valora & Nueva)?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset Default",
          style: "destructive",
          onPress: async () => {
            try {
              const list = await resetDevelopersToDefault();
              setDevelopers(list);
              hapticSuccess();
              showToast("Daftar developer telah direset ke default.", "success");
            } catch (err: any) {
              hapticWarning();
              showToast(err?.message || "Gagal mereset.", "error");
            }
          },
        },
      ]
    );
  };

  const statsWithPhotos = useMemo(() => {
    return developers.filter((d) => Boolean(d.avatarUri)).length;
  }, [developers]);

  const statsSocialActive = useMemo(() => {
    return developers.reduce(
      (acc, cur) => acc + cur.social.filter((s) => Boolean(s.url)).length,
      0
    );
  }, [developers]);

  return (
    <AdminLayout
      title="Manajemen Tim Developer"
      subtitle="Kelola profil perancang, pendiri, peran jabatan, tautan media sosial, serta urutan tampilan di aplikasi mobile"
      mobileTitle="Developer"
      mobileSubtitle="Tim & Profil"
      activeKey="developers"
    >
      {/* ─── TOP KPI STRIP (PERSIS ADMIN GAMIFICATION THEME) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="account-group" size={18} color="#38BDF8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Total Developer</Text>
            <Text style={styles.kpiStripVal} numberOfLines={1}>{developers.length} Anggota</Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="camera-account" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Profil Berfoto</Text>
            <Text style={[styles.kpiStripVal, { color: "#10B981" }]} numberOfLines={1}>
              {statsWithPhotos} Terpasang
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="share-variant" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Sosial Terhubung</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]} numberOfLines={1}>
              {statsSocialActive} Tautan Aktif
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
            <AppIcon name="sort-ascending" size={18} color="#CBD5E1" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Urutan Tampilan</Text>
            <Text style={[styles.kpiStripVal, { color: "#FFFFFF" }]} numberOfLines={1}>
              Prioritas #1
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
            <Text style={styles.infoBannerTitle}>Pusat Kontrol Profil Tim Pengembang Aplikasi Nuenime</Text>
            <Text style={styles.infoBannerText}>
              Setiap anggota yang terdaftar di bawah ini akan ditampilkan secara eksklusif pada menu Pengaturan &gt; Tim Developer di aplikasi mobile.
              Gunakan tombol panah (#1, #2, ...) untuk menyesuaikan urutan tampilan secara instan.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── FLOATING ACTION TOAST (PERSIS GAMIFICATION THEME) ─── */}
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

      {/* ─── MAIN CONTENT CARD (OBSIDIAN DARK GLASS) ─── */}
      <View style={styles.contentWrap}>
        <View style={[styles.contentCard, !isWide && styles.contentCardMobile]}>
          <View style={[styles.cardHeaderRow, !isWide && styles.cardHeaderRowMobile]}>
            <View style={[styles.cardHeaderTitleRow, !isWide && styles.cardHeaderTitleRowMobile]}>
              <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="account-tie" size={18} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle}>Daftar Anggota Tim Developer ({developers.length})</Text>
                <Text style={styles.cardSubtitle}>
                  Urutan kartu di bawah ini menentukan posisi kartu profil di halaman Tentang & Developer aplikasi mobile.
                </Text>
              </View>
            </View>

            <View style={[styles.cardHeaderBtns, !isWide && styles.cardHeaderBtnsMobile]}>
              <Pressable
                style={[styles.silverLiquidSecondaryBtn, !isWide && styles.silverLiquidSecondaryBtnMobile]}
                onPress={handleResetToDefault}
              >
                <AppIcon name="refresh" size={13} color="#CBD5E1" />
                <Text style={styles.silverLiquidSecondaryBtnText}>Reset Default</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryActionBtnSilverMini, !isWide && styles.primaryActionBtnSilverMiniMobile]}
                onPress={openCreateModal}
              >
                <AppIcon name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnSilverMiniText}>Tambah Developer</Text>
              </Pressable>
            </View>
          </View>

          {/* DEVELOPER LIST */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingText}>Memuat data tim developer...</Text>
            </View>
          ) : developers.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppIcon name="account-off-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>Belum Ada Anggota Developer</Text>
              <Text style={styles.emptySubtitle}>
                Klik tombol "Tambah Developer" di atas untuk menambahkan profil perancang atau pengembang pertama.
              </Text>
            </View>
          ) : (
            <View style={styles.devList}>
              {developers.map((dev, idx) => (
                isWide ? (
                  // ─── DESKTOP CARD LAYOUT (IDENTIK & SEMPURNA DENGAN GAMIFICATION THEME) ───
                  <View key={dev.id} style={styles.devCard}>
                    {/* Order & Avatar */}
                    <View style={styles.cardLeft}>
                      <View style={styles.orderControls}>
                        <Pressable
                          onPress={() => handleMoveOrder(idx, "up")}
                          disabled={idx === 0}
                          style={[styles.orderBtn, idx === 0 && { opacity: 0.25 }]}
                        >
                          <AppIcon name="chevron-up" size={16} color="#CBD5E1" />
                        </Pressable>
                        <Text style={styles.orderNum}>#{idx + 1}</Text>
                        <Pressable
                          onPress={() => handleMoveOrder(idx, "down")}
                          disabled={idx === developers.length - 1}
                          style={[
                            styles.orderBtn,
                            idx === developers.length - 1 && { opacity: 0.25 },
                          ]}
                        >
                          <AppIcon name="chevron-down" size={16} color="#CBD5E1" />
                        </Pressable>
                      </View>

                      <View style={[styles.avatarWrap, { borderColor: dev.accentColor }]}>
                        {dev.avatarUri ? (
                          <Image source={{ uri: dev.avatarUri }} style={styles.avatarImg} />
                        ) : (
                          <Text style={[styles.avatarInitial, { color: dev.accentColor }]}>
                            {dev.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Details */}
                    <View style={styles.cardCenter}>
                      <View style={styles.titleRow}>
                        <Text style={styles.devName}>{dev.name}</Text>
                        {dev.tag ? (
                          <View
                            style={[
                              styles.tagPill,
                              {
                                backgroundColor: dev.badgeBg || "rgba(255,255,255,0.08)",
                                borderColor: dev.badgeBorder || "rgba(255,255,255,0.2)",
                              },
                            ]}
                          >
                            <Text style={[styles.tagText, { color: dev.accentColor }]}>
                              {dev.tag}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.devRole}>{dev.role || "Anggota Tim"}</Text>

                      {/* Social links row */}
                      <View style={styles.socialRow}>
                        {dev.social.map((s) => (
                          <View
                            key={s.label}
                            style={[
                              styles.socialPill,
                              s.url ? styles.socialPillActive : styles.socialPillInactive,
                            ]}
                          >
                            <AppIcon
                              name={s.icon}
                              size={13}
                              color={s.url ? dev.accentColor : "#64748B"}
                            />
                            <Text
                              style={[
                                styles.socialPillText,
                                { color: s.url ? "#E2E8F0" : "#64748B" },
                              ]}
                            >
                              {s.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Actions (Silver Liquid Glass Buttons) */}
                    <View style={styles.cardRight}>
                      <Pressable
                        style={styles.silverLiquidSecondaryBtn}
                        onPress={() => openEditModal(dev)}
                      >
                        <AppIcon name="pencil" size={13} color="#CBD5E1" />
                        <Text style={styles.silverLiquidSecondaryBtnText}>Edit</Text>
                      </Pressable>

                      <Pressable
                        style={styles.dangerLiquidBtn}
                        onPress={() => handleDelete(dev)}
                      >
                        <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                        <Text style={styles.dangerLiquidBtnText}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  // ─── MOBILE CARD LAYOUT (PRESISI, TIDAK OVERFLOW, TOUCH-FRIENDLY) ───
                  <View key={dev.id} style={styles.devCardMobile}>
                    {/* Top: Order, Avatar, Name & Tag */}
                    <View style={styles.mobileCardTopRow}>
                      <View style={styles.orderControlsMobile}>
                        <Pressable
                          onPress={() => handleMoveOrder(idx, "up")}
                          disabled={idx === 0}
                          style={[styles.orderBtnMobile, idx === 0 && { opacity: 0.25 }]}
                        >
                          <AppIcon name="chevron-up" size={15} color="#CBD5E1" />
                        </Pressable>
                        <Text style={styles.orderNumMobile}>#{idx + 1}</Text>
                        <Pressable
                          onPress={() => handleMoveOrder(idx, "down")}
                          disabled={idx === developers.length - 1}
                          style={[
                            styles.orderBtnMobile,
                            idx === developers.length - 1 && { opacity: 0.25 },
                          ]}
                        >
                          <AppIcon name="chevron-down" size={15} color="#CBD5E1" />
                        </Pressable>
                      </View>

                      <View style={[styles.avatarWrapMobile, { borderColor: dev.accentColor }]}>
                        {dev.avatarUri ? (
                          <Image source={{ uri: dev.avatarUri }} style={styles.avatarImg} />
                        ) : (
                          <Text style={[styles.avatarInitialMobile, { color: dev.accentColor }]}>
                            {dev.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.mobileCardTitleWrap}>
                        <Text style={styles.devNameMobile} numberOfLines={1}>
                          {dev.name}
                        </Text>
                        {dev.tag ? (
                          <View
                            style={[
                              styles.tagPillMobile,
                              {
                                backgroundColor: dev.badgeBg || "rgba(255,255,255,0.08)",
                                borderColor: dev.badgeBorder || "rgba(255,255,255,0.2)",
                              },
                            ]}
                          >
                            <Text
                              style={[styles.tagTextMobile, { color: dev.accentColor }]}
                              numberOfLines={1}
                            >
                              {dev.tag}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Role text */}
                    <Text style={styles.devRoleMobile} numberOfLines={2}>
                      {dev.role || "Anggota Tim"}
                    </Text>

                    {/* Social links row */}
                    <View style={styles.socialRowMobile}>
                      {dev.social.map((s) => (
                        <View
                          key={s.label}
                          style={[
                            styles.socialPillMobile,
                            s.url ? styles.socialPillActive : styles.socialPillInactive,
                          ]}
                        >
                          <AppIcon
                            name={s.icon}
                            size={12}
                            color={s.url ? dev.accentColor : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.socialPillTextMobile,
                              { color: s.url ? "#E2E8F0" : "#64748B" },
                            ]}
                            numberOfLines={1}
                          >
                            {s.label}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Action Buttons Row */}
                    <View style={styles.mobileActionRow}>
                      <Pressable
                        style={[styles.silverLiquidSecondaryBtn, { flex: 1, justifyContent: "center" }]}
                        onPress={() => openEditModal(dev)}
                      >
                        <AppIcon name="pencil" size={13} color="#CBD5E1" />
                        <Text style={styles.silverLiquidSecondaryBtnText}>Edit Profil</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.dangerLiquidBtn, { paddingHorizontal: 14, justifyContent: "center" }]}
                        onPress={() => handleDelete(dev)}
                      >
                        <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                        <Text style={styles.dangerLiquidBtnText}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ─── MODAL FORM (OBSIDIAN LIQUID GLASS POPUP) ─── */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, !isWide && styles.modalContainerMobile]}>
            <View style={[styles.modalHeader, !isWide && styles.modalHeaderMobile]}>
              <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {editingDev ? "Edit Data Developer" : "Tambah Developer Baru"}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  Data akan langsung tersinkron ke halaman Pengaturan aplikasi mobile.
                </Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setIsModalOpen(false)}
                hitSlop={8}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalForm}
              showsVerticalScrollIndicator={false}
            >
              {/* Nama */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Nama Developer <Text style={{ color: "#F43F5E" }}>*</Text>
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Contoh: Valora / Nueva / Kazuto"
                  placeholderTextColor="#64748B"
                />
              </View>

              {/* Tag / Grup */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Tag / Afiliasi Grup</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formTag}
                  onChangeText={setFormTag}
                  placeholder="Contoh: Founder Valora Official Grup"
                  placeholderTextColor="#64748B"
                />
              </View>

              {/* Jabatan / Peran */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Jabatan / Peran di Nuenime</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 72, textAlignVertical: "top" }]}
                  multiline
                  value={formRole}
                  onChangeText={setFormRole}
                  placeholder="Contoh: Perancang Nuenime, Desain UI/UX, Backend & Frontend"
                  placeholderTextColor="#64748B"
                />
              </View>

              {/* Avatar URL */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>URL Foto Profil / Avatar</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formAvatarUri}
                  onChangeText={setFormAvatarUri}
                  placeholder="https://i.ibb.co.com/... atau link gambar langsung"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              {/* Color Preset */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Warna Aksen Profil</Text>
                <View style={styles.presetRow}>
                  {COLOR_PRESETS.map((p, idx) => (
                    <Pressable
                      key={p.label}
                      onPress={() => {
                        hapticLight();
                        setFormColorIndex(idx);
                      }}
                      style={[
                        styles.presetPill,
                        formColorIndex === idx && {
                          borderColor: p.color,
                          backgroundColor: p.bg,
                        },
                      ]}
                    >
                      <View style={[styles.presetDot, { backgroundColor: p.color }]} />
                      <Text style={[styles.presetText, { color: p.color }]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Media Sosial */}
              <Text style={styles.sectionHeading}>Tautan Media Sosial (Opsional)</Text>

              <View style={styles.formGroup}>
                <View style={styles.socialLabelRow}>
                  <AppIcon name="facebook" size={14} color="#38BDF8" />
                  <Text style={styles.fieldLabel}>Facebook Profile / Page</Text>
                </View>
                <TextInput
                  style={styles.fieldInput}
                  value={formFacebook}
                  onChangeText={setFormFacebook}
                  placeholder="https://facebook.com/..."
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.socialLabelRow}>
                  <AppIcon name="instagram" size={14} color="#F43F5E" />
                  <Text style={styles.fieldLabel}>Instagram</Text>
                </View>
                <TextInput
                  style={styles.fieldInput}
                  value={formInstagram}
                  onChangeText={setFormInstagram}
                  placeholder="https://instagram.com/..."
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.socialLabelRow}>
                  <AppIcon name="web" size={14} color="#10B981" />
                  <Text style={styles.fieldLabel}>Website Pribadi</Text>
                </View>
                <TextInput
                  style={styles.fieldInput}
                  value={formWebsite}
                  onChangeText={setFormWebsite}
                  placeholder="https://example.com"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              {/* Live Preview Card */}
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>PREVIEW TAMPILAN KARTU APLIKASI</Text>
                <View
                  style={[
                    styles.previewCard,
                    {
                      borderColor:
                        COLOR_PRESETS[formColorIndex]?.border ||
                        "rgba(255,255,255,0.18)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.previewAvatar,
                      {
                        borderColor:
                          COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                      },
                    ]}
                  >
                    {formAvatarUri ? (
                      <Image
                        source={{ uri: formAvatarUri }}
                        style={{ width: "100%", height: "100%", borderRadius: 30 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color:
                            COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                          fontFamily: "Nunito-Bold",
                          fontSize: 18,
                        }}
                      >
                        {(formName || "D").charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text style={styles.previewName} numberOfLines={1}>
                      {formName || "Nama Developer"}
                    </Text>
                    <Text
                      style={[
                        styles.previewTag,
                        {
                          color:
                            COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {formTag || "Founder / Designer"}
                    </Text>
                    <Text style={styles.previewRole} numberOfLines={2}>
                      {formRole || "Perancang sistem Nuenime"}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, !isWide && styles.modalFooterMobile]}>
              <Pressable
                style={[styles.silverLiquidSecondaryBtn, !isWide && { flex: 1, justifyContent: "center" }]}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.silverLiquidSecondaryBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryActionBtnSilver, !isWide && { flex: 1.3, justifyContent: "center" }, isSaving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="check" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnSilverText}>Simpan Developer</Text>
                  </>
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
    minWidth: "46%",
    flex: 1,
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

  // ── Generic Content Card (Persis Gamification Theme)
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
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    width: "100%",
  },

  // ── Developer List & Cards
  devList: {
    gap: 10,
  },
  devCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderControls: {
    alignItems: "center",
    gap: 2,
  },
  orderBtn: {
    padding: 4,
  },
  orderNum: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#64748B",
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
  },
  cardCenter: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  devName: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  devRole: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    lineHeight: 16,
  },
  socialRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  socialPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  socialPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  socialPillInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: "rgba(255, 255, 255, 0.04)",
    opacity: 0.5,
  },
  socialPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ── Mobile Card Layout
  devCardMobile: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 12,
    gap: 10,
  },
  mobileCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orderControlsMobile: {
    alignItems: "center",
    gap: 2,
  },
  orderBtnMobile: {
    padding: 3,
  },
  orderNumMobile: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#64748B",
  },
  avatarWrapMobile: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  avatarInitialMobile: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
  },
  mobileCardTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  devNameMobile: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  tagPillMobile: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagTextMobile: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
  },
  devRoleMobile: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    lineHeight: 16,
  },
  socialRowMobile: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  socialPillMobile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  socialPillTextMobile: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  mobileActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },

  // ── Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "90%",
    backgroundColor: "#0D1117",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  modalContainerMobile: {
    maxWidth: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalHeaderMobile: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 460,
  },
  modalForm: {
    padding: 18,
    gap: 12,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  presetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  presetDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  presetText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  sectionHeading: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  socialLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  previewTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.8,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  previewName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  previewTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  previewRole: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  modalFooterMobile: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // ── Empty State Card
  emptyCard: {
    padding: 40,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
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
    paddingHorizontal: 9,
    paddingVertical: 7,
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
