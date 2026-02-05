import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

interface SendNotificationRequest {
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to send push notifications
  // Called by Supabase Edge Function when pipeline completes
  app.post("/api/send-notification", async (req: Request, res: Response) => {
    try {
      const { expoPushToken, title, body, data } = req.body as SendNotificationRequest;

      if (!expoPushToken || !title || !body) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: expoPushToken, title, body",
        });
      }

      // Check if this is a valid Expo push token
      if (!Expo.isExpoPushToken(expoPushToken)) {
        console.error(`Invalid Expo push token: ${expoPushToken}`);
        return res.status(400).json({
          success: false,
          error: "Invalid Expo push token",
        });
      }

      const message: ExpoPushMessage = {
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data: data || {},
      };

      // Send the notification
      const chunks = expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending notification chunk:", error);
        }
      }

      console.log("[Notifications] Sent notification:", { title, body, tickets });

      return res.json({
        success: true,
        tickets,
      });
    } catch (error) {
      console.error("Error in send-notification endpoint:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // Batch notification endpoint for multiple users
  app.post("/api/send-notifications-batch", async (req: Request, res: Response) => {
    try {
      const { notifications } = req.body as {
        notifications: SendNotificationRequest[];
      };

      if (!notifications || !Array.isArray(notifications)) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: notifications (array)",
        });
      }

      const messages: ExpoPushMessage[] = [];

      for (const notification of notifications) {
        const { expoPushToken, title, body, data } = notification;

        if (!Expo.isExpoPushToken(expoPushToken)) {
          console.warn(`Skipping invalid token: ${expoPushToken}`);
          continue;
        }

        messages.push({
          to: expoPushToken,
          sound: "default",
          title,
          body,
          data: data || {},
        });
      }

      const chunks = expo.chunkPushNotifications(messages);
      const allTickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          allTickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending notification chunk:", error);
        }
      }

      console.log(`[Notifications] Sent ${messages.length} notifications`);

      return res.json({
        success: true,
        sent: messages.length,
        tickets: allTickets,
      });
    } catch (error) {
      console.error("Error in batch notifications endpoint:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
