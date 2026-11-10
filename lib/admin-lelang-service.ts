import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type LelangItemType = "banner" | "border";
export type LelangRarity =
  | "Mythic Limited"
  | "Exclusive Event"
  | "Legendary"
  | "Epic";

export interface LelangBidEntry {
  id: string;
  amount: number;
  bidderName: string;
  bidderId?: string;
  timeAgo: string;
  timestamp: number;
}

export interface LelangItem {
  id: string;
  title: string;
  type: LelangItemType;
  sourceId: string; // ID dari avatar_borders_config atau gacha_banners
  rarity: LelangRarity;
  startPrice: number;
  currentBid: number;
  minIncrement?: number;
  durationHours?: number;
  startTimeFormatted?: string;
  endTimeFormatted?: string;
  highestBidderName?: string;
  highestBidderId?: string;
  totalBidders: number;
  endsAt: number; // timestamp in ms
  status: "active" | "scheduled" | "ended" | "cancelled";
  description: string;
  accentColor: string;
  glowColor: string;
  imageUrl?: string;
  bidHistory?: LelangBidEntry[];
}

export interface LelangWinnerRecord {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: LelangItemType;
  rarity: LelangRarity;
  finalPrice: number;
  winnerName: string;
  winnerId: string;
  completedAt: string;
  isClaimed: boolean;
  totalBids: number;
}

export interface BorderCandidate {
  id: string;
  name: string;
  rarity: string;
  assetUrl?: string | null;
  description?: string | null;
}

export interface BannerCandidate {
  id: string;
  name: string;
  rarity: string;
  image: string;
  color: string;
}

const STORAGE_LELANG_ITEMS_CACHE = "nuenime.admin.lelang.items.cache";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/**
 * Mengambil daftar Border dari avatar_borders_config sebagai opsi item lelang
 */
export async function getBorderCandidates(): Promise<BorderCandidate[]> {
  try {
    const { data, error } = await supabase
      .from("avatar_borders_config")
      .select("id, name, rarity, asset_url, description")
      .order("sort_order", { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map((d) => ({
        id: d.id,
        name: d.name,
        rarity: d.rarity,
        assetUrl: d.asset_url,
        description: d.description,
      }));
    }
  } catch (err) {
    console.warn("[admin-lelang-service] Failed fetching border candidates:", err);
  }
  return [];
}

/**
 * Mengambil daftar Banner dari gacha_banners sebagai opsi item lelang
 */
export async function getBannerCandidates(): Promise<BannerCandidate[]> {
  try {
    const { data, error } = await supabase
      .from("gacha_banners")
      .select("id, name, rarity, image, color")
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((d) => ({
        id: d.id,
        name: d.name,
        rarity: d.rarity,
        image: d.image,
        color: d.color,
      }));
    }
  } catch (err) {
    console.warn("[admin-lelang-service] Failed fetching banner candidates:", err);
  }
  return [];
}

/**
 * Mengambil semua item lelang dari Supabase lelang_items
 */
