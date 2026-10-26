import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import type { AdminUser } from "@/lib/admin-service";
import { authenticateAdmin, STORAGE_ADMIN_SESSION } from "@/lib/admin-auth-service";

export { STORAGE_ADMIN_SESSION };

interface AdminLoginProps {
  onLoginSuccess: (admin: AdminUser) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 500;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      hapticWarning();
      setErrorMessage("Silakan masukkan email / username dan kata sandi.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    hapticLight();

    const res = await authenticateAdmin(email.trim(), password.trim());
    setLoading(false);

    if (res.success && res.user) {
      hapticSuccess();
      onLoginSuccess(res.user);
    } else {
      hapticWarning();
      setErrorMessage(res.error || "Kredensial tidak valid.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Web Specific Style to Prevent Autofill White Box and Prevent Screen Wobble */}
      {Platform.OS === "web" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Menghilangkan kotak putih autofill Safari / Chrome */
              input:-webkit-autofill,
              input:-webkit-autofill:hover, 
              input:-webkit-autofill:focus, 
              input:-webkit-autofill:active {
                -webkit-box-shadow: 0 0 0 1000px #0F121A inset !important;
                -webkit-text-fill-color: #FFFFFF !important;
                caret-color: #FFFFFF !important;
                transition: background-color 5000s ease-in-out 0s;
                border-radius: 8px;
              }
              /* Mencegah layar goyang / geser horizontal di mobile */
              html, body, #root {
                overflow-x: hidden !important;
                overscroll-behavior: none !important;
                touch-action: pan-y !important;
                position: fixed;
                width: 100%;
                height: 100%;
              }
            `,
          }}
        />
      )}

      {/* Background radial glow - ukuran pas agar tidak melebar keluar layar */}
      <View style={[styles.glowCircle, isMobile && styles.glowCircleMobile]} pointerEvents="none" />

      {/* Background Mascot Anime Banner */}
      <Image
        source={require("@/assets/images/admin-login-banner.png")}
        style={styles.bgBanner}
        contentFit="cover"
        contentPosition="bottom center"
        pointerEvents="none"
        priority="high"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, isMobile && styles.cardMobile]}>
            {/* Header Branding with Nuenime Logo */}
            <View style={styles.header}>
              <Image
                source={require("@/assets/images/nuenime-logo.png")}
                style={[styles.logoImage, isMobile && styles.logoImageMobile]}
                contentFit="contain"
                transition={200}
              />
              <Text style={styles.portalTag}>PORTAL ADMIN NUENIME</Text>
              <Text style={styles.title}>Masuk ke Dashboard</Text>
              <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
                Akses kontrol panel terpusat. Masukkan kredensial akun admin Anda.
              </Text>
            </View>

            {/* Error Notification */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <AppIcon name="alert-circle-outline" size={17} color="#F87171" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Form Inputs */}
            <View style={styles.form}>
              {/* Email / Username Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ATAU USERNAME</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedInput === "email" && styles.inputWrapFocused,
                  ]}
                >
                  <AppIcon
                    name="account-circle-outline"
                    size={19}
                    color={focusedInput === "email" ? "#38BDF8" : "#94A3B8"}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="nama@nuenime.com atau username"
                    placeholderTextColor="#64748B"
                    value={email}
                    onFocus={() => setFocusedInput("email")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    selectionColor="#38BDF8"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>KATA SANDI</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedInput === "password" && styles.inputWrapFocused,
                  ]}
                >
                  <AppIcon
                    name="lock-outline"
                    size={19}
                    color={focusedInput === "password" ? "#38BDF8" : "#94A3B8"}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Masukkan kata sandi akun"
                    placeholderTextColor="#64748B"
                    value={password}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor="#38BDF8"
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    accessibilityLabel="Toggle kata sandi"
                    hitSlop={8}
                  >
                    <AppIcon
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#94A3B8"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Liquid Glass Theme Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.liquidGlassBtn,
                  loading && styles.liquidGlassBtnDisabled,
                  pressed && styles.liquidGlassBtnPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <AppIcon name="shield-check-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.liquidGlassBtnText}>Masuk ke Dashboard</Text>
                    <AppIcon name="arrow-right" size={16} color="#E2E8F0" />
                  </>
                )}
              </Pressable>
            </View>

            {/* Security Footer Notice */}
            <View style={styles.footer}>
              <AppIcon name="shield-check" size={14} color="#10B981" />
              <Text style={styles.footerText}>
                Enkripsi Sesi 256-bit • Role terverifikasi otomatis oleh sistem
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
  },
  keyboardWrap: {
    flex: 1,
    width: "100%",
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    paddingVertical: 32,
  },
  scrollContentMobile: {
    padding: 14,
    paddingVertical: 18,
  },
  glowCircle: {
    position: "absolute",
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: "rgba(140, 87, 255, 0.08)",
    top: "10%",
    alignSelf: "center",
  },
  glowCircleMobile: {
    width: 320,
    height: 320,
    borderRadius: 160,
    top: "15%",
  },
  bgBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    opacity: 0.8,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "rgba(20, 24, 34, 0.92)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 14,
    zIndex: 10,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  cardMobile: {
    padding: 20,
    paddingVertical: 24,
    borderRadius: 18,
    maxWidth: 380,
    backgroundColor: "rgba(18, 22, 32, 0.95)",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  logoImage: {
    width: 160,
    height: 50,
    marginBottom: 8,
  },
  logoImageMobile: {
    width: 135,
    height: 42,
    marginBottom: 6,
  },
  portalTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#CBD5E1",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Nunito-Black",
    fontSize: 21,
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 17,
  },
  subtitleMobile: {
    fontSize: 11.5,
    lineHeight: 16,
    maxWidth: 280,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F87171",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#A098AE",
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F121A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: "rgba(56, 189, 248, 0.55)",
    backgroundColor: "#111622",
  },
  textInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          backgroundColor: "transparent",
        } as any)
      : {}),
  },
  eyeBtn: {
    padding: 6,
  },
  liquidGlassBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        } as any)
      : {}),
  },
  liquidGlassBtnDisabled: {
    opacity: 0.5,
  },
  liquidGlassBtnPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.38)",
    transform: [{ scale: 0.99 }],
  },
  liquidGlassBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    textAlign: "center",
  },
});
