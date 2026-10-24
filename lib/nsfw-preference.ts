import AsyncStorage from "@react-native-async-storage/async-storage";

const NSFW_KEY = "@nuenime_admin_nsfw_enabled";

/** Read the NSFW content preference (admin setting). */
export async function readNsfwPreference(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NSFW_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/** Write the admin NSFW content preference. Returns success/error status. */
export async function writeAdminNsfwPreference(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await AsyncStorage.setItem(NSFW_KEY, enabled ? "true" : "false");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Gagal menyimpan preferensi." };
  }
}
