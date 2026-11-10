import { supabase } from "@/lib/supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  channelId?: string;
  sound?: "default" | null;
  data?: Record<string, unknown>;
};

/**
 * Mengirim push notification langsung ke server Expo Push Service / Google FCM.
 * Pesan ini diteruskan langsung oleh Google ke perangkat Android
 * walaupun aplikasi Nuenime sedang ditutup total.
 */
export async function sendExpoPush(
  targets: string | string[],
  payload: PushPayload
): Promise<boolean> {
  const tokenList = Array.isArray(targets) ? targets : [targets];
  const validTokens = tokenList.filter(
    (t) => typeof t === "string" && (t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"))
  );

  if (validTokens.length === 0) return false;

  const chunkSize = 100;
  for (let i = 0; i < validTokens.length; i += chunkSize) {
    const chunk = validTokens.slice(i, i + chunkSize);
    const messages = chunk.map((to) => ({
      to,
      sound: payload.sound ?? "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: "high",
      channelId: payload.channelId || "nuenime_system",
    }));

    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      console.warn("[AdminPushService] Error dispatching push chunk:", err);
    }
  }

  return true;
}

/** Send a push notification to a specific user via Expo Push API */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    if (error || !data?.push_token) return;
    await sendExpoPush(data.push_token, payload);
  } catch (err) {
    console.warn("[AdminPushService] Failed to send push to user:", err);
  }
}

/** Broadcast a push notification to all users via Expo Push API */
export async function sendPushToAllUsers(payload: PushPayload): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .not("push_token", "is", null);

    if (error || !data || data.length === 0) return;

    const allTokens = data.map((d) => d.push_token).filter(Boolean) as string[];
    await sendExpoPush(allTokens, payload);
  } catch (err) {
    console.warn("[AdminPushService] Failed to broadcast push:", err);
  }
}
