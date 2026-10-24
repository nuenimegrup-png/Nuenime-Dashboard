/** Cooldown periods in seconds */
export const BANNER_COOLDOWN_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const NAME_COOLDOWN_SECONDS = 14 * 24 * 60 * 60;  // 14 days
export const AVATAR_COOLDOWN_SECONDS = 3 * 24 * 60 * 60; // 3 days

/** Format duration in Indonesian language */
export function formatDurationIndonesian(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} menit`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)} jam`;
  return `${Math.ceil(seconds / 86400)} hari`;
}

type ValidateResult = { valid: boolean; error?: string; cleanUrl: string };

/** Validate an image URL */
export function validateImageUrl(url: string): ValidateResult {
  const clean = url.trim();
  if (!clean) return { valid: false, error: "URL tidak boleh kosong.", cleanUrl: "" };
  if (!/^https?:\/\//i.test(clean)) {
    return { valid: false, error: "URL harus diawali dengan https://", cleanUrl: clean };
  }
  if (clean.length > 2048) {
    return { valid: false, error: "URL terlalu panjang.", cleanUrl: clean };
  }
  return { valid: true, cleanUrl: clean };
}

export type CooldownStatus = {
  canChange: boolean;
  remainingSeconds: number;
  /** Human-readable remaining time label (Indonesian) */
  remainingLabel: string;
  /** Alias of remainingLabel for compatibility */
  remainingText: string;
  label: string;
};

/** Get profile cooldown status for a given field */
export function getProfileCooldownStatus(
  updatedAt: string | null | undefined,
  cooldownSeconds: number,
  type: "name" | "avatar" | "banner"
): CooldownStatus {
  const labels = { name: "Nama", avatar: "Avatar", banner: "Banner" };
  if (!updatedAt) {
    return { canChange: true, remainingSeconds: 0, remainingLabel: "-", remainingText: "-", label: labels[type] };
  }
  const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  const remaining = Math.max(0, cooldownSeconds - elapsed);
  const text = remaining > 0 ? formatDurationIndonesian(Math.ceil(remaining)) : "Sudah bisa diubah";
  return {
    canChange: remaining === 0,
    remainingSeconds: Math.ceil(remaining),
    remainingLabel: text,
    remainingText: text,
    label: labels[type],
  };
}
