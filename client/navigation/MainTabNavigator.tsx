import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { MiniPlayer } from "@/components/MiniPlayer";
import { ExpandedPlayer } from "@/components/ExpandedPlayer";
import { Spacing } from "@/constants/theme";

import DiscoverScreen from "@/screens/DiscoverScreen";
import ShowsScreen from "@/screens/ShowsScreen";
import LibraryScreen from "@/screens/LibraryScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type MainTabParamList = {
  DiscoverTab: undefined;
  ShowsTab: undefined;
  LibraryTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MINI_PLAYER_HEIGHT = 64;
const TAB_BAR_HEIGHT = 56;

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
}) {
  return <Feather name={name} size={22} color={color} />;
}

export function MainTabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentItem, isExpanded, setExpanded } = useAudioPlayerContext();

  const hasPlayer = !!currentItem;
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const totalBottomHeight = hasPlayer ? tabBarHeight + MINI_PLAYER_HEIGHT : tabBarHeight;

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
          },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopWidth: 0,
            height: totalBottomHeight,
            paddingBottom: insets.bottom,
          },
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFill}>
              <BlurView
                intensity={80}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              {hasPlayer ? (
                <View style={[styles.miniPlayerContainer, { top: 0 }]}>
                  <MiniPlayer onPress={() => setExpanded(true)} />
                </View>
              ) : null}
            </View>
          ),
          tabBarItemStyle: {
            paddingTop: hasPlayer ? MINI_PLAYER_HEIGHT : 0,
          },
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
            headerShown: false,
            tabBarLabel: "Shows",
            tabBarIcon: ({ color }) => <TabBarIcon name="radio" color={color} />,
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            headerShown: false,
            tabBarLabel: "Library",
            tabBarIcon: ({ color }) => <TabBarIcon name="bookmark" color={color} />,
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            headerShown: false,
            tabBarLabel: "Profile",
            tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          }}
        />
      </Tab.Navigator>

      <ExpandedPlayer
        visible={isExpanded}
        onClose={() => setExpanded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  miniPlayerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
