import React, { useState } from "react";
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
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Google from "expo-auth-session/providers/google";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

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

const BACKGROUND_COLOR = "#0D1117";

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export default function AuthScreen({ initialMode = "signin" }: AuthScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const selectedLanguageLabel = LANGUAGES.find(l => l.value === preferredLanguage)?.label || "";

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        try {
          setIsGoogleLoading(true);
          const { authentication } = response;
          
          if (!authentication?.idToken) {
            throw new Error("No ID token received from Google");
          }

          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: authentication.idToken,
          });

          if (error) throw error;

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
          console.error("Google sign in error:", error);
          Alert.alert("Sign-in failed", error.message || "Please try again.");
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (response?.type === "error") {
        console.error("Google auth error:", response.error);
        Alert.alert("Sign-in failed", "Google authentication failed. Please try again.");
        setIsGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert("Error", "Google Sign-In is not ready. Please try again.");
      return;
    }
    
    setIsGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error: any) {
      console.error("Google prompt error:", error);
      Alert.alert("Sign-in failed", "Could not open Google Sign-In.");
      setIsGoogleLoading(false);
    }
  };

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

  const handleLanguageSelect = (value: string) => {
    setPreferredLanguage(value);
    setShowLanguagePicker(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.lg,
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
                  : "Get your first 5 summaries free"}
              </ThemedText>
            </View>

            <View style={styles.form}>
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                style={[
                  styles.googleButton,
                  { backgroundColor: theme.backgroundSecondary },
                  isGoogleLoading && styles.buttonDisabled,
                ]}
              >
                <Feather name="globe" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.googleText}>
                  {isGoogleLoading ? "Signing in..." : "Continue with Google"}
                </ThemedText>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <ThemedText type="small" style={styles.dividerText}>
                  OR
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

                  <Pressable
                    onPress={() => setShowLanguagePicker(true)}
                    style={[
                      styles.inputContainer,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Feather name="globe" size={20} color={theme.textTertiary} />
                    <ThemedText 
                      style={[
                        styles.input, 
                        { color: selectedLanguageLabel ? theme.text : theme.textTertiary }
                      ]}
                    >
                      {selectedLanguageLabel || "Preferred Language"}
                    </ThemedText>
                    <Feather name="chevron-down" size={20} color={theme.textTertiary} />
                  </Pressable>
                  <ThemedText style={styles.languageHint}>
                    The language that will be used for your AI summaries. This can be updated later in your Settings page.
                  </ThemedText>
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

              <View style={styles.switchMode}>
                <ThemedText style={styles.switchModeText}>
                  {mode === "signin"
                    ? "Don't have an account? "
                    : "Already have an account? "}
                </ThemedText>
                <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  <ThemedText style={styles.switchModeLink}>
                    {mode === "signin" ? "Sign up" : "Sign in"}
                  </ThemedText>
                </Pressable>
              </View>
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

      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Language</ThemedText>
              <Pressable onPress={() => setShowLanguagePicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.languageOption,
                    preferredLanguage === item.value && styles.languageOptionSelected,
                  ]}
                  onPress={() => handleLanguageSelect(item.value)}
                >
                  <ThemedText style={styles.languageOptionText}>{item.label}</ThemedText>
                  {preferredLanguage === item.value ? (
                    <Feather name="check" size={20} color="#E8BA30" />
                  ) : null}
                </Pressable>
              )}
              style={styles.languageList}
            />
          </View>
        </Pressable>
      </Modal>
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
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 220,
    height: 65,
    marginBottom: Spacing.xl,
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
    gap: Spacing.sm,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xs,
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
  languageDisplay: {
    flex: 1,
  },
  languageLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  languageValue: {
    fontSize: 16,
    fontFamily: "GoogleSansFlex",
  },
  languageHint: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    marginTop: -Spacing.xs,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -Spacing.xs,
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  switchModeText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  switchModeLink: {
    fontSize: 14,
    color: "#E8BA30",
    fontWeight: "600",
  },
  footer: {
    marginTop: Spacing.xl,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    maxHeight: 400,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  languageList: {
    maxHeight: 340,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  languageOptionSelected: {
    backgroundColor: "rgba(232, 186, 48, 0.1)",
  },
  languageOptionText: {
    fontSize: 16,
  },
});
