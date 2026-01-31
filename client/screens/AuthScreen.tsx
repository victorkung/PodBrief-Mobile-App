import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import { Picker } from "@react-native-picker/picker";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "signin" | "signup";
type AuthScreenRouteProp = RouteProp<RootStackParamList, "Auth">;

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

const BACKGROUND_COLOR = "#0D1117";

export default function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const route = useRoute<AuthScreenRouteProp>();
  const initialMode = route.params?.mode || "signin";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (mode === "signup" && !firstName.trim()) {
      Alert.alert("Error", "Please enter your first name.");
      return;
    }
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, firstName, preferredLanguage);
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

  const openTerms = () => {
    Linking.openURL("https://podbrief.io/terms");
  };

  const openPrivacy = () => {
    Linking.openURL("https://podbrief.io/privacy");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter Email", "Please enter your email address first.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert("Check Your Email", "We've sent you a password reset link.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send reset email.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
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
          <View style={styles.centeredContent}>
            <View style={styles.header}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <ThemedText type="h2" style={styles.title}>
                {mode === "signin" ? "Welcome Back" : "Create Your Account"}
              </ThemedText>
              <ThemedText type="body" style={styles.subtitle}>
                {mode === "signin"
                  ? "Sign in to access your library"
                  : "Get your first 5 briefs free"}
              </ThemedText>
            </View>

            <View style={styles.form}>
              <Pressable
                onPress={handleGoogleSignIn}
                style={[
                  styles.googleButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="globe" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.googleText}>
                  Continue with Google
                </ThemedText>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <ThemedText type="small" style={styles.dividerText}>
                  {mode === "signin" ? "OR" : "OR CONTINUE WITH EMAIL"}
                </ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {mode === "signup" ? (
                <>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Feather name="user" size={20} color={theme.textTertiary} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="First Name *"
                      placeholderTextColor={theme.textTertiary}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.languageSection}>
                    <View style={styles.labelRow}>
                      <Feather name="globe" size={16} color={theme.textSecondary} />
                      <ThemedText type="small" style={styles.labelText}>
                        Preferred Language
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.pickerContainer,
                        { backgroundColor: theme.backgroundSecondary },
                      ]}
                    >
                      <Picker
                        selectedValue={preferredLanguage}
                        onValueChange={(value) => setPreferredLanguage(value)}
                        style={[styles.picker, { color: theme.text }]}
                        dropdownIconColor={theme.textSecondary}
                      >
                        {LANGUAGES.map((lang) => (
                          <Picker.Item
                            key={lang.value}
                            label={lang.label}
                            value={lang.value}
                            color={Platform.OS === "ios" ? theme.text : undefined}
                          />
                        ))}
                      </Picker>
                    </View>
                    <ThemedText type="caption" style={styles.languageHint}>
                      This is the language that we will use to generate your AI
                      summaries. This can also be updated in your Settings page
                      after logging in.
                    </ThemedText>
                  </View>
                </>
              ) : null}

              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="mail" size={20} color={theme.textTertiary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={mode === "signup" ? "Email *" : "Email"}
                  placeholderTextColor={theme.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="lock" size={20} color={theme.textTertiary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={mode === "signup" ? "Password *" : "Password"}
                  placeholderTextColor={theme.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.textTertiary}
                  />
                </Pressable>
              </View>

              {mode === "signin" ? (
                <Pressable onPress={handleForgotPassword} style={styles.forgotPassword}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Forgot password?
                  </ThemedText>
                </Pressable>
              ) : null}

              <Button onPress={handleSubmit} disabled={isLoading}>
                {isLoading
                  ? "Loading..."
                  : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
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
                <ThemedText type="link" style={styles.switchModeLink}>
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <ThemedText type="caption" style={styles.footerText}>
                By continuing, you agree to our{" "}
                <ThemedText
                  type="caption"
                  style={styles.footerLink}
                  onPress={openTerms}
                >
                  Terms of Service
                </ThemedText>
                {" "}and{" "}
                <ThemedText
                  type="caption"
                  style={styles.footerLink}
                  onPress={openPrivacy}
                >
                  Privacy Policy
                </ThemedText>
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  centeredContent: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  form: {
    gap: Spacing.md,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  googleText: {
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    opacity: 0.5,
    textTransform: "uppercase",
    fontSize: 12,
  },
  languageSection: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  labelText: {
    opacity: 0.8,
  },
  pickerContainer: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  picker: {
    height: Spacing.buttonHeight,
  },
  languageHint: {
    opacity: 0.6,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "GoogleSansFlex",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  switchModeLink: {
    fontWeight: "500",
  },
  footer: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
  },
  footerText: {
    textAlign: "center",
    opacity: 0.5,
  },
  footerLink: {
    textDecorationLine: "underline",
    opacity: 1,
  },
});
