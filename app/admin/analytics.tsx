import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { supabase } from "@/lib/supabase";
import {
  getAllTransactionsForAdmin,
  type TopUpTransaction,
} from "@/lib/admin-service";
import { getAdminAuditLogs, type AuditLogItem } from "@/lib/admin-audit";
import { fetchLiveBorderCatalog, type AvatarBorder } from "@/lib/avatar-borders";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

// ─── TIPE PERIODE WAKTU & TAB ───
type TimeRange = "today" | "7d" | "30d" | "90d" | "year" | "all";
type AnalyticsTab = "overview" | "content" | "financial" | "gacha_borders" | "system_behavior";

// ─── STRUKTUR DATA ANALYTICS ───
interface UserProfileData {
  id: string;
  username: string;
  display_name?: string | null;
  role: string;
  crystals?: number;
  exp?: number;
  is_banned?: boolean;
  created_at: string;
}

interface WatchHistoryData {
  id: string;
  user_id: string;
  anime_id: number;
  anime_title: string;
  episode_number: number;
  progress: number;
  duration: number;
  updated_at?: string;
  created_at?: string;
}

interface CommentData {
  id: string;
  user_id: string;
  anime_id: number;
  episode_number?: number;
  content: string;
  likes: number;
  created_at: string;
}

interface GachaTransactionData {
  id: string;
  user_id: string;
  banner_name: string;
  item_name: string;
  item_type?: string;
  item_rarity: string;
  crystals_spent: number;
  created_at: string;
}

interface LiveActivityEvent {
  id: string;
  type: "user" | "tx" | "watch" | "comment" | "audit";
  title: string;
  description: string;
  timestamp: string;
  badge: string;
  badgeColor: string;
}

