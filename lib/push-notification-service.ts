import { supabase } from "@/lib/supabase";

type PushPayload = {
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
};

/** Send a push notification to a specific user via Supabase Edge Function. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: { userId, ...payload },
    });
  } catch {
    // Non-critical: silently fail
  }
}

/** Broadcast a push notification to all users via Supabase Edge Function. */
export async function sendPushToAllUsers(payload: PushPayload): Promise<void> {
  try {
    await supabase.functions.invoke("send-push-notification-all", {
      body: payload,
    });
  } catch {
    // Non-critical: silently fail
  }
}
