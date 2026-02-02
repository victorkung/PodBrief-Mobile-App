import React, { useState, useMemo } from "react";
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
import * as Linking from "expo-linking";

import { ThemedText } from "@/components/ThemedText";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { validatePassword, mapAuthError, PASSWORD_REQUIREMENTS } from "@/lib/passwordValidation";

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

  const selectedLanguageLabel = LANGUAGES.find(l => l.value === preferredLanguage)?.label || "";

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const showPasswordRequirements = mode === "signup" && password.length > 0;

  const handleSubmit = async () => {
    if (mode === "signup" && !firstName.trim()) {
      Alert.alert("Error", "Please enter your first name.");
      return;
    }
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    if (mode === "signup" && !passwordValidation.isValid) {
      Alert.alert("Password Requirements", "Your password must meet all requirements: " + passwordValidation.errors.join(", "));
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
      const friendlyMessage = mapAuthError(error.message || "Authentication failed.");
      Alert.alert("Error", friendlyMessage);
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

              {showPasswordRequirements ? (
                <View style={styles.passwordRequirements}>
                  {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
                    const isValid = passwordValidation.checks[key as keyof typeof passwordValidation.checks];
                    return (
                      <View key={key} style={styles.requirementRow}>
                        <Feather 
                          name={isValid ? "check-circle" : "circle"} 
                          size={14} 
                          color={isValid ? "#4ADE80" : theme.textTertiary} 
                        />
                        <ThemedText 
                          style={[
                            styles.requirementText,
                            { color: isValid ? "#4ADE80" : theme.textTertiary }
                          ]}
                        >
                          {label}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : null}

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
  passwordRequirements: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
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