export default function AdminAnalyticsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const isMobile = width < 768;

  // ─── FILTER & TAB STATE ───
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ─── FLOATING ACTION TOAST (PERSIS ADMIN SUPPORT & GAMIFICATION) ───
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast(null);
    }, 3200);
  }, []);

  // ─── DATA STATE ───
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [transactions, setTransactions] = useState<TopUpTransaction[]>([]);
  const [watchLogs, setWatchLogs] = useState<WatchHistoryData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [gachaTxs, setGachaTxs] = useState<GachaTransactionData[]>([]);
  const [borders, setBorders] = useState<AvatarBorder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // ─── LOAD RAW DATA DARI BACKEND DENGAN FALLBACK AMAN ───
  const loadAllAnalyticsData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setHasError(false);
    setErrorMessage("");

    try {
      // 1. Fetch Users from profiles
      const fetchProfiles = async (): Promise<UserProfileData[]> => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, username, display_name, role, crystals, exp, is_banned, created_at")
            .order("created_at", { ascending: false })
            .limit(1000);
          if (!error && Array.isArray(data)) return data as UserProfileData[];
        } catch {}
        return [];
      };

      // 2. Fetch Transactions from topup_transactions
      const fetchTxs = async (): Promise<TopUpTransaction[]> => {
        try {
          return await getAllTransactionsForAdmin();
        } catch {
          return [];
        }
      };

      // 3. Fetch Watch History
      const fetchWatchHistory = async (): Promise<WatchHistoryData[]> => {
        try {
          const { data, error } = await supabase
            .from("watch_history")
            .select("id, user_id, anime_id, anime_title, episode_number, progress, duration, updated_at, created_at")
            .order("updated_at", { ascending: false })
            .limit(1000);
          if (!error && Array.isArray(data)) return data as WatchHistoryData[];
        } catch {}
        return [];
      };

      // 4. Fetch Comments
      const fetchComments = async (): Promise<CommentData[]> => {
        try {
          const { data, error } = await supabase
            .from("comments")
            .select("id, user_id, anime_id, episode_number, content, likes, created_at")
            .order("created_at", { ascending: false })
            .limit(1000);
          if (!error && Array.isArray(data)) return data as CommentData[];
        } catch {}
        return [];
      };

      // 5. Fetch Gacha Transactions
      const fetchGacha = async (): Promise<GachaTransactionData[]> => {
        try {
          const { data, error } = await supabase
            .from("gacha_transactions")
            .select("id, user_id, banner_name, item_name, item_type, item_rarity, crystals_spent, created_at")
            .order("created_at", { ascending: false })
            .limit(500);
          if (!error && Array.isArray(data)) return data as GachaTransactionData[];
        } catch {}
        return [];
      };

      // 6. Fetch Borders
      const fetchBordersData = async (): Promise<AvatarBorder[]> => {
        try {
          return await fetchLiveBorderCatalog();
        } catch {
          return [];
        }
      };

      // 7. Fetch Audit Logs
      const fetchAudit = async (): Promise<AuditLogItem[]> => {
        try {
          return await getAdminAuditLogs();
        } catch {
          return [];
        }
      };

      const [profilesRes, txsRes, watchRes, commentsRes, gachaRes, bordersRes, auditRes] =
        await Promise.all([
          fetchProfiles(),
          fetchTxs(),
          fetchWatchHistory(),
          fetchComments(),
          fetchGacha(),
          fetchBordersData(),
          fetchAudit(),
        ]);

      setUsers(profilesRes);
      setTransactions(txsRes);
      setWatchLogs(watchRes);
      setComments(commentsRes);
      setGachaTxs(gachaRes);
      setBorders(bordersRes);
      setAuditLogs(auditRes);
      setLastUpdated(new Date());

      if (isManualRefresh) {
        hapticSuccess();
        showToast("Data analitik berhasil disinkronkan!", "success");
      }
    } catch (err: any) {
      setHasError(true);
      setErrorMessage(err?.message || "Gagal menyinkronkan data analitik.");
      hapticWarning();
      showToast(err?.message || "Gagal menyinkronkan data analitik.", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAllAnalyticsData();
  }, [loadAllAnalyticsData]);

  // ─── HITUNG BATAS FILTER WAKTU (START TIMESTAMP) ───
  const filterStartTime = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case "today": {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return start.getTime();
      }
      case "7d":
        return now.getTime() - 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return now.getTime() - 30 * 24 * 60 * 60 * 1000;
      case "90d":
        return now.getTime() - 90 * 24 * 60 * 60 * 1000;
      case "year": {
        const start = new Date(now.getFullYear(), 0, 1);
        return start.getTime();
      }
      case "all":
      default:
        return 0;
    }
  }, [timeRange]);

  // ─── DATA TERFILTER BERDASARKAN PERIODE ───
  const filteredUsers = useMemo(() => {
    if (filterStartTime === 0) return users;
    return users.filter((u) => new Date(u.created_at).getTime() >= filterStartTime);
  }, [users, filterStartTime]);

  const filteredTransactions = useMemo(() => {
    if (filterStartTime === 0) return transactions;
    return transactions.filter((t) => new Date(t.createdAt).getTime() >= filterStartTime);
  }, [transactions, filterStartTime]);

  const filteredWatchLogs = useMemo(() => {
    if (filterStartTime === 0) return watchLogs;
    return watchLogs.filter((w) => {
      const t = new Date(w.updated_at || w.created_at || 0).getTime();
      return t >= filterStartTime;
    });
  }, [watchLogs, filterStartTime]);

  const filteredComments = useMemo(() => {
    if (filterStartTime === 0) return comments;
    return comments.filter((c) => new Date(c.created_at).getTime() >= filterStartTime);
  }, [comments, filterStartTime]);

  const filteredGachaTxs = useMemo(() => {
    if (filterStartTime === 0) return gachaTxs;
    return gachaTxs.filter((g) => new Date(g.created_at).getTime() >= filterStartTime);
  }, [gachaTxs, filterStartTime]);

  const filteredAuditLogs = useMemo(() => {
    if (filterStartTime === 0) return auditLogs;
    return auditLogs.filter((a) => new Date(a.createdAt).getTime() >= filterStartTime);
  }, [auditLogs, filterStartTime]);

  // ─── AGREGASI METRIK UTAMA (KPI) ───
  const kpiData = useMemo(() => {
    // 1. Pengguna
    const totalUsers = users.length;
    const newUsers = filteredUsers.length;
    const bannedUsers = users.filter((u) => u.is_banned).length;

    // Active users: unik user_id dari watch, comment, atau tx dalam periode
    const activeUserIds = new Set<string>();
    filteredWatchLogs.forEach((w) => activeUserIds.add(w.user_id));
    filteredComments.forEach((c) => activeUserIds.add(c.user_id));
    filteredTransactions.forEach((t) => activeUserIds.add(t.userId));
    const activeUsersCount = Math.max(activeUserIds.size, newUsers > 0 ? 1 : 0);

    // Returning users: active users yang created_at sebelum periode
    const returningUsersCount = users.filter(
      (u) =>
        new Date(u.created_at).getTime() < filterStartTime &&
        activeUserIds.has(u.id)
    ).length;

    // 2. Finansial
    let revenuePeriod = 0;
    let completedTxs = 0;
    let pendingTxs = 0;
    let rejectedTxs = 0;
    let crystalsMinted = 0;

    filteredTransactions.forEach((t) => {
      if (t.status === "berhasil") {
        completedTxs++;
        revenuePeriod += t.totalPayment;
        crystalsMinted += t.crystalAmount;
      } else if (t.status === "menunggu_verifikasi" || t.status === "menunggu_konfirmasi") {
        pendingTxs++;
      } else if (t.status === "ditolak") {
        rejectedTxs++;
      }
    });

    const avgTransactionValue =
      completedTxs > 0 ? Math.round(revenuePeriod / completedTxs) : 0;

    // 3. Aktivitas Streaming & Komunitas
    const totalWatchSessions = filteredWatchLogs.length;
    let totalSecondsWatched = 0;
    filteredWatchLogs.forEach((w) => {
      totalSecondsWatched += Math.min(w.duration || 1440, Math.max(0, w.progress || 0));
    });
    const totalHoursWatched = Math.round((totalSecondsWatched / 3600) * 10) / 10;

    const totalCommentsCount = filteredComments.length;
    let totalLikesCount = 0;
    filteredComments.forEach((c) => {
      totalLikesCount += c.likes || 0;
    });

    // 4. Crystal Economy
    let crystalsBurnedGacha = 0;
    filteredGachaTxs.forEach((g) => {
      crystalsBurnedGacha += g.crystals_spent || 0;
    });

    let totalCirculatingCrystals = 0;
    users.forEach((u) => {
      totalCirculatingCrystals += u.crystals || 0;
    });
    if (totalCirculatingCrystals === 0 && crystalsMinted > 0) {
      totalCirculatingCrystals = Math.max(0, crystalsMinted - crystalsBurnedGacha);
    }

    // Engagement rate
    const engagementRate =
      activeUsersCount > 0
        ? Math.round(((totalCommentsCount + totalLikesCount + totalWatchSessions) / activeUsersCount) * 10) / 10
        : 0;

    return {
      totalUsers,
      newUsers,
      activeUsersCount,
      returningUsersCount,
      bannedUsers,
      revenuePeriod,
      completedTxs,
      pendingTxs,
      rejectedTxs,
      avgTransactionValue,
      crystalsMinted,
      crystalsBurnedGacha,
      totalCirculatingCrystals,
      totalWatchSessions,
      totalHoursWatched,
      totalCommentsCount,
      totalLikesCount,
      engagementRate,
    };
  }, [
    users,
    filteredUsers,
    filteredTransactions,
    filteredWatchLogs,
    filteredComments,
    filteredGachaTxs,
    filterStartTime,
  ]);

  // ─── BREAKDOWN METODE PEMBAYARAN ───
  const paymentMethodStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number }> = {};
    filteredTransactions.forEach((tx) => {
      if (tx.status === "berhasil") {
        const method = (tx.paymentMethod || "Lainnya").toUpperCase();
        if (!stats[method]) stats[method] = { total: 0, count: 0 };
        stats[method].total += tx.totalPayment;
        stats[method].count += 1;
      }
    });
    return stats;
  }, [filteredTransactions]);

  // ─── TOP ANIME & EPISODE PALING BANYAK DITONTON ───
  const topAnimeRanking = useMemo(() => {
    const map = new Map<
      number,
      { animeId: number; title: string; views: number; viewers: Set<string>; avgProgress: number }
    >();

    filteredWatchLogs.forEach((w) => {
      const id = w.anime_id;
      if (!map.has(id)) {
        map.set(id, {
          animeId: id,
          title: w.anime_title || `Anime #${id}`,
          views: 0,
          viewers: new Set<string>(),
          avgProgress: 0,
        });
      }
      const entry = map.get(id)!;
      entry.views += 1;
      if (w.user_id) entry.viewers.add(w.user_id);
    });

    const list = Array.from(map.values()).map((item) => ({
      animeId: item.animeId,
      title: item.title,
      views: item.views,
      uniqueViewers: item.viewers.size,
    }));

    list.sort((a, b) => b.views - a.views);
    return list.slice(0, 10);
  }, [filteredWatchLogs]);

  // ─── TOP EPISODE ───
  const topEpisodeRanking = useMemo(() => {
    const map = new Map<string, { title: string; episode: number; views: number }>();
    filteredWatchLogs.forEach((w) => {
      const key = `${w.anime_id}_ep_${w.episode_number}`;
      if (!map.has(key)) {
        map.set(key, {
          title: w.anime_title || `Anime #${w.anime_id}`,
          episode: w.episode_number || 1,
          views: 0,
        });
      }
      map.get(key)!.views += 1;
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.views - a.views);
    return list.slice(0, 5);
  }, [filteredWatchLogs]);

  // ─── GACHA RARITY DISTRIBUTION ───
  const gachaRarityStats = useMemo(() => {
    const stats: Record<string, number> = {
      Mythic: 0,
      Legends: 0,
      Epic: 0,
      Rare: 0,
      Normal: 0,
    };
    filteredGachaTxs.forEach((g) => {
      const r = g.item_rarity || "Normal";
      if (stats[r] !== undefined) stats[r] += 1;
      else stats.Normal += 1;
    });
    return stats;
  }, [filteredGachaTxs]);

  // ─── BORDER MARKETPLACE BREAKDOWN ───
  const borderRarityCount = useMemo(() => {
    const stats: Record<string, number> = {
      Mythic: 0,
      Legends: 0,
      Epic: 0,
      Rare: 0,
      Normal: 0,
    };
    borders.forEach((b) => {
      const r = b.rarity || "Normal";
      if (stats[r] !== undefined) stats[r] += 1;
      else stats.Normal += 1;
    });
    return stats;
  }, [borders]);

  // ─── ADMIN ACTIVITY RANKING ───
  const topActiveAdmins = useMemo(() => {
    const map = new Map<string, { username: string; role: string; count: number }>();
    filteredAuditLogs.forEach((a) => {
      const key = a.adminEmail || a.adminId || "admin";
      if (!map.has(key)) {
        const name = a.adminEmail ? a.adminEmail.split("@")[0] : a.adminId || "Admin";
        map.set(key, {
          username: name,
          role: a.adminRole || "Staff",
          count: 0,
        });
      }
      map.get(key)!.count += 1;
    });
    const list = Array.from(map.values());
    list.sort((a, b) => b.count - a.count);
    return list.slice(0, 5);
  }, [filteredAuditLogs]);

  // ─── PEAK TIME ANALYTICS (HARI & JAM PALING SIBUK) ───
  const peakTimeStats = useMemo(() => {
    const daysCount = [0, 0, 0, 0, 0, 0, 0];
    const hoursCount = new Array(24).fill(0);

    const registerTimestamp = (dStr?: string) => {
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      const day = d.getDay();
      const hour = d.getHours();
      daysCount[day] += 1;
      hoursCount[hour] += 1;
    };

    filteredWatchLogs.forEach((w) => registerTimestamp(w.updated_at || w.created_at));
    filteredComments.forEach((c) => registerTimestamp(c.created_at));
    filteredTransactions.forEach((t) => registerTimestamp(t.createdAt));

    const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const maxDayVal = Math.max(...daysCount, 1);
    const maxHourVal = Math.max(...hoursCount, 1);

    let peakHourIndex = 0;
    hoursCount.forEach((val, idx) => {
      if (val > hoursCount[peakHourIndex]) peakHourIndex = idx;
    });

    let peakDayIndex = 0;
    daysCount.forEach((val, idx) => {
      if (val > daysCount[peakDayIndex]) peakDayIndex = idx;
    });

    return {
      daysCount,
      dayLabels,
      maxDayVal,
      hoursCount,
      maxHourVal,
      peakHour: `${peakHourIndex}:00 - ${peakHourIndex + 1}:00`,
      peakDay: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][peakDayIndex],
    };
  }, [filteredWatchLogs, filteredComments, filteredTransactions]);

  // ─── USER GROWTH DATA UNTUK GRAFIK (LINE/BAR CHART BUCKETS) ───
  const userGrowthChartData = useMemo(() => {
    const pointsCount = isMobile ? 6 : 8;
    const now = Date.now();
    const span = filterStartTime > 0 ? now - filterStartTime : 30 * 24 * 60 * 60 * 1000;
    const step = span / pointsCount;

    const buckets = [];
    for (let i = 0; i < pointsCount; i++) {
      const bStart = now - (pointsCount - i) * step;
      const bEnd = bStart + step;
      const d = new Date(bEnd);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;

      const count = users.filter((u) => {
        const t = new Date(u.created_at).getTime();
        return t >= bStart && t < bEnd;
      }).length;

      buckets.push({ label, count });
    }

    const maxVal = Math.max(...buckets.map((b) => b.count), 1);
    return { buckets, maxVal };
  }, [users, filterStartTime, isMobile]);

  // ─── LIVE ACTIVITY FEED TERBARU (10 AKTIVITAS SISTEM NYATA) ───
  const liveActivityFeed = useMemo(() => {
    const list: LiveActivityEvent[] = [];

    // User registrations
    users.slice(0, 4).forEach((u) => {
      list.push({
        id: `u-${u.id}`,
        type: "user",
        title: "Pengguna Baru Terdaftar",
        description: `@${u.username} bergabung sebagai ${u.role}`,
        timestamp: u.created_at,
        badge: "User",
        badgeColor: "#38BDF8",
      });
    });

    // Topup Transactions
    transactions.slice(0, 4).forEach((t) => {
      const isSuccess = t.status === "berhasil";
      list.push({
        id: `t-${t.id}`,
        type: "tx",
        title: isSuccess ? "Pembayaran Terverifikasi" : "Antrean Top Up",
        description: `${t.username} • ${t.packageName} (Rp${t.totalPayment.toLocaleString("id-ID")})`,
        timestamp: t.createdAt,
        badge: isSuccess ? "Berhasil" : "Pending",
        badgeColor: isSuccess ? "#10B981" : "#F59E0B",
      });
    });

    // Comments
    comments.slice(0, 3).forEach((c) => {
      list.push({
        id: `c-${c.id}`,
        type: "comment",
        title: "Komentar Komunitas Baru",
        description: `Ep ${c.episode_number || 1}: "${c.content.slice(0, 40)}${c.content.length > 40 ? "..." : ""}"`,
        timestamp: c.created_at,
        badge: "Komunitas",
        badgeColor: "#06B6D4",
      });
    });

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, 8);
  }, [users, transactions, comments]);

  // ─── HANDLE EKSPOR CSV ANALYTICS ───
  const handleExportCSV = () => {
    const headerTitle = `=== LAPORAN ANALYTICS & INSIGHT NUENIME ===\n`;
    const filterInfo = `Periode Terpilih: ${timeRange.toUpperCase()} (Dibuat pada: ${new Date().toLocaleString("id-ID")})\n\n`;

    const summarySection = [
      `--- RINGKASAN METRIK UTAMA ---`,
      `Total Pengguna Terdaftar,${kpiData.totalUsers}`,
      `Pengguna Baru Periode Ini,${kpiData.newUsers}`,
      `Pengguna Aktif Periode Ini,${kpiData.activeUsersCount}`,
      `Total Pendapatan (Revenue),Rp${kpiData.revenuePeriod}`,
      `Total Transaksi Berhasil,${kpiData.completedTxs}`,
      `Total Transaksi Pending,${kpiData.pendingTxs}`,
      `Dylan Crystal Dibeli (Minted),${kpiData.crystalsMinted}`,
      `Dylan Crystal Digunakan (Burned),${kpiData.crystalsBurnedGacha}`,
      `Total Sesi Nonton,${kpiData.totalWatchSessions}`,
      `Total Jam Nonton,${kpiData.totalHoursWatched} jam`,
      `Total Komentar,${kpiData.totalCommentsCount}`,
      `Total Likes,${kpiData.totalLikesCount}`,
      `Engagement Rate,${kpiData.engagementRate}`,
      `\n`,
    ].join("\n");

    const txHeader = `--- TRANSAKSI DALAM PERIODE ---\nID Transaksi,Username,Paket,Harga,Metode,Status,Waktu\n`;
    const txRows = filteredTransactions
      .map(
        (t) =>
          `"${t.id}","${t.username}","${t.packageName}",${t.totalPayment},"${t.paymentMethod}","${t.status}","${t.createdAt}"`
      )
      .join("\n");

    const contentHeader = `\n\n--- TOP ANIME DITONTON ---\nPeringkat,ID Anime,Judul Anime,Total Tayangan,Penonton Unik\n`;
    const contentRows = topAnimeRanking
      .map((a, idx) => `${idx + 1},${a.animeId},"${a.title}",${a.views},${a.uniqueViewers}`)
      .join("\n");

    const fullCsv = headerTitle + filterInfo + summarySection + txHeader + txRows + contentHeader + contentRows;

    if (typeof window !== "undefined" && window.navigator) {
      const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `nuenime_analytics_${timeRange}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      hapticSuccess();
      showToast("Laporan CSV berhasil diunduh!", "success");
    }
  };

  // ─── FORMAT WAKTU RELATIF ───
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return "Baru saja";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} mnt lalu`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} jam lalu`;
    const day = Math.floor(hr / 24);
    return `${day} hari lalu`;
  };

  return (
    <AdminLayout
      title="Analytics & Insight"
      subtitle="Pantau performa pengguna, aktivitas streaming, transaksi Dylan Crystal, dan agregasi data aktual Nuenime"
      mobileTitle="Analytics"
      mobileSubtitle="Metrik & Data Real-Time"
      activeKey="analytics"
    >
      {/* ─── FLOATING ACTION TOAST (PERSIS ADMIN SUPPORT & GAMIFICATION) ─── */}
      {actionToast && (
        <View
          style={[
            styles.floatingToast,
            !isWide && styles.floatingToastMobile,
            actionToast.type === "success" ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <AppIcon
            name={actionToast.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{actionToast.message}</Text>
        </View>
      )}

      {/* ─── TOP KPI STRIP (4 PILAR UTAMA - PERSIS SUPPORT & GAMIFICATION) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        {/* Pillar 1: Total Pengguna */}
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="people" size={18} color="#38BDF8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Total Pengguna</Text>
            <Text style={[styles.kpiStripVal, { color: "#38BDF8" }]} numberOfLines={1}>
              {kpiData.totalUsers.toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        {/* Pillar 2: Aktivitas Streaming */}
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(6, 182, 212, 0.15)" }]}>
            <AppIcon name="play" size={18} color="#06B6D4" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Aktivitas Tayangan</Text>
            <Text style={[styles.kpiStripVal, { color: "#06B6D4" }]} numberOfLines={1}>
              {kpiData.totalWatchSessions.toLocaleString("id-ID")} Sesi
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        {/* Pillar 3: Pendapatan Omset */}
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="card" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Omset Terverifikasi</Text>
            <Text style={[styles.kpiStripVal, { color: "#10B981" }]} numberOfLines={1}>
              Rp{kpiData.revenuePeriod.toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        {isWide && <View style={styles.kpiStripDivider} />}

        {/* Pillar 4: Sirkulasi Dylan Crystal */}
        <View style={[styles.kpiStripItem, !isWide && styles.kpiStripItemMobile]}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="sparkles" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kpiStripLabel} numberOfLines={1}>Dylan Crystal Aktif</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]} numberOfLines={1}>
              {kpiData.totalCirculatingCrystals.toLocaleString("id-ID")} DC
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER & ACTION BUTTONS (PERSIS ADMIN SUPPORT THEME) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="analytics-outline" size={16} color="#38BDF8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={styles.infoBannerTitle}>
                Pusat Metrik & Analitik Aktual Nuenime
              </Text>
              <View style={styles.liveBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveBadgeText}>LIVE METRICS</Text>
              </View>
            </View>
            <Text style={styles.infoBannerText}>
              Menghitung agregasi data aktual dari database Supabase Nuenime. Terakhir disinkronkan: {lastUpdated.toLocaleTimeString("id-ID")}.
            </Text>
          </View>
        </View>

        <View style={[styles.infoBannerActions, !isWide && styles.infoBannerActionsMobile]}>
          <TouchableOpacity
            style={[styles.primaryActionBtnSilver, !isWide && styles.primaryActionBtnSilverMobile, isRefreshing && styles.btnDisabled]}
            onPress={() => {
              hapticLight();
              loadAllAnalyticsData(true);
            }}
            disabled={isRefreshing}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <AppIcon name="refresh" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.primaryActionBtnSilverText}>
              {isRefreshing ? "Menyinkronkan..." : "Refresh Data"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.silverLiquidSecondaryBtn, !isWide && styles.silverLiquidSecondaryBtnMobile]}
            onPress={() => {
              hapticLight();
              handleExportCSV();
            }}
            activeOpacity={0.8}
          >
            <AppIcon name="download" size={16} color="#CBD5E1" />
            <Text style={styles.silverLiquidSecondaryBtnText}>Ekspor CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── GLOBAL FILTER BAR (PERSIS ADMIN SUPPORT TIER FILTER) ─── */}
      <View style={styles.filterCard}>
        <View style={[styles.filterHeaderRow, !isWide && styles.filterHeaderRowMobile]}>
          <View style={styles.filterLabelWrap}>
            <AppIcon name="calendar-outline" size={16} color="#94A3B8" />
            <Text style={styles.filterTitle}>Periode Waktu Data:</Text>
          </View>

          <View style={[styles.tierChipsRow, !isWide && styles.tierChipsRowMobile]}>
            {(
              [
                { key: "today", label: "Hari Ini" },
                { key: "7d", label: "7 Hari" },
                { key: "30d", label: "30 Hari" },
                { key: "90d", label: "90 Hari" },
                { key: "year", label: "Tahun Ini" },
                { key: "all", label: "Semua Data" },
              ] as const
            ).map((f) => {
              const isActive = timeRange === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.tierChip, isActive && styles.tierChipActive]}
                  onPress={() => {
                    hapticLight();
                    setTimeRange(f.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tierChipText,
                      isActive && styles.tierChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (CHIP STYLE SILVER LIQUID GLASS) ─── */}
      <View style={[styles.tabNavWrap, !isWide && styles.tabNavWrapMobile]}>
        {[
          { key: "overview", label: "Ringkasan & Tren", icon: "stats-chart" },
          { key: "content", label: "Streaming & Konten", icon: "play" },
          { key: "financial", label: "Finansial & Crystal", icon: "card" },
          { key: "gacha_borders", label: "Gacha & Marketplace", icon: "sparkles" },
          { key: "system_behavior", label: "Jam Sibuk & Live Feed", icon: "time" },
        ].map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabBtn,
                !isWide && styles.tabBtnMobile,
                isActive && styles.tabBtnActive,
              ]}
              onPress={() => {
                hapticLight();
                setActiveTab(t.key as AnalyticsTab);
              }}
              activeOpacity={0.8}
            >
              <AppIcon
                name={t.icon as any}
                size={15}
                color={isActive ? "#FFFFFF" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  !isWide && styles.tabBtnTextMobile,
                  isActive && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── ERROR STATE NOTIFICATION ─── */}
      {hasError && (
        <View style={styles.errorBanner}>
          <AppIcon name="warning" size={18} color="#F43F5E" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadAllAnalyticsData(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── LOADING STATE ─── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Menghitung agregasi data aktual Nuenime...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ─── TAB 1: RINGKASAN & TREN (OVERVIEW) ─── */}
          {activeTab === "overview" && (
            <View style={styles.tabContentBlock}>
              {/* 5 Top KPI Cards Grid */}
              <View style={styles.kpiGrid}>
                {/* Card 1: Pengguna */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Pertumbuhan Pengguna</Text>
                    <View style={[styles.kpiIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="people" size={18} color="#38BDF8" />
                    </View>
                  </View>
                  <Text style={styles.kpiValue}>
                    {kpiData.totalUsers.toLocaleString("id-ID")}
                  </Text>
                  <View style={styles.kpiTrendRow}>
                    <View style={styles.positiveBadge}>
                      <AppIcon name="trending-up" size={12} color="#10B981" />
                      <Text style={styles.positiveBadgeText}>
                        +{kpiData.newUsers} baru
                      </Text>
                    </View>
                    <Text style={styles.kpiMetaText}>
                      {kpiData.activeUsersCount} user aktif
                    </Text>
                  </View>
                </View>

                {/* Card 2: Streaming & Watch */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Aktivitas Streaming</Text>
                    <View style={[styles.kpiIconBox, { backgroundColor: "rgba(6, 182, 212, 0.12)" }]}>
                      <AppIcon name="play" size={18} color="#06B6D4" />
                    </View>
                  </View>
                  <Text style={styles.kpiValue}>
                    {kpiData.totalWatchSessions.toLocaleString("id-ID")}
                  </Text>
                  <View style={styles.kpiTrendRow}>
                    <View style={styles.neutralBadge}>
                      <Text style={styles.neutralBadgeText}>
                        {kpiData.totalHoursWatched} Jam
                      </Text>
                    </View>
                    <Text style={styles.kpiMetaText}>Total durasi streaming</Text>
                  </View>
                </View>

                {/* Card 3: Revenue / Finansial */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Omset Periode Terpilih</Text>
                    <View style={[styles.kpiIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                      <AppIcon name="card" size={18} color="#10B981" />
                    </View>
                  </View>
                  <Text style={styles.kpiValue}>
                    Rp{kpiData.revenuePeriod.toLocaleString("id-ID")}
                  </Text>
                  <View style={styles.kpiTrendRow}>
                    <View style={styles.positiveBadge}>
                      <Text style={styles.positiveBadgeText}>
                        {kpiData.completedTxs} tx sah
                      </Text>
                    </View>
                    <Text style={styles.kpiMetaText}>
                      {kpiData.pendingTxs > 0 ? `${kpiData.pendingTxs} pending` : "Antrean aman"}
                    </Text>
                  </View>
                </View>

                {/* Card 4: Sirkulasi Dylan Crystal */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Dylan Crystal Terjual</Text>
                    <View style={[styles.kpiIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="sparkles" size={18} color="#F59E0B" />
                    </View>
                  </View>
                  <Text style={styles.kpiValue}>
                    {kpiData.crystalsMinted.toLocaleString("id-ID")}
                  </Text>
                  <View style={styles.kpiTrendRow}>
                    <View style={styles.warningBadge}>
                      <Text style={styles.warningBadgeText}>
                        -{kpiData.crystalsBurnedGacha.toLocaleString("id-ID")} sink
                      </Text>
                    </View>
                    <Text style={styles.kpiMetaText}>Gacha & item sink</Text>
                  </View>
                </View>

                {/* Card 5: Interaksi Komunitas */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTopRow}>
                    <Text style={styles.kpiLabel}>Engagement Komunitas</Text>
                    <View style={[styles.kpiIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="chatbubble-ellipses" size={18} color="#38BDF8" />
                    </View>
                  </View>
                  <Text style={styles.kpiValue}>
                    {kpiData.totalCommentsCount.toLocaleString("id-ID")}
                  </Text>
                  <View style={styles.kpiTrendRow}>
                    <View style={styles.neutralBadge}>
                      <Text style={styles.neutralBadgeText}>
                        {kpiData.totalLikesCount} Likes
                      </Text>
                    </View>
                    <Text style={styles.kpiMetaText}>
                      Rasio {kpiData.engagementRate}/user
                    </Text>
                  </View>
                </View>
              </View>

              {/* Visual Chart 1: Pertumbuhan Pengguna (User Growth SVG Chart) */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Pertumbuhan Pengguna Baru</Text>
                    <Text style={styles.cardSubtitle}>
                      Pendaftaran akun baru Nuenime berdasarkan rentang waktu terpilih ({timeRange.toUpperCase()}).
                    </Text>
                  </View>
                  <View style={styles.cardHeaderBadge}>
                    <Text style={styles.cardHeaderBadgeText}>
                      Total {kpiData.newUsers} Pengguna Baru
                    </Text>
                  </View>
                </View>

                {/* Responsive SVG Line Chart */}
                <View style={styles.chartWrapper}>
                  <Svg width="100%" height={200} viewBox="0 0 600 200">
                    <Defs>
                      <SvgLinearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
                        <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                      </SvgLinearGradient>
                    </Defs>

                    {/* Grid Lines */}
                    <Rect x="0" y="30" width="600" height="1" fill="rgba(255,255,255,0.05)" />
                    <Rect x="0" y="80" width="600" height="1" fill="rgba(255,255,255,0.05)" />
                    <Rect x="0" y="130" width="600" height="1" fill="rgba(255,255,255,0.05)" />
                    <Rect x="0" y="180" width="600" height="1" fill="rgba(255,255,255,0.08)" />

                    {/* Hitung Titik Koordinat Poligon Area & Garis */}
                    {(() => {
                      const buckets = userGrowthChartData.buckets;
                      const max = userGrowthChartData.maxVal;
                      const count = buckets.length;
                      if (count < 2) return null;

                      const stepX = 560 / (count - 1);
                      const points = buckets.map((b, i) => {
                        const x = 20 + i * stepX;
                        const y = 170 - (b.count / max) * 130;
                        return { x, y, count: b.count, label: b.label };
                      });

                      const pathData = points
                        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
                        .join(" ");

                      const areaData = `${pathData} L ${points[points.length - 1].x} 180 L ${points[0].x} 180 Z`;

                      return (
                        <>
                          <Path d={areaData} fill="url(#growthGradient)" />
                          <Path
                            d={pathData}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          {points.map((p, i) => (
                            <React.Fragment key={i}>
                              <Circle cx={p.x} cy={p.y} r="4" fill="#0D1117" stroke="#38BDF8" strokeWidth="2" />
                              <SvgText
                                x={p.x}
                                y="196"
                                fill="#64748B"
                                fontSize="10"
                                textAnchor="middle"
                              >
                                {p.label}
                              </SvgText>
                              {p.count > 0 && (
                                <SvgText
                                  x={p.x}
                                  y={p.y - 8}
                                  fill="#F8FAFC"
                                  fontSize="10"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {p.count}
                                </SvgText>
                              )}
                            </React.Fragment>
                          ))}
                        </>
                      );
                    })()}
                  </Svg>
                </View>
              </View>

              {/* Two Column: Aktivitas Pengguna & Status Retensi */}
              <View style={styles.twoColGrid}>
                {/* Left: Aktivitas Pengguna */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Komposisi Aktivitas</Text>
                      <Text style={styles.cardSubtitle}>
                        Perbandingan volume aksi streaming, interaksi komunitas, dan transaksi.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.activityBreakdownBox}>
                    <View style={styles.activityItem}>
                      <View style={styles.activityItemTop}>
                        <View style={styles.activityDotName}>
                          <View style={[styles.dot, { backgroundColor: "#06B6D4" }]} />
                          <Text style={styles.activityName}>Streaming Video</Text>
                        </View>
                        <Text style={styles.activityVal}>
                          {kpiData.totalWatchSessions} sesi
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(100, (kpiData.totalWatchSessions / Math.max(1, kpiData.totalWatchSessions + kpiData.totalCommentsCount + kpiData.completedTxs)) * 100)}%`,
                              backgroundColor: "#06B6D4",
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.activityItem}>
                      <View style={styles.activityItemTop}>
                        <View style={styles.activityDotName}>
                          <View style={[styles.dot, { backgroundColor: "#38BDF8" }]} />
                          <Text style={styles.activityName}>Komentar & Diskusi</Text>
                        </View>
                        <Text style={styles.activityVal}>
                          {kpiData.totalCommentsCount} pesan
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(100, (kpiData.totalCommentsCount / Math.max(1, kpiData.totalWatchSessions + kpiData.totalCommentsCount + kpiData.completedTxs)) * 100)}%`,
                              backgroundColor: "#38BDF8",
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.activityItem}>
                      <View style={styles.activityItemTop}>
                        <View style={styles.activityDotName}>
                          <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                          <Text style={styles.activityName}>Transaksi Top Up</Text>
                        </View>
                        <Text style={styles.activityVal}>
                          {kpiData.completedTxs} selesai
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(100, (kpiData.completedTxs / Math.max(1, kpiData.totalWatchSessions + kpiData.totalCommentsCount + kpiData.completedTxs)) * 100)}%`,
                              backgroundColor: "#10B981",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Right: Retensi Pengguna */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Retensi & Segmentasi User</Text>
                      <Text style={styles.cardSubtitle}>
                        Rasio loyalitas pengguna baru versus pengguna kembali aktif.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.retentionMetricGrid}>
                    <View style={styles.retentionBox}>
                      <Text style={styles.retentionLabel}>Pengguna Baru</Text>
                      <Text style={[styles.retentionVal, { color: "#38BDF8" }]}>
                        {kpiData.newUsers}
                      </Text>
                      <Text style={styles.retentionSub}>Daftar di periode ini</Text>
                    </View>

                    <View style={styles.retentionBox}>
                      <Text style={styles.retentionLabel}>Pengguna Kembali</Text>
                      <Text style={[styles.retentionVal, { color: "#10B981" }]}>
                        {kpiData.returningUsersCount}
                      </Text>
                      <Text style={styles.retentionSub}>Aktif kembali berkala</Text>
                    </View>

                    <View style={styles.retentionBox}>
                      <Text style={styles.retentionLabel}>Total Terdaftar</Text>
                      <Text style={styles.retentionVal}>
                        {kpiData.totalUsers}
                      </Text>
                      <Text style={styles.retentionSub}>Seluruh akun di DB</Text>
                    </View>

                    <View style={styles.retentionBox}>
                      <Text style={styles.retentionLabel}>Akun Diblokir</Text>
                      <Text style={[styles.retentionVal, { color: "#F43F5E" }]}>
                        {kpiData.bannedUsers}
                      </Text>
                      <Text style={styles.retentionSub}>Pelanggaran aturan</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ─── TAB 2: STREAMING & KONTEN (CONTENT) ─── */}
          {activeTab === "content" && (
            <View style={styles.tabContentBlock}>
              {/* Ranking Anime Paling Banyak Ditonton */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Peringkat Anime Paling Banyak Ditonton</Text>
                    <Text style={styles.cardSubtitle}>
                      Berdasarkan data riwayat streaming aktual penonton Nuenime.
                    </Text>
                  </View>
                  <View style={styles.cardHeaderBadge}>
                    <Text style={styles.cardHeaderBadgeText}>Top 10 Konten</Text>
                  </View>
                </View>

                {topAnimeRanking.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="videocam-off-outline" size={32} color="#64748B" />
                    <Text style={styles.emptyTitle}>Belum Ada Data Streaming</Text>
                    <Text style={styles.emptySubtitle}>
                      Aktivitas menonton anime belum tercatat pada periode waktu yang dipilih.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tableWrapper}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thText, { width: 50, textAlign: "center" }]}>#</Text>
                      <Text style={[styles.thText, { flex: 2 }]}>Judul Anime</Text>
                      <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Total Tayangan</Text>
                      <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Penonton Unik</Text>
                      <Text style={[styles.thText, { width: 100, textAlign: "right" }]}>Status</Text>
                    </View>

                    {topAnimeRanking.map((anime, idx) => (
                      <View key={anime.animeId} style={styles.tableRow}>
                        <View style={[styles.tdCol, { width: 50, justifyContent: "center" }]}>
                          <View
                            style={[
                              styles.rankBadge,
                              idx === 0 && styles.rankBadge1,
                              idx === 1 && styles.rankBadge2,
                              idx === 2 && styles.rankBadge3,
                            ]}
                          >
                            <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                          </View>
                        </View>

                        <View style={[styles.tdCol, { flex: 2 }]}>
                          <Text style={styles.animeTitleText} numberOfLines={1}>
                            {anime.title}
                          </Text>
                          <Text style={styles.animeIdSubText}>ID #{anime.animeId}</Text>
                        </View>

                        <View style={[styles.tdCol, { flex: 1, alignItems: "center" }]}>
                          <Text style={styles.viewsCountText}>
                            {anime.views.toLocaleString("id-ID")}
                          </Text>
                        </View>

                        <View style={[styles.tdCol, { flex: 1, alignItems: "center" }]}>
                          <Text style={styles.viewersCountText}>
                            {anime.uniqueViewers.toLocaleString("id-ID")}
                          </Text>
                        </View>

                        <View style={[styles.tdCol, { width: 100, alignItems: "flex-end" }]}>
                          <View style={styles.activeContentBadge}>
                            <Text style={styles.activeContentBadgeText}>Populer</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Top Episodes Most Watched */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Episode dengan Kunjungan Tertinggi</Text>
                    <Text style={styles.cardSubtitle}>
                      Episode yang paling banyak diputar ulang oleh pengguna.
                    </Text>
                  </View>
                </View>

                {topEpisodeRanking.length === 0 ? (
                  <Text style={styles.emptyTextSimple}>Belum ada data rekaman episode.</Text>
                ) : (
                  <View style={styles.episodeList}>
                    {topEpisodeRanking.map((ep, idx) => (
                      <View key={idx} style={styles.episodeItemRow}>
                        <View style={styles.epLeft}>
                          <View style={styles.epBadge}>
                            <Text style={styles.epBadgeText}>EP {ep.episode}</Text>
                          </View>
                          <Text style={styles.epAnimeTitle} numberOfLines={1}>
                            {ep.title}
                          </Text>
                        </View>
                        <Text style={styles.epViewsText}>{ep.views} kali ditonton</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ─── TAB 3: FINANSIAL & CRYSTAL (FINANCIAL) ─── */}
          {activeTab === "financial" && (
            <View style={styles.tabContentBlock}>
              {/* Revenue Overview Banner */}
              <View style={styles.revenueHeroCard}>
                <View style={styles.revHeroLeft}>
                  <Text style={styles.revHeroLabel}>Total Pendapatan Terverifikasi</Text>
                  <Text style={styles.revHeroValue}>
                    Rp{kpiData.revenuePeriod.toLocaleString("id-ID")}
                  </Text>
                  <Text style={styles.revHeroSub}>
                    Dari {kpiData.completedTxs} transaksi pembayaran berhasil ({timeRange.toUpperCase()})
                  </Text>
                </View>

                <View style={styles.revHeroRight}>
                  <View style={styles.revMiniStat}>
                    <Text style={styles.revMiniLabel}>Rata-rata Transaksi</Text>
                    <Text style={styles.revMiniVal}>
                      Rp{kpiData.avgTransactionValue.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <View style={styles.revMiniStat}>
                    <Text style={styles.revMiniLabel}>Pending Verifikasi</Text>
                    <Text style={[styles.revMiniVal, { color: "#F59E0B" }]}>
                      {kpiData.pendingTxs} transaksi
                    </Text>
                  </View>
                </View>
              </View>

              {/* Two Col: Saluran Pembayaran & Sirkulasi Crystal */}
              <View style={styles.twoColGrid}>
                {/* Saluran Pembayaran Gateway */}
                <View style={styles.colCard}>
                  <Text style={styles.cardTitle}>Omset per Saluran Pembayaran</Text>
                  <Text style={styles.cardSubtitle}>
                    Penyebaran nominal uang masuk berdasarkan gateway yang dipilih user.
                  </Text>

                  <View style={styles.breakdownListBox}>
                    {Object.keys(paymentMethodStats).length === 0 ? (
                      <Text style={styles.emptyTextSimple}>Belum ada transaksi berhasil.</Text>
                    ) : (
                      Object.entries(paymentMethodStats).map(([method, data]) => {
                        const pct =
                          kpiData.revenuePeriod > 0
                            ? Math.round((data.total / kpiData.revenuePeriod) * 100)
                            : 100;
                        return (
                          <View key={method} style={styles.methodRow}>
                            <View style={styles.methodRowTop}>
                              <Text style={styles.methodNameText}>{method}</Text>
                              <Text style={styles.methodTotalText}>
                                Rp{data.total.toLocaleString("id-ID")} ({data.count} tx)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${pct}%`, backgroundColor: "#10B981" },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>

                {/* Sirkulasi Dylan Crystal */}
                <View style={styles.colCard}>
                  <Text style={styles.cardTitle}>Aliran Ekonomi Dylan Crystal</Text>
                  <Text style={styles.cardSubtitle}>
                    Pencetakan token dari Top Up vs Pembakaran token via gacha/fitur.
                  </Text>

                  <View style={styles.crystalFlowContainer}>
                    <View style={styles.crystalFlowCard}>
                      <View style={styles.cfTop}>
                        <AppIcon name="add-circle" size={16} color="#10B981" />
                        <Text style={styles.cfTitle}>Crystal Dicetak (Top Up)</Text>
                      </View>
                      <Text style={[styles.cfValue, { color: "#10B981" }]}>
                        +{kpiData.crystalsMinted.toLocaleString("id-ID")}
                      </Text>
                      <Text style={styles.cfDesc}>Dari transaksi terverifikasi</Text>
                    </View>

                    <View style={styles.crystalFlowCard}>
                      <View style={styles.cfTop}>
                        <AppIcon name="flame" size={16} color="#F59E0B" />
                        <Text style={styles.cfTitle}>Crystal Dibakar (Sink)</Text>
                      </View>
                      <Text style={[styles.cfValue, { color: "#F59E0B" }]}>
                        -{kpiData.crystalsBurnedGacha.toLocaleString("id-ID")}
                      </Text>
                      <Text style={styles.cfDesc}>Ditarik dari sistem gacha</Text>
                    </View>

                    <View style={[styles.crystalFlowCard, { backgroundColor: "rgba(56, 189, 248, 0.05)" }]}>
                      <View style={styles.cfTop}>
                        <AppIcon name="wallet" size={16} color="#38BDF8" />
                        <Text style={styles.cfTitle}>Net Sirkulasi Akun Pengguna</Text>
                      </View>
                      <Text style={[styles.cfValue, { color: "#38BDF8" }]}>
                        {kpiData.totalCirculatingCrystals.toLocaleString("id-ID")} Crystal
                      </Text>
                      <Text style={styles.cfDesc}>Saldo beredar di database</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ─── TAB 4: GACHA & MARKETPLACE BORDERS (GACHA_BORDERS) ─── */}
          {activeTab === "gacha_borders" && (
            <View style={styles.tabContentBlock}>
              <View style={styles.twoColGrid}>
                {/* Left: Gacha Rarity Distribution */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Distribusi Rarity Item Gacha</Text>
                      <Text style={styles.cardSubtitle}>
                        Total tarikan gacha: {filteredGachaTxs.length} pull tercatat.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rarityList}>
                    {[
                      { name: "Mythic", color: "#EC4899", count: gachaRarityStats.Mythic },
                      { name: "Legends", color: "#F59E0B", count: gachaRarityStats.Legends },
                      { name: "Epic", color: "#38BDF8", count: gachaRarityStats.Epic },
                      { name: "Rare", color: "#10B981", count: gachaRarityStats.Rare },
                      { name: "Normal", color: "#94A3B8", count: gachaRarityStats.Normal },
                    ].map((r) => {
                      const pct =
                        filteredGachaTxs.length > 0
                          ? Math.round((r.count / filteredGachaTxs.length) * 100)
                          : 0;
                      return (
                        <View key={r.name} style={styles.rarityItemRow}>
                          <View style={styles.rarityTop}>
                            <View style={styles.rarityNameBox}>
                              <View style={[styles.dot, { backgroundColor: r.color }]} />
                              <Text style={styles.rarityNameText}>{r.name}</Text>
                            </View>
                            <Text style={styles.rarityValText}>
                              {r.count} item ({pct}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${pct}%`, backgroundColor: r.color },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Right: Border Marketplace Catalog Breakdown */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Katalog Border Avatar Aktif</Text>
                      <Text style={styles.cardSubtitle}>
                        Total {borders.length} border terkonfigurasi di Supabase.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rarityList}>
                    {[
                      { name: "Mythic", color: "#EC4899", count: borderRarityCount.Mythic },
                      { name: "Legends", color: "#F59E0B", count: borderRarityCount.Legends },
                      { name: "Epic", color: "#38BDF8", count: borderRarityCount.Epic },
                      { name: "Rare", color: "#10B981", count: borderRarityCount.Rare },
                      { name: "Normal", color: "#94A3B8", count: borderRarityCount.Normal },
                    ].map((r) => {
                      const pct =
                        borders.length > 0
                          ? Math.round((r.count / borders.length) * 100)
                          : 0;
                      return (
                        <View key={r.name} style={styles.rarityItemRow}>
                          <View style={styles.rarityTop}>
                            <View style={styles.rarityNameBox}>
                              <View style={[styles.dot, { backgroundColor: r.color }]} />
                              <Text style={styles.rarityNameText}>{r.name}</Text>
                            </View>
                            <Text style={styles.rarityValText}>
                              {r.count} border ({pct}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${pct}%`, backgroundColor: r.color },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ─── TAB 5: JAM SIBUK & LIVE FEED (SYSTEM_BEHAVIOR) ─── */}
          {activeTab === "system_behavior" && (
            <View style={styles.tabContentBlock}>
              {/* Peak Time Cards */}
              <View style={styles.twoColGrid}>
                {/* Left: Peak Days */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Hari Paling Aktif (Peak Days)</Text>
                      <Text style={styles.cardSubtitle}>
                        Puncak hari: <Text style={{ color: "#38BDF8", fontWeight: "bold" }}>{peakTimeStats.peakDay}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.peakDaysRow}>
                    {peakTimeStats.dayLabels.map((lbl, idx) => {
                      const count = peakTimeStats.daysCount[idx];
                      const pct = Math.round((count / peakTimeStats.maxDayVal) * 100);
                      const isHighest = count === peakTimeStats.maxDayVal && count > 0;
                      return (
                        <View key={lbl} style={styles.peakDayCol}>
                          <View style={styles.peakDayBarContainer}>
                            <View
                              style={[
                                styles.peakDayBarFill,
                                {
                                  height: `${Math.max(10, pct)}%`,
                                  backgroundColor: isHighest ? "#38BDF8" : "rgba(56, 189, 248, 0.3)",
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.peakDayLabel, isHighest && { color: "#38BDF8", fontWeight: "bold" }]}>
                            {lbl}
                          </Text>
                          <Text style={styles.peakDayCountText}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Right: Peak Hours & Admin Activity */}
                <View style={styles.colCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Staf Admin Paling Aktif</Text>
                      <Text style={styles.cardSubtitle}>
                        Berdasarkan riwayat audit log administrasi terbaru.
                      </Text>
                    </View>
                  </View>

                  {topActiveAdmins.length === 0 ? (
                    <Text style={styles.emptyTextSimple}>Belum ada aktivitas admin tercatat.</Text>
                  ) : (
                    <View style={styles.adminRankList}>
                      {topActiveAdmins.map((adm, idx) => (
                        <View key={idx} style={styles.adminRankRow}>
                          <View style={styles.adminRankLeft}>
                            <View style={styles.adminRankNum}>
                              <Text style={styles.adminRankNumText}>{idx + 1}</Text>
                            </View>
                            <View>
                              <Text style={styles.adminRankName}>{adm.username}</Text>
                              <Text style={styles.adminRankRole}>{adm.role}</Text>
                            </View>
                          </View>
                          <View style={styles.adminRankBadge}>
                            <Text style={styles.adminRankBadgeText}>
                              {adm.count} aksi
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Live Realtime Activity Feed */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.liveFeedHeaderLeft}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.cardTitle}>Live Event Feed (Aktivitas Sistem Aktual)</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    Memantau 8 peristiwa terakhir di ekosistem Nuenime secara otomatis.
                  </Text>
                </View>

                <View style={styles.liveFeedList}>
                  {liveActivityFeed.length === 0 ? (
                    <Text style={styles.emptyTextSimple}>Belum ada event tercatat.</Text>
                  ) : (
                    liveActivityFeed.map((ev) => (
                      <View key={ev.id} style={styles.liveFeedItem}>
                        <View style={styles.liveFeedLeft}>
                          <View
                            style={[
                              styles.liveFeedBadge,
                              {
                                backgroundColor: `${ev.badgeColor}1A`,
                                borderColor: `${ev.badgeColor}4D`,
                              },
                            ]}
                          >
                            <Text style={[styles.liveFeedBadgeText, { color: ev.badgeColor }]}>
                              {ev.badge}
                            </Text>
                          </View>
                          <View style={styles.liveFeedTextWrap}>
                            <Text style={styles.liveFeedItemTitle}>{ev.title}</Text>
                            <Text style={styles.liveFeedItemDesc}>{ev.description}</Text>
                          </View>
                        </View>
                        <Text style={styles.liveFeedTimeText}>{formatTimeAgo(ev.timestamp)}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </AdminLayout>
  );
}

// ─── STYLESHEET RESMI MENGIKUTI ADMIN SUPPORT & GAMIFICATION (OBSIDIAN DARK & ZERO PURPLE) ───
const styles = StyleSheet.create({
  // ── Top KPI Strip (Persis Admin Gamification & Support)
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

  // ── Info Banner (Persis Admin Support Theme)
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
  infoBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoBannerActionsMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },

  // ── Silver Liquid Glass Buttons (Persis Support & Gamification)
  primaryActionBtnSilver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnSilverMobile: {
    width: "100%",
    paddingVertical: 10,
  },
  primaryActionBtnSilverText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  silverLiquidSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  silverLiquidSecondaryBtnMobile: {
    width: "100%",
    paddingVertical: 10,
  },
  silverLiquidSecondaryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // ── Global Filter Bar & Tier Chips (Persis Support Filter Theme)
  filterCard: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  filterHeaderRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  filterLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
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
    paddingHorizontal: 11,
    paddingVertical: 6,
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

  // ── Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#F43F5E",
  },
  retryBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
  },

  // ── Loading & Content Wrap
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
  tabContentBlock: {
    gap: 16,
  },

  // ── Live Badge
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveBadgeText: {
    color: "#10B981",
    fontSize: 9.5,
    fontFamily: "Nunito-Black",
    letterSpacing: 0.5,
  },

  // ── Generic Card (Obsidian Theme #0D1117)
  card: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 18,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8,
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
  cardHeaderBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  cardHeaderBadgeText: {
    color: "#38BDF8",
    fontSize: 11,
    fontFamily: "Nunito-Bold",
  },

  // ── KPI Mini Grid (5 Pilar Overview)
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 16,
    justifyContent: "space-between",
  },
  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  kpiLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  kpiTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  positiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positiveBadgeText: {
    color: "#10B981",
    fontSize: 10.5,
    fontFamily: "Nunito-Bold",
  },
  warningBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warningBadgeText: {
    color: "#F59E0B",
    fontSize: 10.5,
    fontFamily: "Nunito-Bold",
  },
  neutralBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  neutralBadgeText: {
    color: "#CBD5E1",
    fontSize: 10.5,
    fontFamily: "Nunito-Bold",
  },
  kpiMetaText: {
    fontSize: 11,
    fontFamily: "Nunito-Regular",
    color: "#64748B",
  },

  // ── Two Column Grid
  twoColGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  colCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 18,
  },

  // ── Chart Wrapper
  chartWrapper: {
    marginTop: 8,
    overflow: "hidden",
  },

  // ── Activity Breakdown
  activityBreakdownBox: {
    gap: 14,
    marginTop: 12,
  },
  activityItem: {
    gap: 6,
  },
  activityItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityDotName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  activityName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  activityVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // ── Retention Grid
  retentionMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  retentionBox: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 12,
  },
  retentionLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  retentionVal: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    marginTop: 4,
  },
  retentionSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
  },

  // ── Table Styling (Top Anime)
  tableWrapper: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  thText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  tdCol: {
    flexDirection: "column",
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge1: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  rankBadge2: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    borderWidth: 1,
    borderColor: "#94A3B8",
  },
  rankBadge3: {
    backgroundColor: "rgba(180, 83, 9, 0.2)",
    borderWidth: 1,
    borderColor: "#B45309",
  },
  rankBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#FFFFFF",
  },
  animeTitleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  animeIdSubText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  viewsCountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
  },
  viewersCountText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
  },
  activeContentBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  activeContentBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
  },

  // ── Episodes List
  episodeList: {
    gap: 8,
    marginTop: 10,
  },
  episodeItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  epLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  epBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  epBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  epAnimeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#E2E8F0",
    flex: 1,
  },
  epViewsText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  // ── Financial Hero Card
  revenueHeroCard: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 14,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  revHeroLeft: {
    flex: 1,
    minWidth: 260,
  },
  revHeroLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#10B981",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  revHeroValue: {
    fontFamily: "Nunito-Black",
    fontSize: 28,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  revHeroSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  revHeroRight: {
    flexDirection: "row",
    gap: 20,
    flexWrap: "wrap",
  },
  revMiniStat: {
    gap: 4,
  },
  revMiniLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  revMiniVal: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },

  // ── Breakdown List Box
  breakdownListBox: {
    gap: 12,
    marginTop: 12,
  },
  methodRow: {
    gap: 6,
  },
  methodRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  methodNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  methodTotalText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  // ── Crystal Flow Container
  crystalFlowContainer: {
    gap: 10,
    marginTop: 12,
  },
  crystalFlowCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  cfTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cfTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  cfValue: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
  },
  cfDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  // ── Rarity List
  rarityList: {
    gap: 12,
    marginTop: 12,
  },
  rarityItemRow: {
    gap: 6,
  },
  rarityTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rarityNameBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rarityNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  rarityValText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },

  // ── Peak Days
  peakDaysRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  peakDayCol: {
    alignItems: "center",
    flex: 1,
  },
  peakDayBarContainer: {
    width: 18,
    height: 90,
    justifyContent: "flex-end",
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    overflow: "hidden",
  },
  peakDayBarFill: {
    width: "100%",
    borderRadius: 6,
  },
  peakDayLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
  },
  peakDayCountText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  // ── Admin Ranking
  adminRankList: {
    gap: 10,
    marginTop: 12,
  },
  adminRankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  adminRankLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adminRankNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  adminRankNumText: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  adminRankName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F8FAFC",
  },
  adminRankRole: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  adminRankBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adminRankBadgeText: {
    color: "#E2E8F0",
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },

  // ── Live Feed
  liveFeedHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveFeedList: {
    gap: 10,
    marginTop: 14,
  },
  liveFeedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  liveFeedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  liveFeedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  liveFeedBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
  },
  liveFeedTextWrap: {
    flex: 1,
  },
  liveFeedItemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F8FAFC",
  },
  liveFeedItemDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  liveFeedTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  // ── Empty States
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#E2E8F0",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 360,
  },
  emptyTextSimple: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
    paddingVertical: 12,
  },
});
