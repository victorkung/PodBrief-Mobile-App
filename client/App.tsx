import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import { RootStackNavigator } from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { Colors } from "@/constants/theme";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AuthProvider>
                <AudioPlayerProvider>
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
                          fontFamily: "System",
                          fontWeight: "400",
                        },
                        medium: {
                          fontFamily: "System",
                          fontWeight: "500",
                        },
                        bold: {
                          fontFamily: "System",
                          fontWeight: "700",
                        },
                        heavy: {
                          fontFamily: "System",
                          fontWeight: "800",
                        },
                      },
                    }}
                  >
                    <RootStackNavigator />
                  </NavigationContainer>
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
