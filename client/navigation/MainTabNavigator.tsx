import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { MiniPlayer } from "@/components/MiniPlayer";
import { Spacing, BorderRadius } from "@/constants/theme";

import DiscoverScreen from "@/screens/DiscoverScreen";
import ShowsScreen from "@/screens/ShowsScreen";
import LibraryScreen from "@/screens/LibraryScreen";
import DownloadsScreen from "@/screens/DownloadsScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type MainTabParamList = {
  DiscoverTab: undefined;
  ShowsTab: undefined;
  LibraryTab: undefined;
  DownloadsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
}) {
  return <Feather name={name} size={22} color={color} />;
}

export function MainTabNavigator({
  onMiniPlayerPress,
}: {
  onMiniPlayerPress?: () => void;
}) {
  const { theme } = useTheme();
  const { currentItem } = useAudioPlayerContext();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerTransparent: true,
          headerTintColor: theme.text,
          headerStyle: {
            backgroundColor: "transparent",
          },
          headerTitleStyle: {
            fontWeight: "600",
            fontSize: 17,
          },
          headerBackground: () => (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ),
          tabBarActiveTintColor: theme.gold,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "500",
            marginTop: -4,
          },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "rgba(0,0,0,0.9)",
            borderTopWidth: 0,
            paddingTop: currentItem ? Spacing.miniPlayerHeight : 0,
            height: currentItem ? 90 + Spacing.miniPlayerHeight : 90,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ),
        }}
      >
        <Tab.Screen
          name="DiscoverTab"
          component={DiscoverScreen}
          options={{
            headerShown: false,
            tabBarLabel: "Search",
            tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
          }}
        />
        <Tab.Screen
          name="ShowsTab"
          component={ShowsScreen}
          options={{
            headerTitle: "",
            tabBarLabel: "Shows",
            tabBarIcon: ({ color }) => <TabBarIcon name="radio" color={color} />,
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            headerTitle: "",
            tabBarLabel: "Library",
            tabBarIcon: ({ color }) => <TabBarIcon name="bookmark" color={color} />,
          }}
        />
        <Tab.Screen
          name="DownloadsTab"
          component={DownloadsScreen}
          options={{
            headerTitle: "",
            tabBarLabel: "Downloads",
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="download" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            headerTitle: "",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          }}
        />
      </Tab.Navigator>
      {currentItem ? <MiniPlayer onPress={onMiniPlayerPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
