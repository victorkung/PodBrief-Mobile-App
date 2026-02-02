import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import { RootStackNavigator } from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { Colors } from "@/constants/theme";
import { createErrorHandler } from "@/lib/errorLogger";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          GoogleSansFlex: require("../assets/fonts/GoogleSansFlex.ttf"),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error("Error loading fonts:", error);
        setFontError(error as Error);
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary onError={createErrorHandler('app_root')}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
            <KeyboardProvider>
              <AuthProvider>
                <AudioPlayerProvider>
                  <ToastProvider>
                  <NavigationContainer
                    theme={{
                      dark: true,
                      colors: {
                        primary: Colors.dark.gold,
                        background: Colors.dark.backgroundRoot,
                        card: Colors.dark.backgroundDefault,
                        text: Colors.dark.text,
                        border: Colors.dark.border,
                        notification: Colors.dark.gold,
                      },
                      fonts: {
                        regular: {
                          fontFamily: "GoogleSansFlex",
                          fontWeight: "400",
                        },
                        medium: {
                          fontFamily: "GoogleSansFlex",
                          fontWeight: "500",
                        },
                        bold: {
                          fontFamily: "GoogleSansFlex",
                          fontWeight: "700",
                        },
                        heavy: {
                          fontFamily: "GoogleSansFlex",
                          fontWeight: "800",
                        },
                      },
                    }}
                  >
                    <RootStackNavigator />
                  </NavigationContainer>
                  </ToastProvider>
                  <StatusBar style="light" />
                </AudioPlayerProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
});
