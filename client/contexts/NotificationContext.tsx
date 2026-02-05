import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useNavigation, CommonActions } from "@react-navigation/native";

import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  requestPermissions: () => Promise<boolean>;
  hasPermission: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log("[Notifications] Push notifications require a physical device");
      return null;
    }

    if (Platform.OS === "web") {
      console.log("[Notifications] Push notifications not supported on web");
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Notifications] Permission not granted");
        setHasPermission(false);
        return null;
      }

      setHasPermission(true);

      // Get projectId from Constants - required for Expo Go and standalone builds
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.log("[Notifications] No projectId found - push notifications unavailable in this build");
        // Push notifications won't work without a valid projectId, but we shouldn't error
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log("[Notifications] Push token:", tokenData.data);
      return tokenData.data;
    } catch (error: any) {
      // Log the error but don't show it to the user - push notifications are optional
      console.log("[Notifications] Push token unavailable:", error?.message || error);
      return null;
    }
  }, []);

  const savePushToken = useCallback(async (token: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ expo_push_token: token })
        .eq("id", user.id);

      if (error) {
        console.error("[Notifications] Error saving push token:", error);
      } else {
        console.log("[Notifications] Push token saved to profile");
      }
    } catch (error) {
      console.error("[Notifications] Error saving push token:", error);
    }
  }, [user]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const token = await registerForPushNotifications();
    if (token) {
      setExpoPushToken(token);
      await savePushToken(token);
      return true;
    }
    return false;
  }, [registerForPushNotifications, savePushToken]);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      console.log("[Notifications] Notification tapped:", data);

      if (data?.type === "summary_complete" && data?.briefId) {
        navigation.dispatch(
          CommonActions.navigate({
            name: "BriefDetail",
            params: {
              brief: {
                id: data.briefId,
                master_brief_id: data.masterBriefId,
                master_brief: {
                  id: data.masterBriefId,
                  episode_name: data.episodeName,
                  podcast_name: data.podcastName,
                  episode_thumbnail: data.thumbnail,
                  pipeline_status: "completed",
                },
              },
              source: "notification",
            },
          })
        );
      } else if (data?.type === "summary_error" && data?.briefId) {
        navigation.dispatch(
          CommonActions.navigate({
            name: "Main",
            params: { screen: "LibraryTab", params: { initialTab: "summaries" } },
          })
        );
      }
    },
    [navigation]
  );

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications().then((token) => {
      if (token) {
        setExpoPushToken(token);
        savePushToken(token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        console.log("[Notifications] Received:", notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user, registerForPushNotifications, savePushToken, handleNotificationResponse]);

  useEffect(() => {
    const checkInitialNotification = async () => {
      if (!Device.isDevice) {
        return;
      }
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          handleNotificationResponse(response);
        }
      } catch (error) {
        console.log("[Notifications] getLastNotificationResponseAsync not available");
      }
    };

    checkInitialNotification();
  }, [handleNotificationResponse]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        requestPermissions,
        hasPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
