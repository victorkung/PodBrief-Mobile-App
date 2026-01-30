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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "signin" | "signup";

export default function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + Spacing["3xl"] },
          ]}
        >
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="body" style={styles.subtitle}>
              {mode === "signin"
                ? "Sign in to access your library"
                : "Create an account to get started"}
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
                OR
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {mode === "signup" ? (
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="user" size={20} color={theme.textTertiary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="First Name"
                  placeholderTextColor={theme.textTertiary}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
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
                placeholder="Email"
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
                placeholder="Password"
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

            <Button onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
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
              <ThemedText type="link">
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <ThemedText type="caption" style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </ThemedText>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: Spacing.lg,
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
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  googleText: {
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "GoogleSansFlex",
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  footer: {
    marginTop: "auto",
    alignItems: "center",
  },
  footerText: {
    textAlign: "center",
    opacity: 0.5,
  },
});
