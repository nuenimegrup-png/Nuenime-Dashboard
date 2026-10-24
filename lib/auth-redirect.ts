import { Platform } from "react-native";

/** OAuth redirect URL used for email verification and password recovery. */
export const ANIRAKU_AUTH_REDIRECT_URL: string =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? "https://nuenime.app/auth/callback";
