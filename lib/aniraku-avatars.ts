const DEFAULT_AVATAR_BASE = "https://api.dicebear.com/7.x/thumbs/svg?seed=";
const DEFAULT_AVATAR_MARKER = "dicebear.com";

/** Returns a default avatar object for a given seed. */
export function defaultAvatar(seed: number | string): { url: string } {
  return { url: `${DEFAULT_AVATAR_BASE}${seed}` };
}

/** Returns true if the URL is a generated default (dicebear) avatar. */
export function isDefaultAvatar(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes(DEFAULT_AVATAR_MARKER);
}
