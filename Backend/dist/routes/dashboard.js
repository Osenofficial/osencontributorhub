"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const Comment_1 = require("../models/Comment");
const Invoice_1 = require("../models/Invoice");
const PayoutRequest_1 = require("../models/PayoutRequest");
const ContributorPeriod_1 = require("../models/ContributorPeriod");
const contributorPeriodService_1 = require("../lib/contributorPeriodService");
const payoutTiers_1 = require("../lib/payoutTiers");
const notifyEmail_1 = require("../lib/notifyEmail");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.use(auth_1.requireAuth);
/** Completed points for one contributor cycle (same basis as GET /leaderboard for that period). */
async function userPointsInContributorPeriod(userId, periodId) {
    const rows = await Task_1.Task.aggregate([
        {
            $match: {
                status: "completed",
                contributorPeriod: periodId,
                assignedTo: userId,
            },
        },
        { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    return rows[0]?.total ?? 0;
}
function canViewPayoutStage(role, doc) {
    if (role === "admin")
        return true;
    if (role === "accounts")
        return ["pending_admin", "pending_accounts", "paid", "rejected"].includes(doc.status);
    return false;
}
function canViewPayoutComments(userRole, doc, userId) {
    if (userRole === "admin")
        return true;
    if (userRole === "accounts")
        return ["pending_admin", "pending_accounts", "paid", "rejected"].includes(doc.status);
    const ownerId = doc.submittedBy?._id?.toString?.() ?? doc.submittedBy?.toString?.();
    return !!(ownerId && userId && ownerId === userId);
}
function canPostPayoutComment(userRole, doc, userId) {
    return canViewPayoutComments(userRole, doc, userId);
}
exports.dashboardRouter.get("/overview", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const [totalTasks, completedTasks, notifications, recentTasks, taskFeed] = await Promise.all([
            Task_1.Task.countDocuments({ assignedTo: userId }),
            Task_1.Task.countDocuments({ assignedTo: userId, status: "completed" }),
            Notification_1.Notification.find({ user: userId, read: false }).sort({ createdAt: -1 }).limit(10),
            Task_1.Task.find({ assignedTo: userId }).sort({ updatedAt: -1 }).limit(5),
            Task_1.Task.find()
                .populate("assignedTo", "name email")
                .populate("createdBy", "name email")
                .populate("pendingAssignmentRequests.user", "name email")
                .populate("contributorPeriod", "sequence label startedAt endedAt")
                .sort({ createdAt: -1 })
                .limit(500),
        ]);
        res.json({
            totalTasks,
            completedTasks,
            completionRate: totalTasks ? completedTasks / totalTasks : 0,
            notifications,
            recentTasks,
            taskFeed,
            activities: [],
        });
    }
    catch (err) {
        next(err);
    }
});
// Self-submit: user submits a completed contribution they did on their own (not assigned)
exports.dashboardRouter.post("/contribute", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { title, description, contributionType, category, points, githubLink, notionLink, googleDoc, comments } = req.body;
        if (!title || !contributionType) {
            return res.status(400).json({ message: "Title and contribution type are required" });
        }
        const pts = Math.min(100, Math.max(1, parseInt(String(points)) || 10));
        const period = await (0, contributorPeriodService_1.ensureActiveContributorPeriod)(userId);
        const task = await Task_1.Task.create({
            title,
            description: description || "",
            contributionType,
            category: category || "community",
            priority: "medium",
            points: pts,
            assignedTo: userId,
            createdBy: userId,
            contributorPeriod: period._id,
            status: "submitted",
            submission: {
                githubLink: githubLink || "",
                notionLink: notionLink || "",
                googleDoc: googleDoc || "",
                comments: comments || "",
                submittedAt: new Date(),
            },
            history: [
                {
                    actor: userId,
                    action: "self_submitted",
                    fromStatus: "todo",
                    toStatus: "submitted",
                    createdAt: new Date(),
                    meta: { selfContribution: true },
                },
            ],
        });
        const populated = await Task_1.Task.findById(task._id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email");
        res.status(201).json(populated);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/team", async (req, res, next) => {
    try {
        const users = await User_1.User.find({
            role: { $ne: "admin" },
            status: { $in: ["active", "pending"] },
        })
            .sort({ name: 1 })
            .select("name email avatar");
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/tasks", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        const filter = role === "admin"
            ? {}
            : {
                $or: [{ assignedTo: userId }, { assignedTo: null, status: "todo" }],
            };
        const tasks = await Task_1.Task.find(filter)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email")
            .populate("contributorPeriod", "sequence label startedAt endedAt")
            .sort({ createdAt: -1 });
        res.json(tasks);
    }
    catch (err) {
        next(err);
    }
});
/** Claim an open pool task — admin only (instant). Leads and contributors use POST .../request-assignment; an admin approves. */
exports.dashboardRouter.post("/tasks/:id/claim", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        if (role === "lead") {
            return res.status(403).json({
                message: "Leads cannot claim pool tasks directly. Use Request assignment — an admin must approve who gets the task.",
            });
        }
        if (role !== "admin") {
            return res.status(403).json({
                message: "Contributors must request assignment. Use “Request assignment” — an admin will approve.",
            });
        }
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (task.assignedTo != null) {
            return res.status(400).json({ message: "Task is already assigned" });
        }
        if (task.status !== "todo") {
            return res.status(400).json({ message: "Only open pool tasks can be claimed" });
        }
        task.pendingAssignmentRequests = [];
        task.assignedTo = userId;
        task.history.push({
            actor: userId,
            action: "claimed",
            fromStatus: task.status,
            toStatus: task.status,
            createdAt: new Date(),
        });
        await task.save();
        await Notification_1.Notification.create({
            user: userId,
            title: "You claimed a task",
            message: task.title,
        });
        const updated = await Task_1.Task.findById(task._id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email");
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
/** Ask to be assigned to an open pool task — admin approves in Admin panel (leads use the same flow as contributors). */
exports.dashboardRouter.post("/tasks/:id/request-assignment", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        if (role === "admin") {
            return res.status(400).json({
                message: "Use Claim to assign yourself instantly from the task feed, or manage tasks from the Admin panel.",
            });
        }
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (task.assignedTo != null) {
            return res.status(400).json({ message: "This task is already assigned to someone" });
        }
        if (task.status !== "todo") {
            return res.status(400).json({ message: "Only open tasks can be requested" });
        }
        const requests = task.pendingAssignmentRequests || [];
        if (requests.some((p) => p.user.toString() === userId.toString())) {
            return res.status(400).json({ message: "You already have a pending request for this task" });
        }
        requests.push({ user: userId, requestedAt: new Date() });
        task.pendingAssignmentRequests = requests;
        task.history.push({
            actor: userId,
            action: "request_assignment",
            fromStatus: task.status,
            toStatus: task.status,
            createdAt: new Date(),
        });
        await task.save();
        const requesterName = req.user.name || "A contributor";
        const assignReqMsg = `${requesterName} wants to work on "${task.title}"`;
        const admins = await User_1.User.find({ role: "admin" }).select("_id");
        for (const a of admins) {
            await Notification_1.Notification.create({
                user: a._id,
                title: "Assignment request",
                message: assignReqMsg,
            });
        }
        (0, notifyEmail_1.queueNotifyUsersByRole)("admin", "Assignment request", assignReqMsg);
        const updated = await Task_1.Task.findById(task._id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email");
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
/**
 * Assignee-only updates: safe status transitions + submission links/comments.
 * Reassignment is not allowed here (use admin flows).
 */
exports.dashboardRouter.patch("/tasks/:id", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { status: bodyStatus, submission: submissionBody } = req.body;
        const task = await Task_1.Task.findOne({ _id: req.params.id, assignedTo: userId });
        if (!task) {
            return res.status(404).json({ message: "Task not found or not assigned to you" });
        }
        if (task.status === "completed") {
            return res.status(400).json({ message: "This task is completed and cannot be changed" });
        }
        if (bodyStatus !== undefined) {
            const nextStatus = bodyStatus;
            const cur = task.status;
            const allowed = (cur === "todo" && nextStatus === "in_progress") ||
                (cur === "in_progress" && nextStatus === "submitted") ||
                (cur === "submitted" && nextStatus === "submitted") ||
                (cur === "rejected" && (nextStatus === "in_progress" || nextStatus === "submitted"));
            if (!allowed) {
                return res.status(400).json({
                    message: "Invalid status change. Start the task (to in progress), submit for review, or keep it submitted while you update your submission.",
                });
            }
            if (nextStatus !== cur) {
                const fromStatus = task.status;
                task.status = nextStatus;
                task.history.push({
                    actor: userId,
                    action: "status_update",
                    fromStatus,
                    toStatus: nextStatus,
                    createdAt: new Date(),
                    meta: submissionBody && typeof submissionBody === "object" ? { hasSubmission: true } : undefined,
                });
                if (nextStatus === "submitted") {
                    const base = task.submission || {};
                    task.submission = {
                        githubLink: base.githubLink,
                        notionLink: base.notionLink,
                        googleDoc: base.googleDoc,
                        comments: base.comments,
                        submittedAt: new Date(),
                    };
                }
            }
        }
        if (submissionBody && typeof submissionBody === "object") {
            if (!["in_progress", "submitted", "rejected"].includes(task.status)) {
                return res.status(400).json({
                    message: "You can add or edit submission details while the task is in progress, rejected, or waiting for review.",
                });
            }
            const prev = task.submission || {};
            const merged = {
                githubLink: submissionBody.githubLink !== undefined
                    ? String(submissionBody.githubLink ?? "").trim()
                    : prev.githubLink ?? "",
                notionLink: submissionBody.notionLink !== undefined
                    ? String(submissionBody.notionLink ?? "").trim()
                    : prev.notionLink ?? "",
                googleDoc: submissionBody.googleDoc !== undefined
                    ? String(submissionBody.googleDoc ?? "").trim()
                    : prev.googleDoc ?? "",
                comments: submissionBody.comments !== undefined
                    ? String(submissionBody.comments ?? "").trim()
                    : prev.comments ?? "",
                submittedAt: task.status === "submitted"
                    ? new Date()
                    : prev.submittedAt != null
                        ? prev.submittedAt
                        : undefined,
            };
            task.submission = merged;
            task.history.push({
                actor: userId,
                action: "submission_updated",
                fromStatus: task.status,
                toStatus: task.status,
                createdAt: new Date(),
            });
        }
        await task.save();
        const updated = await Task_1.Task.findById(task._id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email");
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
// Task comments: pool (unassigned) tasks visible to everyone; posting requires assignee or admin/lead
function canViewTaskComments(userId, userRole, task) {
    if (["admin", "lead"].includes(userRole))
        return true;
    const assigneeId = task.assignedTo?._id?.toString() ?? task.assignedTo?.toString();
    const createdById = task.createdBy?._id?.toString() ?? task.createdBy?.toString();
    const uid = userId.toString();
    if (!assigneeId && task.status === "todo")
        return true;
    return uid === assigneeId || uid === createdById;
}
function canPostTaskComment(userId, userRole, task) {
    if (["admin", "lead"].includes(userRole))
        return true;
    const assigneeId = task.assignedTo?._id?.toString() ?? task.assignedTo?.toString();
    const createdById = task.createdBy?._id?.toString() ?? task.createdBy?.toString();
    const uid = userId.toString();
    if (!assigneeId && task.status === "todo")
        return false;
    return uid === assigneeId || uid === createdById;
}
exports.dashboardRouter.get("/tasks/:id/comments", async (req, res, next) => {
    try {
        const task = await Task_1.Task.findById(req.params.id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email");
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const canAccess = canViewTaskComments(req.user._id, req.user.role, task);
        if (!canAccess) {
            return res.status(403).json({ message: "You do not have access to this task" });
        }
        const comments = await Comment_1.Comment.find({
            task: task._id,
            audience: { $nin: ["staff"] },
        })
            .populate("author", "name email avatar")
            .sort({ createdAt: 1 });
        res.json(comments);
    }
    catch (err) {
        next(err);
    }
});
/** Lead & admin only — not visible to assignees/contributors on the task. */
exports.dashboardRouter.get("/tasks/:id/comments/internal", async (req, res, next) => {
    try {
        if (!["admin", "lead"].includes(req.user.role)) {
            return res.status(403).json({ message: "Internal comments are only visible to leads and admins" });
        }
        const task = await Task_1.Task.findById(req.params.id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email");
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const canAccess = canViewTaskComments(req.user._id, req.user.role, task);
        if (!canAccess) {
            return res.status(403).json({ message: "You do not have access to this task" });
        }
        const comments = await Comment_1.Comment.find({ task: task._id, audience: "staff" })
            .populate("author", "name email avatar")
            .sort({ createdAt: 1 });
        res.json(comments);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/tasks/:id/comments", async (req, res, next) => {
    try {
        const { body } = req.body;
        const audienceRaw = req.body.audience;
        const audience = audienceRaw === "staff" ? "staff" : "task";
        if (!body || typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Comment body is required" });
        }
        if (audience === "staff" && !["admin", "lead"].includes(req.user.role)) {
            return res.status(403).json({ message: "Only leads and admins can post internal comments" });
        }
        const task = await Task_1.Task.findById(req.params.id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email");
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const canAccess = canViewTaskComments(req.user._id, req.user.role, task);
        if (!canAccess) {
            return res.status(403).json({ message: "You do not have access to this task" });
        }
        if (!canPostTaskComment(req.user._id, req.user.role, task)) {
            return res.status(403).json({ message: "Claim this task before commenting" });
        }
        const comment = await Comment_1.Comment.create({
            task: task._id,
            author: req.user._id,
            body: body.trim().slice(0, 2000),
            audience,
        });
        const populated = await Comment_1.Comment.findById(comment._id).populate("author", "name email avatar");
        // Internal thread: do not notify contributors (assignee / task creator).
        if (audience === "staff") {
            return res.status(201).json(populated);
        }
        // Notify the other party: if assignee commented, notify createdBy; if admin/lead or createdBy commented, notify assignee
        const assigneeId = task.assignedTo?._id ?? task.assignedTo;
        const createdById = task.createdBy?._id ?? task.createdBy;
        const currentUserId = req.user._id.toString();
        const assigneeIdStr = assigneeId?.toString();
        const createdByIdStr = createdById?.toString();
        const authorName = req.user.name || "Someone";
        if (currentUserId === assigneeIdStr && createdByIdStr && createdByIdStr !== assigneeIdStr) {
            await Notification_1.Notification.create({
                user: createdById,
                title: "New comment on task",
                message: `${authorName} commented on "${task.title}"`,
            });
        }
        else if (assigneeIdStr && assigneeIdStr !== currentUserId) {
            await Notification_1.Notification.create({
                user: assigneeId,
                title: "New comment on task",
                message: `${authorName} commented on "${task.title}"`,
            });
        }
        res.status(201).json(populated);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/notifications", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const notifications = await Notification_1.Notification.find({ user: userId })
            .sort({ createdAt: -1 });
        res.json(notifications);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/notifications/read-all", async (req, res, next) => {
    try {
        const userId = req.user._id;
        await Notification_1.Notification.updateMany({ user: userId, read: false }, { read: true });
        const notifications = await Notification_1.Notification.find({ user: userId }).sort({ createdAt: -1 });
        res.json(notifications);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/notifications/:id/read", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, user: userId }, { read: true }, { new: true });
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json(notification);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/contributor-periods", async (_req, res, next) => {
    try {
        await (0, contributorPeriodService_1.ensureActiveContributorPeriod)();
        const periods = await ContributorPeriod_1.ContributorPeriod.find().sort({ sequence: -1 }).limit(48).lean();
        res.json({
            periods: periods.map((p) => ({
                _id: p._id,
                sequence: p.sequence,
                label: p.label,
                startedAt: p.startedAt,
                endedAt: p.endedAt,
                isActive: p.endedAt == null,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/leaderboard", async (req, res, next) => {
    try {
        const raw = req.query.periodId;
        let periodDoc = null;
        if (raw != null && String(raw).trim() !== "" && mongoose_1.default.isValidObjectId(String(raw))) {
            periodDoc = await ContributorPeriod_1.ContributorPeriod.findById(String(raw));
            if (!periodDoc) {
                return res.status(404).json({ message: "Contributor period not found" });
            }
        }
        else {
            periodDoc = await (0, contributorPeriodService_1.ensureActiveContributorPeriod)();
        }
        const periodOid = new mongoose_1.default.Types.ObjectId(String(periodDoc._id));
        const leaderboard = await Task_1.Task.aggregate([
            {
                $match: {
                    status: "completed",
                    contributorPeriod: periodOid,
                    assignedTo: { $exists: true, $ne: null },
                },
            },
            {
                $group: {
                    _id: "$assignedTo",
                    totalPoints: { $sum: "$points" },
                    completedTasks: { $sum: 1 },
                },
            },
            { $sort: { totalPoints: -1 } },
            { $limit: 100 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            {
                $project: {
                    userId: "$user._id",
                    name: "$user.name",
                    email: "$user.email",
                    avatar: "$user.avatar",
                    role: "$user.role",
                    totalPoints: 1,
                    completedTasks: 1,
                },
            },
        ]);
        const withAvatar = leaderboard.map((u, i) => {
            const initials = u.name
                ?.trim()
                .split(/\s+/)
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "?";
            const avatarUrl = u.avatar?.startsWith?.("http")
                ? u.avatar
                : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.email || u.name || "u")}&backgroundColor=8b5cf6,6366f1,3b82f6`;
            return {
                ...u,
                avatar: avatarUrl,
                initials,
                rank: i + 1,
            };
        });
        res.json({
            period: {
                id: periodDoc._id,
                sequence: periodDoc.sequence,
                label: periodDoc.label,
                startedAt: periodDoc.startedAt,
                endedAt: periodDoc.endedAt,
                isActive: periodDoc.endedAt == null,
            },
            leaderboard: withAvatar,
        });
    }
    catch (err) {
        next(err);
    }
});
// Contribution report for a user in a date range (only admin/lead can query other users)
exports.dashboardRouter.get("/report", async (req, res, next) => {
    try {
        const { q, from, to } = req.query;
        let targetUser = req.user;
        if (q) {
            if (req.user.role !== "admin" && req.user.role !== "lead") {
                return res.status(403).json({ message: "Only admin or lead can view other users' reports" });
            }
            const query = q.trim();
            const user = await User_1.User.findOne({
                $or: [{ email: query.toLowerCase() }, { name: new RegExp(query, "i") }],
            });
            if (!user) {
                return res.status(404).json({ message: "User not found for given query" });
            }
            targetUser = user;
        }
        const dateFilter = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) {
                dateFilter.createdAt.$gte = new Date(from);
            }
            if (to) {
                const end = new Date(to);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        }
        const match = {
            assignedTo: targetUser._id,
            ...(Object.keys(dateFilter).length ? dateFilter : {}),
        };
        const tasks = await Task_1.Task.find(match).sort({ createdAt: -1 });
        const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
        const byStatus = tasks.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {});
        res.json({
            user: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
            },
            range: { from: from || null, to: to || null },
            summary: {
                taskCount: tasks.length,
                totalPoints,
                byStatus,
            },
            tasks,
        });
    }
    catch (err) {
        next(err);
    }
});
// CSV export for the same scope as GET /report (tasks assigned to user in optional date range)
exports.dashboardRouter.get("/report/export-csv", async (req, res, next) => {
    try {
        const esc = (v) => {
            const s = String(v ?? "");
            if (/[",\n\r]/.test(s))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const { q, from, to } = req.query;
        let targetUser = req.user;
        if (q) {
            if (req.user.role !== "admin" && req.user.role !== "lead") {
                return res.status(403).json({ message: "Only admin or lead can view other users' reports" });
            }
            const query = q.trim();
            const user = await User_1.User.findOne({
                $or: [{ email: query.toLowerCase() }, { name: new RegExp(query, "i") }],
            });
            if (!user) {
                return res.status(404).json({ message: "User not found for given query" });
            }
            targetUser = user;
        }
        const dateFilter = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) {
                dateFilter.createdAt.$gte = new Date(from);
            }
            if (to) {
                const end = new Date(to);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        }
        const match = {
            assignedTo: targetUser._id,
            ...(Object.keys(dateFilter).length ? dateFilter : {}),
        };
        const tasks = await Task_1.Task.find(match).sort({ createdAt: -1 });
        const header = [
            "Contributor name",
            "Contributor email",
            "Task title",
            "Status",
            "Category",
            "Points",
            "Created (ISO)",
        ];
        const lines = [header];
        for (const t of tasks) {
            lines.push([
                targetUser.name,
                targetUser.email,
                t.title,
                t.status,
                t.category,
                String(t.points ?? ""),
                t.createdAt ? new Date(t.createdAt).toISOString() : "",
            ]);
        }
        const csv = lines.map((row) => row.map(esc).join(",")).join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="contribution-report-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send("\ufeff" + csv);
    }
    catch (err) {
        next(err);
    }
});
// ----- Invoices (travel reimbursement only; tier payouts use /payout-requests) -----
const INVOICE_MAX_AMOUNT = 1000;
/** Roles that cannot submit reimbursements (reviewers / system only). */
function canRaiseInvoice(role) {
    return !["admin", "accounts"].includes(role);
}
function canViewInvoiceStage(role, invoice) {
    if (role === "admin")
        return true;
    if (role === "accounts")
        return ["pending_admin", "pending_accounts", "paid", "rejected"].includes(invoice.status);
    // Evangelist sees only own invoices
    return false;
}
function canViewInvoiceComments(userRole, invoice, userId) {
    if (userRole === "admin")
        return true;
    if (userRole === "accounts")
        return ["pending_admin", "pending_accounts", "paid", "rejected"].includes(invoice.status);
    const ownerId = invoice.submittedBy?._id?.toString?.() ?? invoice.submittedBy?.toString?.();
    return !!(ownerId && userId && ownerId === userId);
}
/** Anyone who can read the thread may post (admin, accounts on visible stages, submitter on own). All statuses including paid/rejected. */
function canPostInvoiceComment(userRole, invoice, userId) {
    return canViewInvoiceComments(userRole, invoice, userId);
}
exports.dashboardRouter.post("/invoices", async (req, res, next) => {
    try {
        if (!canRaiseInvoice(req.user.role)) {
            return res.status(403).json({ message: "Your role cannot submit travel reimbursements" });
        }
        const userId = req.user._id;
        const body = req.body;
        const totalAmountClaimed = Math.min(INVOICE_MAX_AMOUNT, Math.max(0, parseInt(String(body.totalAmountClaimed), 10) || 0));
        if (totalAmountClaimed > INVOICE_MAX_AMOUNT) {
            return res.status(400).json({ message: `Total amount cannot exceed ₹${INVOICE_MAX_AMOUNT}` });
        }
        const payLegacy = String(body.paymentMethod || "upi");
        const invoice = await Invoice_1.Invoice.create({
            submittedBy: userId,
            fullName: String(body.fullName ?? "").trim() || req.user.name,
            email: String(body.email ?? "").trim().toLowerCase() || req.user.email,
            phone: String(body.phone ?? "").trim(),
            osenRole: String(body.osenRole ?? "evangelist"),
            eventName: String(body.eventName ?? "").trim(),
            eventDate: body.eventDate ? new Date(String(body.eventDate)) : new Date(),
            eventPreApproved: !!body.eventPreApproved,
            roleAtEvent: String(body.roleAtEvent ?? "").trim(),
            totalAmountClaimed,
            budgetBreakdown: String(body.budgetBreakdown ?? "").trim(),
            billsDriveLink: String(body.billsDriveLink ?? "").trim(),
            paymentMethod: payLegacy,
            upiId: payLegacy === "upi" ? String(body.upiId ?? "").trim() : undefined,
            bankAccountHolderName: payLegacy === "bank_transfer" ? String(body.bankAccountHolderName ?? "").trim() : undefined,
            bankAccountNumber: payLegacy === "bank_transfer" ? String(body.bankAccountNumber ?? "").trim() : undefined,
            bankIfscCode: payLegacy === "bank_transfer" ? String(body.bankIfscCode ?? "").trim() : undefined,
            notes: String(body.notes ?? "").trim() || undefined,
            confirmationChecked: !!body.confirmationChecked,
        });
        const invMsg = `${invoice.fullName} – ${invoice.eventName} – ₹${invoice.totalAmountClaimed}`;
        const adminUsers = await User_1.User.find({ role: "admin" }).select("_id");
        const notifyIds = adminUsers.map((u) => u._id);
        for (const id of notifyIds) {
            await Notification_1.Notification.create({
                user: id,
                title: "New travel reimbursement submitted",
                message: invMsg,
            });
        }
        (0, notifyEmail_1.queueNotifyUsersByRole)("admin", "New travel reimbursement submitted", invMsg);
        res.status(201).json(invoice);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/invoices", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        if (role === "admin") {
            const invoices = await Invoice_1.Invoice.find({ status: "pending_admin" })
                .populate("submittedBy", "name email role")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role")
                .sort({ createdAt: -1 });
            return res.json(invoices);
        }
        if (role === "accounts") {
            const invoices = await Invoice_1.Invoice.find({ status: { $in: ["pending_accounts", "paid", "rejected"] } })
                .populate("submittedBy", "name email role")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role")
                .sort({ createdAt: -1 });
            return res.json(invoices);
        }
        // evangelist
        const invoices = await Invoice_1.Invoice.find({ submittedBy: userId })
            .populate("submittedBy", "name email role")
            .populate("adminReviewedBy", "name email role")
            .populate("accountsReviewedBy", "name email role")
            .sort({ createdAt: -1 });
        res.json(invoices);
    }
    catch (err) {
        next(err);
    }
});
function escapeCsvCell(v) {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
exports.dashboardRouter.get("/invoices/tracking", async (req, res, next) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;
        const qs = req.query;
        const statusFilter = String(qs.status || "all");
        const nameQ = String(qs.name || "").trim();
        const dateFromStr = String(qs.dateFrom || "").trim();
        const dateToStr = String(qs.dateTo || "").trim();
        const andParts = [];
        // Full list: admin & accounts only. Everyone else sees their own submissions.
        if (role !== "admin" && role !== "accounts") {
            andParts.push({ submittedBy: userId });
        }
        if (statusFilter !== "all" && ["pending_admin", "pending_accounts", "paid", "rejected"].includes(statusFilter)) {
            andParts.push({ status: statusFilter });
        }
        const parseDayStart = (s) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            if (!m)
                return null;
            return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
        };
        const parseDayEnd = (s) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            if (!m)
                return null;
            return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
        };
        if (dateFromStr || dateToStr) {
            const range = {};
            if (dateFromStr) {
                const d = parseDayStart(dateFromStr);
                if (d)
                    range.$gte = d;
            }
            if (dateToStr) {
                const d = parseDayEnd(dateToStr);
                if (d)
                    range.$lte = d;
            }
            if (Object.keys(range).length > 0) {
                andParts.push({ eventDate: range });
            }
        }
        if (nameQ) {
            const esc = nameQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rx = new RegExp(esc, "i");
            const matchingUserIds = await User_1.User.find({
                $or: [{ name: rx }, { email: rx }],
            }).distinct("_id");
            andParts.push({
                $or: [
                    { fullName: rx },
                    { email: rx },
                    { eventName: rx },
                    { submittedBy: { $in: matchingUserIds } },
                ],
            });
        }
        const filter = andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0] : { $and: andParts };
        const invoices = await Invoice_1.Invoice.find(filter)
            .populate("submittedBy", "name email role")
            .populate("adminReviewedBy", "name email role")
            .populate("accountsReviewedBy", "name email role")
            .sort({ createdAt: -1 });
        res.json(invoices);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/invoices/export/paid-csv", async (req, res, next) => {
    try {
        const role = req.user.role;
        if (!["admin", "lead", "accounts"].includes(role)) {
            return res.status(403).json({ message: "Only admin, lead, or accounts can export paid invoices" });
        }
        const invoices = await Invoice_1.Invoice.find({ status: "paid" })
            .populate("submittedBy", "name email")
            .sort({ paidAt: -1, createdAt: -1 });
        const header = [
            "Paid date",
            "Amount (INR)",
            "Payment method",
            "UPI or bank details",
            "Submitter name",
            "Submitter email",
            "Event name",
        ];
        const lines = [header];
        for (const inv of invoices) {
            const sub = inv.submittedBy;
            const paidDate = inv.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : "";
            const amount = String(inv.totalAmountClaimed ?? "");
            const method = inv.paymentMethod === "upi" ? "UPI" : "Bank transfer";
            let details = "";
            if (inv.paymentMethod === "upi") {
                details = inv.upiId || "";
            }
            else {
                details = [inv.bankAccountHolderName, inv.bankAccountNumber, inv.bankIfscCode].filter(Boolean).join(" | ");
            }
            lines.push([
                paidDate,
                amount,
                method,
                details,
                sub?.name || inv.fullName || "",
                sub?.email || inv.email || "",
                inv.eventName || "",
            ]);
        }
        const csv = lines.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="paid-invoices-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send("\ufeff" + csv);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/invoices/:id", async (req, res, next) => {
    try {
        const invoice = await Invoice_1.Invoice.findById(req.params.id)
            .populate("submittedBy", "name email role")
            .populate("adminReviewedBy", "name email role")
            .populate("accountsReviewedBy", "name email role");
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const userId = req.user._id.toString();
        const isOwner = invoice.submittedBy._id.toString() === userId;
        if (isOwner) {
            return res.json(invoice);
        }
        if (req.user.role === "admin") {
            return res.json(invoice);
        }
        if (req.user.role === "accounts" && canViewInvoiceStage(req.user.role, invoice)) {
            return res.json(invoice);
        }
        return res.status(403).json({ message: "You do not have access to this invoice" });
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.patch("/invoices/:id", async (req, res, next) => {
    try {
        const role = req.user.role;
        const invoice = await Invoice_1.Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const { action, reviewNotes } = req.body;
        const notes = reviewNotes != null ? String(reviewNotes).trim() : undefined;
        if (role === "admin") {
            if (invoice.status !== "pending_admin") {
                return res.status(400).json({ message: "Invoice is not pending admin review" });
            }
            if (!action || !["approved", "rejected"].includes(action)) {
                return res.status(400).json({ message: "action must be approved or rejected" });
            }
            invoice.adminReviewedBy = req.user._id;
            invoice.adminReviewedAt = new Date();
            if (notes)
                invoice.adminReviewNotes = notes;
            if (action === "approved") {
                invoice.status = "pending_accounts";
            }
            else {
                invoice.status = "rejected";
            }
            await invoice.save();
            const invSubmitterMsg = action === "approved"
                ? `Your reimbursement for "${invoice.eventName}" (₹${invoice.totalAmountClaimed}) is approved. Accounts will review next.`
                : `Your reimbursement for "${invoice.eventName}" was rejected by admin.${notes ? ` Notes: ${notes}` : ""}`;
            // Notify the submitter
            await Notification_1.Notification.create({
                user: invoice.submittedBy,
                title: action === "approved"
                    ? "Admin approved travel reimbursement"
                    : "Admin rejected travel reimbursement",
                message: invSubmitterMsg,
            });
            (0, notifyEmail_1.queueNotifyUserByEmail)(invoice.submittedBy, action === "approved" ? "Travel reimbursement approved by admin" : "Travel reimbursement rejected by admin", invSubmitterMsg);
            // Notify all accounts users when admin approves
            if (action === "approved") {
                const accMsg = `${invoice.fullName} – ${invoice.eventName} – ₹${invoice.totalAmountClaimed}`;
                const accountsUsers = await User_1.User.find({ role: "accounts" }).select("_id");
                for (const u of accountsUsers) {
                    await Notification_1.Notification.create({
                        user: u._id,
                        title: "Invoice approved by admin",
                        message: accMsg,
                    });
                }
                (0, notifyEmail_1.queueNotifyUsersByRole)("accounts", "Invoice approved by admin", accMsg);
            }
            const updated = await Invoice_1.Invoice.findById(invoice._id)
                .populate("submittedBy", "name email role")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role");
            return res.json(updated);
        }
        if (role === "accounts") {
            if (invoice.status !== "pending_accounts") {
                return res.status(400).json({ message: "Invoice is not pending accounts approval" });
            }
            if (!action || !["paid", "rejected"].includes(action)) {
                return res.status(400).json({ message: "action must be paid or rejected" });
            }
            invoice.accountsReviewedBy = req.user._id;
            invoice.accountsReviewedAt = new Date();
            if (notes)
                invoice.accountsReviewNotes = notes;
            if (action === "paid") {
                invoice.status = "paid";
                invoice.paidAt = new Date();
            }
            else {
                invoice.status = "rejected";
            }
            await invoice.save();
            const invAcctMsg = action === "paid"
                ? `Your reimbursement for "${invoice.eventName}" (₹${invoice.totalAmountClaimed}) has been marked as paid.`
                : `Your reimbursement for "${invoice.eventName}" was rejected by accounts.${notes ? ` Notes: ${notes}` : ""}`;
            await Notification_1.Notification.create({
                user: invoice.submittedBy,
                title: action === "paid" ? "Reimbursement paid" : "Reimbursement rejected by accounts",
                message: invAcctMsg,
            });
            (0, notifyEmail_1.queueNotifyUserByEmail)(invoice.submittedBy, action === "paid" ? "Reimbursement paid" : "Reimbursement rejected by accounts", invAcctMsg);
            const updated = await Invoice_1.Invoice.findById(invoice._id)
                .populate("submittedBy", "name email role")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role");
            return res.json(updated);
        }
        return res.status(403).json({ message: "Forbidden" });
    }
    catch (err) {
        next(err);
    }
});
// ----- Invoice review comments -----
exports.dashboardRouter.get("/invoices/:id/comments", async (req, res, next) => {
    try {
        const invoice = await Invoice_1.Invoice.findById(req.params.id)
            .populate("submittedBy", "_id")
            .populate({
            path: "comments.author",
            select: "name email avatar role",
            model: "User",
        });
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const userId = req.user?._id?.toString?.() ?? null;
        const allowed = canViewInvoiceComments(req.user.role, invoice, userId);
        if (!allowed) {
            return res.status(403).json({ message: "You do not have access to this invoice comments" });
        }
        const raw = invoice.comments;
        const list = Array.isArray(raw) ? raw : [];
        res.json(list.map((c) => ({
            _id: c._id,
            author: c.author,
            role: c.role,
            body: c.body,
            createdAt: c.createdAt,
        })));
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/invoices/:id/comments", async (req, res, next) => {
    try {
        const invoice = await Invoice_1.Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const userId = req.user?._id?.toString?.() ?? null;
        const canPost = canPostInvoiceComment(req.user.role, invoice, userId);
        if (!canPost) {
            return res.status(403).json({ message: "You do not have permission to comment on this invoice" });
        }
        const { body } = req.body;
        if (!body || typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Comment body is required" });
        }
        const comment = {
            author: req.user._id,
            role: req.user.role,
            body: body.trim().slice(0, 2000),
            createdAt: new Date(),
        };
        invoice.comments = Array.isArray(invoice.comments) ? invoice.comments : [];
        invoice.comments.push(comment);
        await invoice.save();
        const updated = await Invoice_1.Invoice.findById(invoice._id).populate("comments.author", "name email avatar role");
        res.status(201).json(updated.comments?.slice(-1)?.[0] ?? null);
    }
    catch (err) {
        next(err);
    }
});
// ----- Points payout requests (tracking-only listing; submit from /points-payout) -----
exports.dashboardRouter.get("/payout-requests/meta", async (req, res, next) => {
    try {
        if (!canRaiseInvoice(req.user.role)) {
            return res.status(403).json({ message: "Your role cannot submit points payout requests" });
        }
        await (0, contributorPeriodService_1.ensureActiveContributorPeriod)();
        const rawPid = String(req.query.contributorPeriodId ?? "").trim();
        let periodDoc = null;
        if (rawPid && mongoose_1.default.isValidObjectId(rawPid)) {
            periodDoc = await ContributorPeriod_1.ContributorPeriod.findById(rawPid);
        }
        if (!periodDoc) {
            periodDoc = await (0, contributorPeriodService_1.ensureActiveContributorPeriod)();
        }
        const periodOid = new mongoose_1.default.Types.ObjectId(String(periodDoc._id));
        const points = await userPointsInContributorPeriod(req.user._id, periodOid);
        const { amount, tierLabel } = (0, payoutTiers_1.getPayoutForPoints)(points, periodDoc.sequence);
        const periods = await ContributorPeriod_1.ContributorPeriod.find().sort({ sequence: -1 }).limit(48).lean();
        const active = periods.find((p) => p.endedAt == null) ?? periods[0];
        res.json({
            fullName: req.user.name || "",
            email: req.user.email || "",
            position: (req.user.position || "").trim(),
            points,
            requestedPayoutINR: amount,
            tierLabel,
            eligible: amount > 0,
            minPoints: payoutTiers_1.MIN_POINTS_FOR_PAYOUT,
            contributorPeriodId: String(periodDoc._id),
            cycleLabel: periodDoc.label,
            periods: periods.map((p) => ({
                _id: p._id,
                sequence: p.sequence,
                label: p.label,
                isActive: p.endedAt == null,
            })),
            suggestedPeriodId: active?._id ? String(active._id) : null,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/payout-requests", async (req, res, next) => {
    try {
        if (!canRaiseInvoice(req.user.role)) {
            return res.status(403).json({ message: "Your role cannot submit points payout requests" });
        }
        const userId = req.user._id;
        const body = req.body;
        const periodId = String(body.contributorPeriodId ?? "").trim();
        if (!periodId || !mongoose_1.default.isValidObjectId(periodId)) {
            return res.status(400).json({ message: "contributorPeriodId is required" });
        }
        const period = await ContributorPeriod_1.ContributorPeriod.findById(periodId);
        if (!period) {
            return res.status(400).json({ message: "Contributor period not found" });
        }
        const periodOid = new mongoose_1.default.Types.ObjectId(String(period._id));
        const points = await userPointsInContributorPeriod(userId, periodOid);
        const { amount, tierLabel } = (0, payoutTiers_1.getPayoutForPoints)(points, period.sequence);
        if (amount <= 0) {
            return res.status(400).json({
                message: `You need at least ${payoutTiers_1.MIN_POINTS_FOR_PAYOUT} completed points in ${period.label} to request a tier payout`,
            });
        }
        const paymentMethod = body.paymentMethod === "bank_transfer" ? "bank_transfer" : "upi";
        const phone = String(body.phone ?? "").trim();
        if (!phone) {
            return res.status(400).json({ message: "Phone is required" });
        }
        if (!body.confirmationChecked) {
            return res.status(400).json({ message: "Please confirm the declaration" });
        }
        let upiId;
        let bankAccountHolderName;
        let bankAccountNumber;
        let bankIfscCode;
        if (paymentMethod === "upi") {
            upiId = String(body.upiId ?? "").trim();
            if (!upiId)
                return res.status(400).json({ message: "UPI ID is required" });
        }
        else {
            bankAccountHolderName = String(body.bankAccountHolderName ?? "").trim();
            bankAccountNumber = String(body.bankAccountNumber ?? "").trim();
            bankIfscCode = String(body.bankIfscCode ?? "").trim();
            if (!bankAccountHolderName || !bankAccountNumber || !bankIfscCode) {
                return res.status(400).json({ message: "Bank account details are required" });
            }
        }
        const doc = await PayoutRequest_1.PayoutRequest.create({
            submittedBy: userId,
            fullName: String(body.fullName ?? "").trim() || req.user.name,
            email: String(body.email ?? "").trim().toLowerCase() || req.user.email,
            phone,
            pointsAtSubmit: points,
            contributorPeriod: period._id,
            cycleLabel: period.label,
            cycleSequence: period.sequence,
            requestedPayoutINR: amount,
            tierLabel,
            paymentMethod,
            upiId,
            bankAccountHolderName,
            bankAccountNumber,
            bankIfscCode,
            notes: String(body.notes ?? "").trim() || undefined,
            confirmationChecked: true,
        });
        const payoutNewMsg = `${doc.fullName} – ${doc.cycleLabel} – ${doc.pointsAtSubmit} pts – ₹${doc.requestedPayoutINR}`;
        const adminUsers = await User_1.User.find({ role: "admin" }).select("_id");
        for (const id of adminUsers) {
            await Notification_1.Notification.create({
                user: id._id,
                title: "New points payout request",
                message: payoutNewMsg,
            });
        }
        (0, notifyEmail_1.queueNotifyUsersByRole)("admin", "New points payout request", payoutNewMsg);
        const populated = await PayoutRequest_1.PayoutRequest.findById(doc._id)
            .populate("submittedBy", "name email role")
            .populate("contributorPeriod", "sequence label startedAt endedAt");
        res.status(201).json(populated);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/payout-requests/tracking", async (req, res, next) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;
        const qs = req.query;
        const statusFilter = String(qs.status || "all");
        const nameQ = String(qs.name || "").trim();
        const dateFromStr = String(qs.dateFrom || "").trim();
        const dateToStr = String(qs.dateTo || "").trim();
        const andParts = [];
        if (role !== "admin" && role !== "accounts") {
            andParts.push({ submittedBy: userId });
        }
        if (statusFilter !== "all" && ["pending_admin", "pending_accounts", "paid", "rejected"].includes(statusFilter)) {
            andParts.push({ status: statusFilter });
        }
        const parseDayStart = (s) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            if (!m)
                return null;
            return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
        };
        const parseDayEnd = (s) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            if (!m)
                return null;
            return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
        };
        if (dateFromStr || dateToStr) {
            const range = {};
            if (dateFromStr) {
                const d = parseDayStart(dateFromStr);
                if (d)
                    range.$gte = d;
            }
            if (dateToStr) {
                const d = parseDayEnd(dateToStr);
                if (d)
                    range.$lte = d;
            }
            if (Object.keys(range).length > 0) {
                andParts.push({ createdAt: range });
            }
        }
        if (nameQ) {
            const esc = nameQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rx = new RegExp(esc, "i");
            const matchingUserIds = await User_1.User.find({
                $or: [{ name: rx }, { email: rx }],
            }).distinct("_id");
            andParts.push({
                $or: [{ fullName: rx }, { email: rx }, { cycleLabel: rx }, { submittedBy: { $in: matchingUserIds } }],
            });
        }
        const filter = andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0] : { $and: andParts };
        const list = await PayoutRequest_1.PayoutRequest.find(filter)
            .populate("submittedBy", "name email role")
            .populate("contributorPeriod", "_id sequence label")
            .populate("adminReviewedBy", "name email role")
            .populate("accountsReviewedBy", "name email role")
            .sort({ createdAt: -1 });
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/payout-requests/:id", async (req, res, next) => {
    try {
        const doc = await PayoutRequest_1.PayoutRequest.findById(req.params.id)
            .populate("submittedBy", "name email role")
            .populate("contributorPeriod", "sequence label startedAt endedAt")
            .populate("adminReviewedBy", "name email role")
            .populate("accountsReviewedBy", "name email role");
        if (!doc) {
            return res.status(404).json({ message: "Payout request not found" });
        }
        const userId = req.user._id.toString();
        const isOwner = doc.submittedBy._id.toString() === userId;
        if (isOwner) {
            return res.json(doc);
        }
        if (req.user.role === "admin") {
            return res.json(doc);
        }
        if (req.user.role === "accounts" && canViewPayoutStage(req.user.role, doc)) {
            return res.json(doc);
        }
        return res.status(403).json({ message: "You do not have access to this payout request" });
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.patch("/payout-requests/:id", async (req, res, next) => {
    try {
        const role = req.user.role;
        const doc = await PayoutRequest_1.PayoutRequest.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ message: "Payout request not found" });
        }
        const { action, reviewNotes } = req.body;
        const notes = reviewNotes != null ? String(reviewNotes).trim() : undefined;
        if (role === "admin") {
            if (doc.status !== "pending_admin") {
                return res.status(400).json({ message: "Request is not pending admin review" });
            }
            if (!action || !["approved", "rejected"].includes(action)) {
                return res.status(400).json({ message: "action must be approved or rejected" });
            }
            doc.adminReviewedBy = req.user._id;
            doc.adminReviewedAt = new Date();
            if (notes)
                doc.adminReviewNotes = notes;
            if (action === "approved") {
                doc.status = "pending_accounts";
            }
            else {
                doc.status = "rejected";
            }
            await doc.save();
            const payoutAdminMsg = action === "approved"
                ? `Your points payout (${doc.cycleLabel}, ₹${doc.requestedPayoutINR}) is approved. Accounts will process next.`
                : `Your points payout request was rejected by admin.${notes ? ` Notes: ${notes}` : ""}`;
            await Notification_1.Notification.create({
                user: doc.submittedBy,
                title: action === "approved" ? "Points payout approved by admin" : "Points payout rejected by admin",
                message: payoutAdminMsg,
            });
            (0, notifyEmail_1.queueNotifyUserByEmail)(doc.submittedBy, action === "approved" ? "Points payout approved by admin" : "Points payout rejected by admin", payoutAdminMsg);
            if (action === "approved") {
                const pAccMsg = `${doc.fullName} – ${doc.cycleLabel} – ₹${doc.requestedPayoutINR}`;
                const accountsUsers = await User_1.User.find({ role: "accounts" }).select("_id");
                for (const u of accountsUsers) {
                    await Notification_1.Notification.create({
                        user: u._id,
                        title: "Points payout approved — needs accounts",
                        message: pAccMsg,
                    });
                }
                (0, notifyEmail_1.queueNotifyUsersByRole)("accounts", "Points payout approved — needs accounts", pAccMsg);
            }
            const updated = await PayoutRequest_1.PayoutRequest.findById(doc._id)
                .populate("submittedBy", "name email role")
                .populate("contributorPeriod", "sequence label startedAt endedAt")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role");
            return res.json(updated);
        }
        if (role === "accounts") {
            if (doc.status !== "pending_accounts") {
                return res.status(400).json({ message: "Request is not pending accounts approval" });
            }
            if (!action || !["paid", "rejected"].includes(action)) {
                return res.status(400).json({ message: "action must be paid or rejected" });
            }
            doc.accountsReviewedBy = req.user._id;
            doc.accountsReviewedAt = new Date();
            if (notes)
                doc.accountsReviewNotes = notes;
            if (action === "paid") {
                doc.status = "paid";
                doc.paidAt = new Date();
            }
            else {
                doc.status = "rejected";
            }
            await doc.save();
            const payoutAcctMsg = action === "paid"
                ? `Your points payout (${doc.cycleLabel}, ₹${doc.requestedPayoutINR}) has been marked as paid.`
                : `Your points payout was rejected by accounts.${notes ? ` Notes: ${notes}` : ""}`;
            await Notification_1.Notification.create({
                user: doc.submittedBy,
                title: action === "paid" ? "Points payout marked paid" : "Points payout rejected by accounts",
                message: payoutAcctMsg,
            });
            (0, notifyEmail_1.queueNotifyUserByEmail)(doc.submittedBy, action === "paid" ? "Points payout marked paid" : "Points payout rejected by accounts", payoutAcctMsg);
            const updated = await PayoutRequest_1.PayoutRequest.findById(doc._id)
                .populate("submittedBy", "name email role")
                .populate("contributorPeriod", "sequence label startedAt endedAt")
                .populate("adminReviewedBy", "name email role")
                .populate("accountsReviewedBy", "name email role");
            return res.json(updated);
        }
        return res.status(403).json({ message: "Forbidden" });
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.get("/payout-requests/:id/comments", async (req, res, next) => {
    try {
        const doc = await PayoutRequest_1.PayoutRequest.findById(req.params.id)
            .populate("submittedBy", "_id")
            .populate({
            path: "comments.author",
            select: "name email avatar role",
            model: "User",
        });
        if (!doc) {
            return res.status(404).json({ message: "Payout request not found" });
        }
        const userId = req.user?._id?.toString?.() ?? null;
        const allowed = canViewPayoutComments(req.user.role, doc, userId);
        if (!allowed) {
            return res.status(403).json({ message: "You do not have access to these comments" });
        }
        const raw = doc.comments;
        const list = Array.isArray(raw) ? raw : [];
        res.json(list.map((c) => ({
            _id: c._id,
            author: c.author,
            role: c.role,
            body: c.body,
            createdAt: c.createdAt,
        })));
    }
    catch (err) {
        next(err);
    }
});
exports.dashboardRouter.post("/payout-requests/:id/comments", async (req, res, next) => {
    try {
        const doc = await PayoutRequest_1.PayoutRequest.findById(req.params.id).populate("submittedBy", "_id");
        if (!doc) {
            return res.status(404).json({ message: "Payout request not found" });
        }
        const userId = req.user?._id?.toString?.() ?? null;
        if (!canPostPayoutComment(req.user.role, doc, userId)) {
            return res.status(403).json({ message: "You do not have permission to comment on this request" });
        }
        const { body } = req.body;
        if (!body || typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Comment body is required" });
        }
        const comment = {
            author: req.user._id,
            role: req.user.role,
            body: body.trim().slice(0, 2000),
            createdAt: new Date(),
        };
        doc.comments = Array.isArray(doc.comments) ? doc.comments : [];
        doc.comments.push(comment);
        await doc.save();
        const updated = await PayoutRequest_1.PayoutRequest.findById(doc._id).populate("comments.author", "name email avatar role");
        res.status(201).json(updated.comments?.slice(-1)?.[0] ?? null);
    }
    catch (err) {
        next(err);
    }
});
