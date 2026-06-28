"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUserAboutTask = notifyUserAboutTask;
exports.buildAssignmentNotificationMessage = buildAssignmentNotificationMessage;
const Notification_1 = require("../models/Notification");
async function notifyUserAboutTask(userId, taskId, title, message) {
    await Notification_1.Notification.create({
        user: userId,
        title,
        message,
        taskId,
    });
}
function buildAssignmentNotificationMessage(taskTitle, assignmentNote) {
    const note = assignmentNote?.trim();
    if (!note)
        return taskTitle;
    return `${taskTitle}\n\nNote from your lead: ${note}`;
}
