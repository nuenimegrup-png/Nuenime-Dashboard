import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Nuenime Admin Portal",
  slug: "admin-nuenime",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "dark",
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/icon.png",
  },
  android: {
    package: "com.nuenime.admin",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#080B10",
    },
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-font",
    "expo-web-browser",
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
