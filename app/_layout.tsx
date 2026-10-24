import { useState, useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/app-providers";

const APP_BG_COLOR = "#0B0E14";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Nunito-Regular": require("../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../assets/fonts/Nunito-ExtraBold.ttf"),
    "Nunito-Black": require("../assets/fonts/Nunito-Black.ttf"),
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(APP_BG_COLOR).catch(() => {});
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG_COLOR }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_BG_COLOR }}>
      <SafeAreaProvider>
        <AppProviders>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: APP_BG_COLOR },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="admin/index" />
            <Stack.Screen name="admin/finance" />
            <Stack.Screen name="admin/users" />
            <Stack.Screen name="admin/borders" />
            <Stack.Screen name="admin/gacha" />
            <Stack.Screen name="admin/gamification" />
            <Stack.Screen name="admin/community" />
            <Stack.Screen name="admin/cms" />
            <Stack.Screen name="admin/system" />
            <Stack.Screen name="admin/analytics" />
            <Stack.Screen name="admin/developers" />
            <Stack.Screen name="admin/audit" />
            <Stack.Screen name="admin/support" />
            <Stack.Screen name="admin/settings" />
          </Stack>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