export async function getAdminLelangItems(): Promise<LelangItem[]> {
  try {
    const { data, error } = await supabase
      .from("lelang_items")
      .select("*, lelang_bids(*)")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const items: LelangItem[] = data.map((d: any) => {
        const bids: LelangBidEntry[] = Array.isArray(d.lelang_bids)
          ? d.lelang_bids
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((b: any) => ({
                id: b.id,
                amount: b.bid_amount,
                bidderName: b.user_name,
                bidderId: b.user_id,
                timeAgo: formatRelativeTime(b.created_at),
                timestamp: new Date(b.created_at).getTime(),
              }))
          : [];

        const startsAt = new Date(d.starts_at).getTime();
        const endsAt = new Date(d.ends_at).getTime();
        const now = Date.now();
        let status = d.status;
        if (status === "active" && endsAt <= now) {
          status = "ended";
        }

        return {
          id: d.id,
          title: d.title,
          type: d.item_type,
          sourceId: d.source_id,
          rarity: d.rarity,
          startPrice: d.start_price,
          currentBid: d.current_bid,
          minIncrement: d.min_increment,
          durationHours: d.duration_hours,
          startTimeFormatted: new Date(d.starts_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          endTimeFormatted: new Date(d.ends_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          highestBidderName: d.highest_bidder_name,
          highestBidderId: d.highest_bidder_id,
          totalBidders: d.total_bidders,
          endsAt,
          status,
          description: d.description || "",
          accentColor: d.accent_color || "#EF4444",
          glowColor: d.glow_color || "rgba(239, 68, 68, 0.4)",
          imageUrl: d.image_url,
          bidHistory: bids,
        };
      });

      await AsyncStorage.setItem(STORAGE_LELANG_ITEMS_CACHE, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    console.warn("[admin-lelang-service] Failed fetching from Supabase, loading cache:", err);
  }

  // Fallback cache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LELANG_ITEMS_CACHE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Menambahkan Item Lelang Baru ke Supabase lelang_items
 */
export async function createAdminLelangItem(
  item: Omit<LelangItem, "id"> & { id?: string }
): Promise<{ success: boolean; item?: LelangItem; error?: string }> {
  try {
    const cleanId = (item.id || `lelang_${item.sourceId}_${Date.now()}`).trim().toLowerCase();
    const startsAt = new Date();
    const durationHours = item.durationHours || 4;
    const endsAt = new Date(startsAt.getTime() + durationHours * 3600 * 1000);

    const insertPayload = {
      id: cleanId,
      title: item.title,
      item_type: item.type,
      source_id: item.sourceId,
      rarity: item.rarity,
      start_price: item.startPrice,
      current_bid: item.startPrice,
      min_increment: item.minIncrement || 100,
      duration_hours: durationHours,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      total_bidders: 0,
      status: item.status || "active",
      description: item.description || "",
      accent_color: item.accentColor || "#EF4444",
      glow_color: item.glowColor || "rgba(239, 68, 68, 0.4)",
      image_url: item.imageUrl || null,
    };

    const { data, error } = await supabase
      .from("lelang_items")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      item: {
        id: data.id,
        title: data.title,
        type: data.item_type,
        sourceId: data.source_id,
        rarity: data.rarity,
        startPrice: data.start_price,
        currentBid: data.current_bid,
        minIncrement: data.min_increment,
        durationHours: data.duration_hours,
        startTimeFormatted: "Baru saja",
        endTimeFormatted: endsAt.toLocaleDateString("id-ID"),
        totalBidders: 0,
        endsAt: endsAt.getTime(),
        status: data.status,
        description: data.description,
        accentColor: data.accent_color,
        glowColor: data.glow_color,
        imageUrl: data.image_url,
        bidHistory: [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal membuat item lelang." };
  }
}

/**
 * Memperbarui Item Lelang di Supabase
 */
export async function updateAdminLelangItem(
  itemId: string,
  patch: Partial<LelangItem>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) updatePayload.title = patch.title;
    if (patch.type !== undefined) updatePayload.item_type = patch.type;
    if (patch.sourceId !== undefined) updatePayload.source_id = patch.sourceId;
    if (patch.rarity !== undefined) updatePayload.rarity = patch.rarity;
    if (patch.startPrice !== undefined) updatePayload.start_price = patch.startPrice;
    if (patch.currentBid !== undefined) updatePayload.current_bid = patch.currentBid;
    if (patch.minIncrement !== undefined) updatePayload.min_increment = patch.minIncrement;
    if (patch.durationHours !== undefined) updatePayload.duration_hours = patch.durationHours;
    if (patch.description !== undefined) updatePayload.description = patch.description;
    if (patch.accentColor !== undefined) updatePayload.accent_color = patch.accentColor;
    if (patch.glowColor !== undefined) updatePayload.glow_color = patch.glowColor;
    if (patch.imageUrl !== undefined) updatePayload.image_url = patch.imageUrl;
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.endsAt !== undefined) updatePayload.ends_at = new Date(patch.endsAt).toISOString();

    const { error } = await supabase
      .from("lelang_items")
      .update(updatePayload)
      .eq("id", itemId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal memperbarui item lelang." };
  }
}

/**
 * Menghapus Item Lelang dari Supabase
 */
export async function deleteAdminLelangItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("lelang_items").delete().eq("id", itemId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Mengambil Daftar Pemenang Lelang dari Supabase lelang_winners
 */
export async function getAdminLelangWinners(): Promise<LelangWinnerRecord[]> {
  try {
    const { data, error } = await supabase
      .from("lelang_winners")
      .select("*, lelang_items(*)")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((d: any) => ({
        id: d.id,
        itemId: d.item_id,
        itemTitle: d.lelang_items?.title || "Item Lelang",
        itemType: d.lelang_items?.item_type || "border",
        rarity: d.lelang_items?.rarity || "Mythic Limited",
        finalPrice: d.final_price,
        winnerName: d.winner_name,
        winnerId: d.user_id,
        completedAt: new Date(d.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        isClaimed: d.is_claimed,
        totalBids: 0,
      }));
    }
  } catch (err) {
    console.warn("[admin-lelang-service] Failed fetching winners from Supabase:", err);
  }
  return [];
}

/**
 * Toggle Status Klaim Pemenang oleh Admin
 */
export async function markWinnerClaimStatus(winnerId: string, isClaimed: boolean): Promise<void> {
  try {
    await supabase
      .from("lelang_winners")
      .update({
        is_claimed: isClaimed,
        claimed_at: isClaimed ? new Date().toISOString() : null,
      })
      .eq("id", winnerId);
  } catch (err) {
    console.warn("[admin-lelang-service] Failed updating winner claim status:", err);
  }
}
