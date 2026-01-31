import React, { useEffect, useState, useCallback } from "react";
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";

import { MainTabNavigator, MainTabParamList } from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PodcastDetailScreen from "@/screens/PodcastDetailScreen";
import BriefDetailScreen from "@/screens/BriefDetailScreen";
import GenerateBriefScreen from "@/screens/GenerateBriefScreen";
import NowPlayingScreen from "@/screens/NowPlayingScreen";

import { TaddyPodcast, TaddyEpisode, UserBrief } from "@/lib/types";

const ONBOARDING_COMPLETE_KEY = "@podbrief_onboarding_complete";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: { mode?: "signin" | "signup" };
  Main: { screen?: keyof MainTabParamList };
  PodcastDetail: { podcast: TaddyPodcast };
  BriefDetail: { brief: UserBrief };
  GenerateBrief: { episode: TaddyEpisode; podcast?: TaddyPodcast };
  NowPlaying: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStackNavigator() {
  const { theme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [pendingAuthMode, setPendingAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setHasSeenOnboarding(value === "true");
    } catch {
      setHasSeenOnboarding(false);
    }
  };

  const handleOnboardingComplete = useCallback(async (mode: "signin" | "signup") => {
    try {
      setPendingAuthMode(mode);
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  }, []);

  const screenOptions: NativeStackNavigationOptions = {
    headerTransparent: true,
    headerTintColor: theme.text,
    headerStyle: {
      backgroundColor: "transparent",
    },
    headerTitleStyle: {
      fontWeight: "600",
      fontSize: 17,
      color: theme.text,
    },
    headerBackground: () => (
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
    ),
    headerShadowVisible: false,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };

  if (authLoading || hasSeenOnboarding === null) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        !hasSeenOnboarding ? (
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
            {() => (
              <OnboardingScreen
                onComplete={() => handleOnboardingComplete("signup")}
                onLogin={() => handleOnboardingComplete("signin")}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen
            name="Auth"
            options={{ headerShown: false }}
          >
            {() => <AuthScreen initialMode={pendingAuthMode} />}
          </Stack.Screen>
        )
      ) : (
        <>
          <Stack.Screen
            name="Main"
            options={{ headerShown: false }}
          >
            {() => (
              <MainTabNavigator
                onMiniPlayerPress={() => {}}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="PodcastDetail"
            component={PodcastDetailScreen}
            options={{
              headerTitle: "",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="BriefDetail"
            component={BriefDetailScreen}
            options={{
              headerTitle: "Brief",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="GenerateBrief"
            component={GenerateBriefScreen}
            options={{
              headerTitle: "Generate Brief",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="NowPlaying"
            component={NowPlayingScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
