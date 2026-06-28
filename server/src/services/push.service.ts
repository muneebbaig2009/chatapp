import webpush from "web-push";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Guarded rather than called unconditionally — an invalid/missing VAPID key
// would otherwise throw at import time and take down the whole server.
if (env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(userId: string, subscription: PushSubscriptionInput) {
  const { endpoint, keys } = subscription ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new ApiError(400, "Invalid push subscription");
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  data?: Record<string, unknown>;
}

// Loops the user's subscriptions and sends to each, pruning any the push
// service reports as gone (410/404). Never throws — a push failure must
// never break the message-delivery path that calls this.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  let subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
  try {
    subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  } catch (err) {
    console.error(`Failed to load push subscriptions for user ${userId}:`, err);
    return;
  }

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`Push notification failed for subscription ${sub.id}:`, err?.statusCode ?? err);
        }
      }
    }),
  );
}
