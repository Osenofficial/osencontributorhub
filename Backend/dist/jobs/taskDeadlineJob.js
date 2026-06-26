"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaskDeadlineJob = runTaskDeadlineJob;
exports.startTaskDeadlineScheduler = startTaskDeadlineScheduler;
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const notifyEmail_1 = require("../lib/notifyEmail");
const ONE_HOUR_MS = 60 * 60 * 1000;
const PENALTY_MULTIPLIER = 0.7; // 30% reduction
const ACTIVE_STATUSES = ["todo", "in_progress", "rejected"];
function formatDeadlineIST(deadline) {
    return deadline.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
    });
}
async function sendDeadlineReminders(now) {
    const windowEnd = new Date(now.getTime() + ONE_HOUR_MS);
    const tasks = await Task_1.Task.find({
        assignedTo: { $ne: null },
        deadline: { $gt: now, $lte: windowEnd },
        deadlineReminderSentAt: { $exists: false },
        status: { $in: ACTIVE_STATUSES },
    }).select("title deadline assignedTo points");
    let sent = 0;
    for (const task of tasks) {
        if (!task.assignedTo || !task.deadline)
            continue;
        const assigneeId = task.assignedTo;
        const deadlineLabel = formatDeadlineIST(task.deadline);
        const title = "Task deadline in 1 hour";
        const message = `"${task.title}" is due by ${deadlineLabel}. Finish and submit before the deadline — late completion may reduce points by 30%.`;
        await Notification_1.Notification.create({ user: assigneeId, title, message });
        (0, notifyEmail_1.queueNotifyUserByEmail)(assigneeId, title, message);
        task.deadlineReminderSentAt = now;
        task.history.push({
            actor: assigneeId,
            action: "deadline_reminder_sent",
            fromStatus: task.status,
            toStatus: task.status,
            createdAt: now,
            meta: { deadline: task.deadline },
        });
        await task.save();
        sent++;
    }
    return sent;
}
async function applyOverduePenalties(now) {
    const tasks = await Task_1.Task.find({
        assignedTo: { $ne: null },
        deadline: { $lt: now },
        overduePenaltyApplied: { $ne: true },
        status: { $in: ACTIVE_STATUSES },
    }).select("title deadline assignedTo points basePoints status history");
    let applied = 0;
    for (const task of tasks) {
        if (!task.assignedTo || !task.deadline)
            continue;
        const currentPoints = task.points ?? 0;
        const base = task.basePoints ?? currentPoints;
        const reduced = Math.max(1, Math.round(base * PENALTY_MULTIPLIER));
        if (task.basePoints == null) {
            task.basePoints = base;
        }
        task.points = reduced;
        task.overduePenaltyApplied = true;
        const assigneeId = task.assignedTo;
        const title = "Task overdue — points reduced";
        const message = `"${task.title}" passed its deadline (${formatDeadlineIST(task.deadline)}). Points reduced from ${base} to ${reduced} (−30%). Submit as soon as you can.`;
        task.history.push({
            actor: assigneeId,
            action: "overdue_penalty_applied",
            fromStatus: task.status,
            toStatus: task.status,
            createdAt: now,
            meta: { basePoints: base, newPoints: reduced, deadline: task.deadline },
        });
        await task.save();
        await Notification_1.Notification.create({ user: assigneeId, title, message });
        (0, notifyEmail_1.queueNotifyUserByEmail)(assigneeId, title, message);
        applied++;
    }
    return applied;
}
async function runTaskDeadlineJob() {
    const now = new Date();
    try {
        const [reminders, penalties] = await Promise.all([
            sendDeadlineReminders(now),
            applyOverduePenalties(now),
        ]);
        if (reminders > 0 || penalties > 0) {
            console.log(`[taskDeadlineJob] reminders=${reminders} penalties=${penalties}`);
        }
    }
    catch (err) {
        console.error("[taskDeadlineJob]", err);
    }
}
const DEFAULT_INTERVAL_MS = 60000;
function startTaskDeadlineScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
    void runTaskDeadlineJob();
    setInterval(() => {
        void runTaskDeadlineJob();
    }, intervalMs);
    console.log(`[taskDeadlineJob] scheduler started (every ${intervalMs / 1000}s)`);
}
