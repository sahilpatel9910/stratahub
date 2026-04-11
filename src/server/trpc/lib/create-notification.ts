import type { PrismaClient } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/client";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}

export async function createNotification(
  db: PrismaClient,
  params: CreateNotificationParams
): Promise<void> {
  try {
    await db.notification.create({ data: params });
  } catch (err) {
    console.error("[notification] createNotification failed:", err);
  }
}
