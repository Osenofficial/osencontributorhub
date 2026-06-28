"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaskDeadlineJob = runTaskDeadlineJob;
exports.startTaskDeadlineScheduler = startTaskDeadlineScheduler;
const Task_1 = require("../models/Task");
const taskNotification_1 = require("../lib/taskNotification");
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
/** Wider than the 60s job tick so we still catch the 6h mark once per task. */
const REMINDER_WINDOW_MS = 90000;
const PENALTY_MULTIPLIER = 0.7; // 30% reduction
const ACTIVE_STATUSES = ["todo", "in_progress", "rejected"];
const REMINDER_NOT_SENT = {
    $or: [{ deadlineReminderSentAt: { $exists: false } }, { deadlineReminderSentAt: null }],
};
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
    const target = now.getTime() + SIX_HOURS_MS;
    const deadlineMin = new Date(target - REMINDER_WINDOW_MS);
    const deadlineMax = new Date(target + REMINDER_WINDOW_MS);
    const candidates = await Task_1.Task.find({
        assignedTo: { $ne: null },
        deadline: { $gte: deadlineMin, $lte: deadlineMax },
        status: { $in: ACTIVE_STATUSES },
        ...REMINDER_NOT_SENT,
    }).select("_id title deadline assignedTo status points");
    let sent = 0;
    for (const candidate of candidates) {
        if (!candidate.assignedTo || !candidate.deadline)
            continue;
        const assigneeId = candidate.assignedTo;
        const claimed = await Task_1.Task.findOneAndUpdate({
            _id: candidate._id,
            ...REMINDER_NOT_SENT,
        }, {
            $set: { deadlineReminderSentAt: now },
            $push: {
                history: {
                    actor: assigneeId,
                    action: "deadline_reminder_sent",
                    fromStatus: candidate.status,
                    toStatus: candidate.status,
                    createdAt: now,
                    meta: { deadline: candidate.deadline, hoursBefore: 6 },
                },
            },
        }, { new: true })
            .select("title deadline assignedTo")
            .lean();
        if (!claimed?.deadline)
            continue;
        const deadlineLabel = formatDeadlineIST(claimed.deadline);
        const title = "Task deadline in 6 hours";
        const message = `"${claimed.title}" is due by ${deadlineLabel}. Finish and submit before the deadline — late completion may reduce points by 30%.`;
        await (0, taskNotification_1.notifyUserAboutTask)(assigneeId, claimed._id, title, message);
        sent++;
    }
    return sent;
}
async function applyOverduePenalties(now) {
    const candidates = await Task_1.Task.find({
        assignedTo: { $ne: null },
        deadline: { $lt: now },
        overduePenaltyApplied: { $ne: true },
        status: { $in: ACTIVE_STATUSES },
    }).select("_id title deadline assignedTo points basePoints status");
    let applied = 0;
    for (const candidate of candidates) {
        if (!candidate.assignedTo || !candidate.deadline)
            continue;
        const currentPoints = candidate.points ?? 0;
        const base = candidate.basePoints ?? currentPoints;
        const reduced = Math.max(1, Math.round(base * PENALTY_MULTIPLIER));
        const assigneeId = candidate.assignedTo;
        const claimed = await Task_1.Task.findOneAndUpdate({
            _id: candidate._id,
            overduePenaltyApplied: { $ne: true },
        }, {
            $set: {
                basePoints: candidate.basePoints == null ? base : candidate.basePoints,
                points: reduced,
                overduePenaltyApplied: true,
            },
            $push: {
                history: {
                    actor: assigneeId,
                    action: "overdue_penalty_applied",
                    fromStatus: candidate.status,
                    toStatus: candidate.status,
                    createdAt: now,
                    meta: { basePoints: base, newPoints: reduced, deadline: candidate.deadline },
                },
            },
        }, { new: true })
            .select("title deadline")
            .lean();
        if (!claimed?.deadline)
            continue;
        const title = "Task overdue — points reduced";
        const message = `"${claimed.title}" passed its deadline (${formatDeadlineIST(claimed.deadline)}). Points reduced from ${base} to ${reduced} (−30%). Submit as soon as you can.`;
        await (0, taskNotification_1.notifyUserAboutTask)(assigneeId, claimed._id, title, message);
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
let schedulerStarted = false;
function startTaskDeadlineScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
    if (schedulerStarted) {
        console.warn("[taskDeadlineJob] scheduler already running — skipping duplicate start");
        return;
    }
    schedulerStarted = true;
    void runTaskDeadlineJob();
    setInterval(() => {
        void runTaskDeadlineJob();
    }, intervalMs);
    console.log(`[taskDeadlineJob] scheduler started (every ${intervalMs / 1000}s)`);
}
