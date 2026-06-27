import { Types } from "mongoose";
import { Notification } from "../models/Notification";

export async function notifyUserAboutTask(
  userId: Types.ObjectId | string,
  taskId: Types.ObjectId | string,
  title: string,
  message: string,
) {
  await Notification.create({
    user: userId,
    title,
    message,
    taskId,
  });
}

export function buildAssignmentNotificationMessage(
  taskTitle: string,
  assignmentNote?: string | null,
): string {
  const note = assignmentNote?.trim();
  if (!note) return taskTitle;
  return `${taskTitle}\n\nNote from your lead: ${note}`;
}
