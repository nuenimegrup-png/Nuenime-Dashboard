import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type LelangItem,
  type LelangWinnerRecord,
  type LelangItemType,
  type LelangRarity,
  type BorderCandidate,
  type BannerCandidate,
  getAdminLelangItems,
  createAdminLelangItem,
  updateAdminLelangItem,
  deleteAdminLelangItem,
  getAdminLelangWinners,
  markWinnerClaimStatus,
  getBorderCandidates,
  getBannerCandidates,
} from "@/lib/admin-lelang-service";

type ActiveTab = "items" | "winners";
type StatusFilter = "all" | "active" | "ended" | "scheduled";

export default function AdminLelangScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("items");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [items, setItems] = useState<LelangItem[]>([]);
  const [winners, setWinners] = useState<LelangWinnerRecord[]>([]);

  // Opsi Border dari /admin/borders & Banner dari /admin/gacha
  const [borderList, setBorderList] = useState<BorderCandidate[]>([]);
  const [bannerList, setBannerList] = useState<BannerCandidate[]>([]);

  // Modal Add / Edit Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LelangItem | null>(null);

  const [formSourceId, setFormSourceId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<LelangItemType>("border");
  const [formRarity, setFormRarity] = useState<LelangRarity>("Mythic Limited");
  const [formStartPrice, setFormStartPrice] = useState("1000");
  const [formMinInc, setFormMinInc] = useState("100");
  const [formDuration, setFormDuration] = useState("4");
  const [formDesc, setFormDesc] = useState("");
  const [formAccent, setFormAccent] = useState("#A855F7");
  const [formStatus, setFormStatus] = useState<"active" | "scheduled" | "ended">("active");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Load Data Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itList, winList, bList, bnList] = await Promise.all([
        getAdminLelangItems(),
        getAdminLelangWinners(),
        getBorderCandidates(),
        getBannerCandidates(),
      ]);
      setItems(itList);
      setWinners(winList);
      setBorderList(bList);
      setBannerList(bnList);
    } catch {
      Alert.alert("Error", "Gagal memuat data lelang dari Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchSearch =
        it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.rarity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.highestBidderName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || it.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Metrics
  const stats = useMemo(() => {
    const totalActive = items.filter((i) => i.status === "active").length;
    const totalEnded = items.filter((i) => i.status === "ended").length;
    const totalVolume = items.reduce((acc, i) => acc + (i.currentBid || 0), 0);
    const unclaimedWinners = winners.filter((w) => !w.isClaimed).length;
    return { totalActive, totalEnded, totalVolume, unclaimedWinners };
  }, [items, winners]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormType("border");
    if (borderList.length > 0) {
      const first = borderList[0];
      setFormSourceId(first.id);
      setFormTitle(first.name);
      setFormDesc(first.description || "Border avatar eksklusif lelang Nuenime.");
      setFormImageUrl(first.assetUrl || "");
    } else {
      setFormSourceId("");
      setFormTitle("");
      setFormDesc("");
      setFormImageUrl("");
    }
    setFormRarity("Mythic Limited");
    setFormStartPrice("1000");
    setFormMinInc("100");
    setFormDuration("4");
    setFormAccent("#A855F7");
    setFormStatus("active");
    setShowItemModal(true);
  };

  const handleSelectBorderCandidate = (border: BorderCandidate) => {
    setFormSourceId(border.id);
    setFormTitle(border.name);
    setFormDesc(border.description || `Border avatar ${border.name} dari katalog resmi.`);
    setFormImageUrl(border.assetUrl || "");
  };

  const handleSelectBannerCandidate = (banner: BannerCandidate) => {
    setFormSourceId(banner.id);
    setFormTitle(banner.name);
    setFormDesc(`Banner profil ${banner.name} dari katalog gacha.`);
    setFormImageUrl(banner.image || "");
    if (banner.color) setFormAccent(banner.color);
  };

  const openEditModal = (item: LelangItem) => {
    setEditingItem(item);
    setFormSourceId(item.sourceId);
    setFormTitle(item.title);
    setFormType(item.type);
    setFormRarity(item.rarity);
    setFormStartPrice(String(item.startPrice));
    setFormMinInc(String(item.minIncrement || 100));
    setFormDuration(String(item.durationHours || 4));
    setFormDesc(item.description);
    setFormAccent(item.accentColor || "#EF4444");
    setFormImageUrl(item.imageUrl || "");
    setFormStatus(item.status === "cancelled" ? "ended" : item.status);
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!formSourceId) {
      Alert.alert("Validasi", `Pilih salah satu ${formType === "border" ? "Border" : "Banner"} dari katalog yang tersedia.`);
      return;
    }
    if (!formTitle.trim()) {
      Alert.alert("Validasi", "Judul item lelang wajib diisi.");
      return;
    }
    const startPriceNum = parseInt(formStartPrice, 10) || 500;
    const minIncNum = parseInt(formMinInc, 10) || 100;
    const durNum = parseInt(formDuration, 10) || 4;

    setSaving(true);
    try {
      if (editingItem) {
        const res = await updateAdminLelangItem(editingItem.id, {
          title: formTitle.trim(),
          type: formType,
          sourceId: formSourceId,
          rarity: formRarity,
          startPrice: startPriceNum,
          minIncrement: minIncNum,
          durationHours: durNum,
          description: formDesc.trim(),
          accentColor: formAccent,
          glowColor: `${formAccent}66`,
          imageUrl: formImageUrl || undefined,
          status: formStatus,
        });
        if (res.success) {
          hapticSuccess();
          setShowItemModal(false);
          await loadData();
        } else {
          Alert.alert("Gagal", res.error || "Gagal memperbarui item lelang.");
        }
      } else {
        const res = await createAdminLelangItem({
          title: formTitle.trim(),
          type: formType,
          sourceId: formSourceId,
          rarity: formRarity,
          startPrice: startPriceNum,
          currentBid: startPriceNum,
          minIncrement: minIncNum,
          durationHours: durNum,
          status: formStatus,
          description: formDesc.trim() || "Item lelang resmi Nuenime.",
          accentColor: formAccent,
          glowColor: `${formAccent}66`,
          imageUrl: formImageUrl || undefined,
          totalBidders: 0,
          endsAt: Date.now() + durNum * 3600 * 1000,
        });
        if (res.success) {
          hapticSuccess();
          setShowItemModal(false);
          await loadData();
        } else {
          Alert.alert("Gagal", res.error || "Gagal membuat item lelang.");
        }
      }
    } catch {
      Alert.alert("Error", "Gagal menyimpan item lelang ke Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (itemId: string, title: string) => {
    Alert.alert(
      "Hapus Item Lelang",
      `Apakah Anda yakin ingin menghapus "${title}" dari katalog lelang?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAdminLelangItem(itemId);
              hapticSuccess();
              await loadData();
            } catch {
              Alert.alert("Error", "Gagal menghapus item.");
            }
          },
        },
      ]
    );
  };

  const handleToggleEndAuction = async (item: LelangItem) => {
    const newStatus = item.status === "active" ? "ended" : "active";
    try {
      await updateAdminLelangItem(item.id, {
        status: newStatus,
        endsAt: newStatus === "ended" ? Date.now() : Date.now() + 3600 * 4000,
      });
      hapticLight();
      await loadData();
    } catch {
      Alert.alert("Error", "Gagal memperbarui status lelang.");
    }
  };

  const handleToggleWinnerClaim = async (winner: LelangWinnerRecord) => {
    try {
      await markWinnerClaimStatus(winner.id, !winner.isClaimed);
      hapticSuccess();
      await loadData();
    } catch {
      Alert.alert("Error", "Gagal mengubah status klaim.");
    }
  };

  return (
    <AdminLayout
      title="Manajemen Lelang & Bidding"
      subtitle="Terhubung langsung dengan Border (/admin/borders) & Banner (/admin/gacha) di Supabase"
      activeKey="lelang"
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* TOP STATS CARDS */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <AppIcon name="gavel" size={20} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.statLabel}>Lelang Aktif</Text>
              <Text style={styles.statValue}>{stats.totalActive} Item</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <AppIcon name="crystal-ball" size={20} color="#38BDF8" />
            </View>
            <View>
              <Text style={styles.statLabel}>Volume Bidding</Text>
              <Text style={styles.statValue}>{stats.totalVolume.toLocaleString("id-ID")} 💎</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <AppIcon name="trophy-award" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.statLabel}>Menunggu Klaim</Text>
              <Text style={styles.statValue}>{stats.unclaimedWinners} Pemenang</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <AppIcon name="check-circle" size={20} color="#10B981" />
            </View>
            <View>
              <Text style={styles.statLabel}>Lelang Selesai</Text>
              <Text style={styles.statValue}>{stats.totalEnded} Item</Text>
            </View>
          </View>
        </View>

        {/* CONTROLS BAR: SEARCH, TABS & CREATE BUTTON */}
        <View style={styles.controlsBar}>
          <View style={styles.tabButtonsRow}>
            <Pressable
              onPress={() => setActiveTab("items")}
              style={[styles.tabButton, activeTab === "items" && styles.tabButtonActive]}
            >
              <AppIcon name="format-list-bulleted" size={16} color={activeTab === "items" ? "#EF4444" : "#94A3B8"} />
              <Text style={[styles.tabButtonText, activeTab === "items" && styles.tabButtonTextActive]}>
                Katalog Lelang ({items.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("winners")}
              style={[styles.tabButton, activeTab === "winners" && styles.tabButtonActive]}
            >
              <AppIcon name="crown" size={16} color={activeTab === "winners" ? "#EF4444" : "#94A3B8"} />
              <Text style={[styles.tabButtonText, activeTab === "winners" && styles.tabButtonTextActive]}>
                Hasil & Pemenang ({winners.length})
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={openCreateModal} style={styles.createBtn}>
            <AppIcon name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Buat Lelang dari Border / Banner</Text>
          </Pressable>
        </View>

        {/* TAB 1: DAFTAR ITEM LELANG */}
        {activeTab === "items" && (
          <View style={styles.tabContent}>
            {/* Filter and Search Row */}
            <View style={styles.filterRow}>
              <View style={styles.searchBox}>
                <AppIcon name="magnify" size={18} color="#94A3B8" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Cari judul, source ID, penawar tertinggi..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <AppIcon name="close" size={16} color="#94A3B8" />
                  </Pressable>
                )}
              </View>

              <View style={styles.statusChipsRow}>
                {(["all", "active", "ended", "scheduled"] as StatusFilter[]).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setStatusFilter(st)}
                    style={[styles.statusChip, statusFilter === st && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusChipText, statusFilter === st && styles.statusChipTextActive]}>
                      {st === "all" ? "Semua Status" : st === "active" ? "Sedang Live" : st === "ended" ? "Selesai" : "Jadwal"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#EF4444" />
                <Text style={styles.loadingText}>Memuat lelang dari database Supabase...</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <AppIcon name="gavel" size={40} color="#475569" />
                <Text style={styles.emptyTitle}>Belum ada lelang yang dibuat</Text>
                <Text style={styles.emptySubtitle}>
                  Klik tombol "Buat Lelang dari Border / Banner" di atas untuk memilih aset dari katalog Anda.
                </Text>
              </View>
            ) : (
              <View style={styles.tableCard}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, { flex: 2.2 }]}>ITEM & SUMBER ASET</Text>
                  <Text style={[styles.thCell, { flex: 1.1 }]}>STATUS</Text>
                  <Text style={[styles.thCell, { flex: 1.3 }]}>TAWARAN TERTINGGI</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>PENAWAR TERATAS</Text>
                  <Text style={[styles.thCell, { flex: 1.2 }]}>TOTAL PENAWAR</Text>
                  <Text style={[styles.thCell, { flex: 1.8, textAlign: "right" }]}>AKSI</Text>
                </View>

                {filteredItems.map((item) => {
                  const isLive = item.status === "active";
                  return (
                    <View key={item.id} style={styles.tableRow}>
                      <View style={[styles.tdCell, { flex: 2.2, flexDirection: "row", alignItems: "center", gap: 12 }]}>
                        <View style={[styles.itemColorDot, { backgroundColor: item.accentColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitleText}>{item.title}</Text>
                          <View style={styles.itemTagsRow}>
                            <View style={styles.itemTag}>
                              <Text style={styles.itemTagText}>{item.type.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.sourceIdText}>Source: {item.sourceId}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.tdCell, { flex: 1.1 }]}>
                        <View
                          style={[
                            styles.badgePill,
                            isLive
                              ? styles.badgeLive
                              : item.status === "ended"
                              ? styles.badgeEnded
                              : styles.badgeScheduled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              isLive
                                ? styles.badgeTextLive
                                : item.status === "ended"
                                ? styles.badgeTextEnded
                                : styles.badgeTextScheduled,
                            ]}
                          >
                            {isLive ? "LIVE" : item.status === "ended" ? "SELESAI" : "JADWAL"}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, { flex: 1.3 }]}>
                        <Text style={styles.amountBoldText}>
                          {(item.currentBid || item.startPrice).toLocaleString("id-ID")} 💎
                        </Text>
                        <Text style={styles.startPriceSubText}>
                          Awal: {item.startPrice.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { flex: 1.5 }]}>
                        <View style={styles.bidderRow}>
                          <AppIcon name="account-circle" size={16} color="#38BDF8" />
                          <Text style={styles.bidderNameText} numberOfLines={1}>
                            {item.highestBidderName || "Belum ada"}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, { flex: 1.2 }]}>
                        <Text style={styles.totalBiddersText}>{item.totalBidders} Penawar</Text>
                        <Text style={styles.bidsSubText}>{item.bidHistory?.length || 0} Tawaran</Text>
                      </View>

                      <View style={[styles.tdCell, { flex: 1.8, flexDirection: "row", justifyContent: "flex-end", gap: 6 }]}>
                        <Pressable
                          onPress={() => handleToggleEndAuction(item)}
                          accessibilityLabel={isLive ? "Tutup Lelang Sekarang" : "Buka / Lanjutkan Lelang"}
                          style={[
                            styles.iconActionBtn,
                            { backgroundColor: isLive ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)" },
                          ]}
                        >
                          <AppIcon
                            name={isLive ? "stop-circle-outline" : "play-circle-outline"}
                            size={16}
                            color={isLive ? "#EF4444" : "#10B981"}
                          />
                        </Pressable>

                        <Pressable
                          onPress={() => openEditModal(item)}
                          style={[styles.iconActionBtn, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}
                        >
                          <AppIcon name="pencil" size={16} color="#38BDF8" />
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteItem(item.id, item.title)}
                          style={[styles.iconActionBtn, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}
                        >
                          <AppIcon name="trash-can-outline" size={16} color="#F43F5E" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: DAFTAR PEMENANG & VERIFIKASI KLAIM */}
        {activeTab === "winners" && (
          <View style={styles.tabContent}>
            <View style={styles.winnerSectionHeader}>
              <View>
                <Text style={styles.sectionHeading}>Hasil Resmi Server & Log Pemenang (Supabase)</Text>
                <Text style={styles.sectionSubtitle}>
                  Data pemenang asli yang masuk dari APK saat pengguna menawar atau melakukan pelunasan klaim.
                </Text>
              </View>
            </View>

            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2.2 }]}>ITEM LELANG</Text>
                <Text style={[styles.thCell, { flex: 1.8 }]}>NAMA PEMENANG</Text>
                <Text style={[styles.thCell, { flex: 1.5 }]}>HARGA FINAL</Text>
                <Text style={[styles.thCell, { flex: 1.5 }]}>STATUS KLAIM</Text>
                <Text style={[styles.thCell, { flex: 1.5 }]}>WAKTU SELESAI</Text>
                <Text style={[styles.thCell, { flex: 1.2, textAlign: "right" }]}>AKSI</Text>
              </View>

              {winners.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptySubtitle}>Belum ada lelang yang memiliki pemenang tersimpan.</Text>
                </View>
              ) : (
                winners.map((win) => (
                  <View key={win.id} style={styles.tableRow}>
                    <View style={[styles.tdCell, { flex: 2.2 }]}>
                      <Text style={styles.itemTitleText}>{win.itemTitle}</Text>
                      <Text style={styles.itemRarityText}>{win.itemType.toUpperCase()} • {win.rarity}</Text>
                    </View>

                    <View style={[styles.tdCell, { flex: 1.8 }]}>
                      <View style={styles.bidderRow}>
                        <AppIcon name="crown" size={15} color="#F59E0B" />
                        <Text style={styles.winnerNameText}>{win.winnerName}</Text>
                      </View>
                    </View>

                    <View style={[styles.tdCell, { flex: 1.5 }]}>
                      <Text style={styles.amountBoldText}>{win.finalPrice.toLocaleString("id-ID")} 💎</Text>
                    </View>

                    <View style={[styles.tdCell, { flex: 1.5 }]}>
                      <View style={[styles.badgePill, win.isClaimed ? styles.badgeClaimed : styles.badgeUnclaimed]}>
                        <Text style={[styles.badgeText, win.isClaimed ? styles.badgeTextClaimed : styles.badgeTextUnclaimed]}>
                          {win.isClaimed ? "SUDAH DIKLAIM" : "MENUNGGU BAYAR"}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.tdCell, { flex: 1.5 }]}>
                      <Text style={styles.timeCompletedText}>{win.completedAt}</Text>
                    </View>

                    <View style={[styles.tdCell, { flex: 1.2, alignItems: "flex-end" }]}>
                      <Pressable
                        onPress={() => handleToggleWinnerClaim(win)}
                        style={[
                          styles.toggleClaimBtn,
                          { backgroundColor: win.isClaimed ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)" },
                        ]}
                      >
                        <Text style={[styles.toggleClaimBtnText, { color: win.isClaimed ? "#F59E0B" : "#10B981" }]}>
                          {win.isClaimed ? "Reset" : "Set Lunas"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL CREATE / EDIT ITEM LELANG */}
      <Modal visible={showItemModal} transparent animationType="fade" onRequestClose={() => setShowItemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.modalHeaderIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                  <AppIcon name="gavel" size={20} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingItem ? "Edit Item Lelang" : "Buat Lelang Baru dari Katalog"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Terhubung otomatis ke Border Avatar & Banner Gacha Supabase.
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setShowItemModal(false)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 1. Pilih Tipe Aset */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Pilih Tipe Aset yang Mau Dilelang</Text>
                <View style={styles.typeSegment}>
                  <Pressable
                    onPress={() => {
                      setFormType("border");
                      if (borderList.length > 0) handleSelectBorderCandidate(borderList[0]);
                    }}
                    style={[styles.typeSegmentBtn, formType === "border" && styles.typeSegmentBtnActive]}
                  >
                    <Text style={[styles.typeSegmentBtnText, formType === "border" && styles.typeSegmentBtnTextActive]}>
                      BORDER AVATAR (/admin/borders)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFormType("banner");
                      if (bannerList.length > 0) handleSelectBannerCandidate(bannerList[0]);
                    }}
                    style={[styles.typeSegmentBtn, formType === "banner" && styles.typeSegmentBtnActive]}
                  >
                    <Text style={[styles.typeSegmentBtnText, formType === "banner" && styles.typeSegmentBtnTextActive]}>
                      BANNER PROFIL (/admin/gacha)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 2. Pilih Dari Daftar Aset Supabase */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Pilih {formType === "border" ? "Border Avatar" : "Banner"} dari Database:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
                  {formType === "border"
                    ? borderList.map((b) => (
                        <Pressable
                          key={b.id}
                          onPress={() => handleSelectBorderCandidate(b)}
                          style={[styles.sourceCard, formSourceId === b.id && styles.sourceCardActive]}
                        >
                          <Text style={[styles.sourceCardTitle, formSourceId === b.id && styles.sourceCardTitleActive]}>
                            {b.name}
                          </Text>
                          <Text style={styles.sourceCardSub}>ID: {b.id}</Text>
                        </Pressable>
                      ))
                    : bannerList.map((bn) => (
                        <Pressable
                          key={bn.id}
                          onPress={() => handleSelectBannerCandidate(bn)}
                          style={[styles.sourceCard, formSourceId === bn.id && styles.sourceCardActive]}
                        >
                          <Text style={[styles.sourceCardTitle, formSourceId === bn.id && styles.sourceCardTitleActive]}>
                            {bn.name}
                          </Text>
                          <Text style={styles.sourceCardSub}>ID: {bn.id}</Text>
                        </Pressable>
                      ))}
                </ScrollView>
              </View>

              {/* Judul Item */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Judul Tampilan Lelang *</Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Contoh: Border Nebula, Banner Lunar Eclipse..."
                  placeholderTextColor="#64748B"
                  style={styles.formInput}
                />
              </View>

              {/* Rarity */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tingkat Kelangkaan (Rarity)</Text>
                <View style={styles.rarityWrap}>
                  {(["Mythic Limited", "Exclusive Event", "Legendary", "Epic"] as LelangRarity[]).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setFormRarity(r)}
                      style={[styles.rarityPill, formRarity === r && styles.rarityPillActive]}
                    >
                      <Text style={[styles.rarityPillText, formRarity === r && styles.rarityPillTextActive]}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Pricing & Duration */}
              <View style={styles.formDualRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Harga Awal (Crystal) *</Text>
                  <TextInput
                    value={formStartPrice}
                    onChangeText={setFormStartPrice}
                    keyboardType="numeric"
                    placeholder="1000"
                    placeholderTextColor="#64748B"
                    style={styles.formInput}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Kenaikan Min (Crystal)</Text>
                  <TextInput
                    value={formMinInc}
                    onChangeText={setFormMinInc}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#64748B"
                    style={styles.formInput}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Durasi (Jam)</Text>
                  <TextInput
                    value={formDuration}
                    onChangeText={setFormDuration}
                    keyboardType="numeric"
                    placeholder="4"
                    placeholderTextColor="#64748B"
                    style={styles.formInput}
                  />
                </View>
              </View>

              {/* Deskripsi */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Deskripsi Item</Text>
                <TextInput
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  numberOfLines={2}
                  placeholder="Deskripsi keunikan efek..."
                  placeholderTextColor="#64748B"
                  style={[styles.formInput, { height: 60, textAlignVertical: "top" }]}
                />
              </View>

              {/* Accent Color & Status */}
              <View style={styles.formDualRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Warna Glow (Hex)</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.colorPreview, { backgroundColor: formAccent }]} />
                    <TextInput
                      value={formAccent}
                      onChangeText={setFormAccent}
                      placeholder="#EF4444"
                      placeholderTextColor="#64748B"
                      style={[styles.formInput, { flex: 1 }]}
                    />
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Status Lelang</Text>
                  <View style={styles.typeSegment}>
                    {(["active", "scheduled", "ended"] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setFormStatus(s)}
                        style={[styles.typeSegmentBtn, formStatus === s && styles.typeSegmentBtnActive]}
                      >
                        <Text style={[styles.typeSegmentBtnText, formStatus === s && styles.typeSegmentBtnTextActive]}>
                          {s === "active" ? "LIVE" : s === "scheduled" ? "JADWAL" : "SELESAI"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowItemModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable disabled={saving} onPress={handleSaveItem} style={styles.saveBtn}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>
                      {editingItem ? "Simpan Perubahan" : "Terbitkan ke Aplikasi"}
                    </Text>
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
  container: {
    padding: 24,
    gap: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 18,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  statValue: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    marginTop: 2,
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  tabButtonsRow: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  tabButtonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    elevation: 3,
  },
  createBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  tabContent: {
    gap: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  statusChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusChipActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  statusChipText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  statusChipTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  tableCard: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  thCell: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  tdCell: {
    justifyContent: "center",
  },
  itemColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemTitleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  itemTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  itemTag: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemTagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  sourceIdText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  itemRarityText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  badgePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeLive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  badgeEnded: {
    backgroundColor: "rgba(100, 116, 139, 0.15)",
    borderColor: "#64748B",
  },
  badgeScheduled: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  badgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
  },
  badgeTextLive: {
    color: "#EF4444",
  },
  badgeTextEnded: {
    color: "#94A3B8",
  },
  badgeTextScheduled: {
    color: "#F59E0B",
  },
  badgeClaimed: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  badgeUnclaimed: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  badgeTextClaimed: {
    color: "#10B981",
  },
  badgeTextUnclaimed: {
    color: "#F59E0B",
  },
  amountBoldText: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  startPriceSubText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  bidderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bidderNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#E2E8F0",
  },
  totalBiddersText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  bidsSubText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
  },
  winnerSectionHeader: {
    marginBottom: 8,
  },
  sectionHeading: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  winnerNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F59E0B",
  },
  timeCompletedText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  toggleClaimBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleClaimBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 640,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  modalHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 20,
    maxHeight: 520,
  },
  formGroup: {
    marginBottom: 16,
    gap: 6,
  },
  formLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#E2E8F0",
  },
  formInput: {
    backgroundColor: "#0B0F19",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  formDualRow: {
    flexDirection: "row",
    gap: 12,
  },
  typeSegment: {
    flexDirection: "row",
    backgroundColor: "#0B0F19",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  typeSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  typeSegmentBtnActive: {
    backgroundColor: "#EF4444",
  },
  typeSegmentBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  typeSegmentBtnTextActive: {
    color: "#FFFFFF",
  },
  sourceScroll: {
    flexDirection: "row",
    gap: 8,
  },
  sourceCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#0B0F19",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 8,
  },
  sourceCardActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  sourceCardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  sourceCardTitleActive: {
    color: "#FFFFFF",
  },
  sourceCardSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  rarityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  rarityPill: {
    backgroundColor: "#0B0F19",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  rarityPillActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  rarityPillText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  rarityPillTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  colorPreview: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
