import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Picker } from "@react-native-picker/picker";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "signin" | "signup";

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Chinese", value: "zh" },
  { label: "Dutch", value: "nl" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Polish", value: "pl" },
  { label: "Portuguese", value: "pt" },
  { label: "Russian", value: "ru" },
  { label: "Spanish", value: "es" },
];

export default function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    if (mode === "signup" && !firstName) {
      Alert.alert("Error", "Please enter your first name.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, firstName);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await signIn(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Authentication failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "podbrief",
        path: "auth/callback",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url!,
        redirectUrl
      );

      if (result.type === "success") {
        const url = new URL(result.url);
        const accessTokenMatch = url.hash.match(/access_token=([^&]*)/);
        const refreshTokenMatch = url.hash.match(/refresh_token=([^&]*)/);

        if (accessTokenMatch && refreshTokenMatch) {
          await supabase.auth.setSession({
            access_token: accessTokenMatch[1],
            refresh_token: refreshTokenMatch[1],
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error: any) {
      console.error("Google sign in error:", error);
      Alert.alert("Error", "Google sign in failed. Please try again.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert("Success", "Password reset email sent. Please check your inbox.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send reset email.");
    }
  };

  const openLink = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: theme.backgroundCard }]}>
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="h2" style={styles.title}>
              {mode === "signin" ? "Welcome Back" : "Create Your Account"}
            </ThemedText>
            <ThemedText type="small" style={styles.subtitle}>
              {mode === "signin"
                ? "Sign in to access your library"
                : "Get your first 5 briefs free"}
            </ThemedText>
          </View>

          <Pressable
            onPress={handleGoogleSignIn}
            style={styles.googleButton}
          >
            <View style={styles.googleIconContainer}>
              <ThemedText style={styles.googleIcon}>G</ThemedText>
            </View>
            <ThemedText type="body" style={styles.googleText}>
              Continue with Google
            </ThemedText>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText type="caption" style={styles.dividerText}>
              {mode === "signin" ? "OR" : "OR CONTINUE WITH EMAIL"}
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.form}>
            {mode === "signup" ? (
              <>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="First Name *"
                    placeholderTextColor="#6B7280"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Feather name="globe" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={styles.label}>
                      Preferred Language
                    </ThemedText>
                  </View>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={preferredLanguage}
                      onValueChange={(value: string) => setPreferredLanguage(value)}
                      style={styles.picker}
                      dropdownIconColor="#6B7280"
                    >
                      {LANGUAGES.map((lang) => (
                        <Picker.Item
                          key={lang.value}
                          label={lang.label}
                          value={lang.value}
                          color="#000000"
                        />
                      ))}
                    </Picker>
                  </View>
                  <ThemedText type="caption" style={styles.languageHint}>
                    This is the language that we will use to generate your AI summaries. 
                    This can also be updated in your Settings page after logging in.
                  </ThemedText>
                </View>
              </>
            ) : null}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={mode === "signup" ? "Email *" : "Email"}
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputWrapper}>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={mode === "signup" ? "Password *" : "Password"}
                  placeholderTextColor="#6B7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <Pressable 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#6B7280"
                  />
                </Pressable>
              </View>
            </View>

            {mode === "signin" ? (
              <Pressable onPress={handleForgotPassword} style={styles.forgotPassword}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Forgot password?
                </ThemedText>
              </Pressable>
            ) : null}

            <Button onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? "Loading..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>

            <Pressable
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              style={styles.switchMode}
            >
              <ThemedText type="small">
                {mode === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.linkSecondary }}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText type="caption" style={styles.footerText}>
            By continuing, you agree to our{" "}
          </ThemedText>
          <Pressable onPress={() => openLink("https://podbrief.io/terms")}>
            <ThemedText type="caption" style={[styles.footerLink, { color: theme.linkSecondary }]}>
              Terms of Service
            </ThemedText>
          </Pressable>
          <ThemedText type="caption" style={styles.footerText}>
            {" "}and{" "}
          </ThemedText>
          <Pressable onPress={() => openLink("https://podbrief.io/privacy")}>
            <ThemedText type="caption" style={[styles.footerLink, { color: theme.linkSecondary }]}>
              Privacy Policy
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FFFFFF",
    gap: Spacing.sm,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
    fontFamily: "GoogleSansFlex",
  },
  googleText: {
    fontWeight: "500",
    color: "#000000",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  form: {
    gap: Spacing.md,
  },
  inputWrapper: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  label: {
    opacity: 0.7,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 16,
    fontFamily: "GoogleSansFlex",
    borderWidth: 1,
    borderColor: "#394256",
  },
  pickerWrapper: {
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#394256",
    overflow: "hidden",
  },
  picker: {
    height: Spacing.inputHeight,
    color: "#000000",
  },
  languageHint: {
    opacity: 0.6,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#394256",
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.md,
    color: "#000000",
    fontSize: 16,
    fontFamily: "GoogleSansFlex",
  },
  eyeButton: {
    paddingHorizontal: Spacing.md,
    height: "100%",
    justifyContent: "center",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  footerText: {
    opacity: 0.5,
  },
  footerLink: {
    textDecorationLine: "underline",
  },
});
