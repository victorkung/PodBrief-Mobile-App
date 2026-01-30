import React from "react";
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";

import { MainTabNavigator, MainTabParamList } from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import PodcastDetailScreen from "@/screens/PodcastDetailScreen";
import BriefDetailScreen from "@/screens/BriefDetailScreen";
import GenerateBriefScreen from "@/screens/GenerateBriefScreen";
import NowPlayingScreen from "@/screens/NowPlayingScreen";

import { TaddyPodcast, TaddyEpisode, UserBrief } from "@/lib/types";

export type RootStackParamList = {
  Auth: undefined;
  Main: { screen?: keyof MainTabParamList };
  PodcastDetail: { podcast: TaddyPodcast };
  BriefDetail: { brief: UserBrief };
  GenerateBrief: { episode: TaddyEpisode; podcast?: TaddyPodcast };
  NowPlaying: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStackNavigator() {
  const { theme } = useTheme();
  const { user, isLoading } = useAuth();

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

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
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
