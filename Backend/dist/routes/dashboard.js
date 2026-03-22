"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const Comment_1 = require("../models/Comment");
const Invoice_1 = require("../models/Invoice");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.use(auth_1.requireAuth);
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
        const task = await Task_1.Task.create({
            title,
            description: description || "",
            contributionType,
            category: category || "community",
            priority: "medium",
            points: pts,
            assignedTo: userId,
            createdBy: userId,
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
            .sort({ createdAt: -1 });
        res.json(tasks);
    }
    catch (err) {
        next(err);
    }
});
/** Claim an open pool task — only admin/lead (instant). Contributors use POST .../request-assignment. */
exports.dashboardRouter.post("/tasks/:id/claim", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        if (!["admin", "lead"].includes(role)) {
            return res.status(403).json({
                message: "Contributors must request assignment. Use “Request assignment” — an admin or lead will approve.",
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
/** Contributor asks to be assigned to an open pool task — admin/lead approves in Admin panel. */
exports.dashboardRouter.post("/tasks/:id/request-assignment", async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        if (["admin", "lead"].includes(role)) {
            return res.status(400).json({
                message: "Use Claim to assign yourself instantly, or manage tasks from the Admin panel.",
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
        const managers = await User_1.User.find({ role: { $in: ["admin", "lead"] } }).select("_id");
        for (const m of managers) {
            await Notification_1.Notification.create({
                user: m._id,
                title: "Assignment request",
                message: `${requesterName} wants to work on "${task.title}"`,
            });
        }
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
                (cur === "submitted" && nextStatus === "submitted");
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
            if (!["in_progress", "submitted"].includes(task.status)) {
                return res.status(400).json({
                    message: "You can add or edit submission details while the task is in progress or waiting for review.",
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
        const comments = await Comment_1.Comment.find({ task: task._id })
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
        if (!body || typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Comment body is required" });
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
        });
        const populated = await Comment_1.Comment.findById(comment._id).populate("author", "name email avatar");
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
exports.dashboardRouter.get("/leaderboard", async (_req, res, next) => {
    try {
        const leaderboard = await Task_1.Task.aggregate([
            { $match: { status: "completed" } },
            {
                $group: {
                    _id: "$assignedTo",
                    totalPoints: { $sum: "$points" },
                    completedTasks: { $sum: 1 },
                },
            },
            { $sort: { totalPoints: -1 } },
            { $limit: 20 },
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
        res.json(withAvatar);
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
// ----- Invoices (Travel Reimbursement) -----
const INVOICE_MAX_AMOUNT = 1000;
/** Roles that cannot submit reimbursements (reviewers / system only). */
function canRaiseInvoice(role) {
    return !["admin", "accounts"].includes(role);
}
function canViewInvoiceStage(role, invoice) {
    if (role === "admin")
        return true;
    if (role === "accounts")
        return ["pending_accounts", "paid"].includes(invoice.status);
    // Evangelist sees only own invoices
    return false;
}
function canViewInvoiceComments(userRole, invoice, userId) {
    if (userRole === "admin")
        return true;
    if (userRole === "accounts")
        return ["pending_accounts", "paid", "rejected"].includes(invoice.status);
    const ownerId = invoice.submittedBy?._id?.toString?.() ?? invoice.submittedBy?.toString?.();
    return !!(ownerId && userId && ownerId === userId);
}
function canPostInvoiceComment(userRole, invoice) {
    if (userRole === "admin")
        return invoice.status === "pending_admin";
    if (userRole === "accounts")
        return invoice.status === "pending_accounts";
    return false;
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
        const invoice = await Invoice_1.Invoice.create({
            submittedBy: userId,
            fullName: (body.fullName || "").trim() || req.user.name,
            email: (body.email || "").trim().toLowerCase() || req.user.email,
            phone: (body.phone || "").trim(),
            osenRole: body.osenRole || "evangelist",
            eventName: (body.eventName || "").trim(),
            eventDate: body.eventDate ? new Date(body.eventDate) : new Date(),
            eventPreApproved: !!body.eventPreApproved,
            roleAtEvent: (body.roleAtEvent || "").trim(),
            totalAmountClaimed,
            budgetBreakdown: (body.budgetBreakdown || "").trim(),
            billsDriveLink: (body.billsDriveLink || "").trim(),
            paymentMethod: body.paymentMethod || "upi",
            upiId: body.paymentMethod === "upi" ? (body.upiId || "").trim() : undefined,
            bankAccountHolderName: body.paymentMethod === "bank_transfer" ? (body.bankAccountHolderName || "").trim() : undefined,
            bankAccountNumber: body.paymentMethod === "bank_transfer" ? (body.bankAccountNumber || "").trim() : undefined,
            bankIfscCode: body.paymentMethod === "bank_transfer" ? (body.bankIfscCode || "").trim() : undefined,
            notes: (body.notes || "").trim() || undefined,
            confirmationChecked: !!body.confirmationChecked,
        });
        const adminUsers = await User_1.User.find({ role: "admin" }).select("_id");
        const notifyIds = adminUsers.map((u) => u._id);
        for (const id of notifyIds) {
            await Notification_1.Notification.create({
                user: id,
                title: "New travel reimbursement submitted",
                message: `${invoice.fullName} – ${invoice.eventName} – ₹${invoice.totalAmountClaimed}`,
            });
        }
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
            const invoices = await Invoice_1.Invoice.find({ status: { $in: ["pending_accounts", "paid"] } })
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
            // Notify the submitter
            await Notification_1.Notification.create({
                user: invoice.submittedBy,
                title: action === "approved"
                    ? "Admin approved travel reimbursement"
                    : "Admin rejected travel reimbursement",
                message: action === "approved"
                    ? `Your reimbursement for "${invoice.eventName}" (₹${invoice.totalAmountClaimed}) is approved. Accounts will review next.`
                    : `Your reimbursement for "${invoice.eventName}" was rejected by admin.${notes ? ` Notes: ${notes}` : ""}`,
            });
            // Notify all accounts users when admin approves
            if (action === "approved") {
                const accountsUsers = await User_1.User.find({ role: "accounts" }).select("_id");
                for (const u of accountsUsers) {
                    await Notification_1.Notification.create({
                        user: u._id,
                        title: "Invoice approved by admin",
                        message: `${invoice.fullName} – ${invoice.eventName} – ₹${invoice.totalAmountClaimed}`,
                    });
                }
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
            await Notification_1.Notification.create({
                user: invoice.submittedBy,
                title: action === "paid" ? "Reimbursement paid" : "Reimbursement rejected by accounts",
                message: action === "paid"
                    ? `Your reimbursement for "${invoice.eventName}" (₹${invoice.totalAmountClaimed}) has been marked as paid.`
                    : `Your reimbursement for "${invoice.eventName}" was rejected by accounts.${notes ? ` Notes: ${notes}` : ""}`,
            });
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
        const invoice = await Invoice_1.Invoice.findById(req.params.id).populate("comments.author", "name email avatar role");
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const userId = req.user?._id?.toString?.() ?? null;
        const allowed = canViewInvoiceComments(req.user.role, invoice, userId);
        if (!allowed) {
            return res.status(403).json({ message: "You do not have access to this invoice comments" });
        }
        res.json(invoice.comments || []);
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
        const canPost = canPostInvoiceComment(req.user.role, invoice);
        if (!canPost) {
            return res.status(403).json({ message: "You do not have permission to comment at this stage" });
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
