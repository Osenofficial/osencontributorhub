"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const LeadActionRequest_1 = require("../models/LeadActionRequest");
const Announcement_1 = require("../models/Announcement");
const notifyEmail_1 = require("../lib/notifyEmail");
const taskNotification_1 = require("../lib/taskNotification");
const contributorPeriodService_1 = require("../lib/contributorPeriodService");
const ANNOUNCEMENT_ROLES = [
    "admin",
    "lead",
    "associate",
    "intern",
    "accounts",
    "evangelist",
];
function announcementRecipientFilter(validRoles) {
    return {
        role: { $in: validRoles },
        status: "active",
        email: { $exists: true, $nin: [null, ""] },
    };
}
function allActiveRecipientFilter(excludeAdmins) {
    return {
        status: "active",
        email: { $exists: true, $nin: [null, ""] },
        ...(excludeAdmins ? { role: { $ne: "admin" } } : {}),
    };
}
function parseAnnouncementTargetRoles(rolesRaw) {
    const targetRoles = Array.isArray(rolesRaw)
        ? [...new Set(rolesRaw.map((r) => String(r).trim()).filter(Boolean))]
        : [];
    return targetRoles.filter((r) => ANNOUNCEMENT_ROLES.includes(r));
}
async function sendAnnouncementEmailWithRetry(email, title, message) {
    let last = { ok: false, error: "Not attempted" };
    for (let attempt = 0; attempt < 3; attempt++) {
        last = await (0, notifyEmail_1.sendNotificationEmailToAddress)(email, title, message);
        if (last.ok || ("skipped" in last && last.skipped))
            return last;
        if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
    }
    return last;
}
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth);
// Stats - admins and leads
exports.adminRouter.get("/stats", (0, auth_1.requireRole)("admin", "lead"), async (_req, res, next) => {
    try {
        const [totalUsers, totalTasks, completedTasks] = await Promise.all([
            User_1.User.countDocuments(),
            Task_1.Task.countDocuments(),
            Task_1.Task.countDocuments({ status: "completed" }),
        ]);
        res.json({
            totalUsers,
            totalTasks,
            completedTasks,
            completionRate: totalTasks ? completedTasks / totalTasks : 0,
        });
    }
    catch (err) {
        next(err);
    }
});
// User list — admins (full management) and leads (needed to assign members when creating tasks)
exports.adminRouter.get("/users", (0, auth_1.requireRole)("admin", "lead"), async (_req, res, next) => {
    try {
        const users = await User_1.User.find().sort({ createdAt: -1 }).select("-passwordHash");
        const activeStatuses = ["todo", "in_progress", "submitted"];
        const counts = await Task_1.Task.aggregate([
            {
                $match: {
                    assignedTo: { $ne: null },
                    status: { $in: activeStatuses },
                },
            },
            { $group: { _id: "$assignedTo", pendingTaskCount: { $sum: 1 } } },
        ]);
        const countMap = new Map(counts.map((c) => [String(c._id), c.pendingTaskCount]));
        const enriched = users.map((u) => ({
            ...u.toObject(),
            pendingTaskCount: countMap.get(String(u._id)) ?? 0,
            activeTaskCount: countMap.get(String(u._id)) ?? 0,
        }));
        res.json(enriched);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.patch("/users/:id/role", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const { role } = req.body;
        const existing = await User_1.User.findById(req.params.id).select("role");
        if (!existing) {
            return res.status(404).json({ message: "User not found" });
        }
        const prevRole = existing.role;
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (role && role !== prevRole) {
            await Notification_1.Notification.create({
                user: user._id,
                title: "Your role was updated",
                message: `Your role has been changed from ${prevRole} to ${role}.`,
            });
        }
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// User approval / suspension - admins only
exports.adminRouter.post("/users/:id/approve", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { status: "active", isActive: true }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await Notification_1.Notification.create({
            user: user._id,
            title: "Account approved",
            message: `Welcome, ${user.name}! Your account has been approved. You can now log in to the contributor hub.`,
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/users/:id/reject", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { status: "rejected", isActive: false }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await Notification_1.Notification.create({
            user: user._id,
            title: "Signup not approved",
            message: `Your signup request for ${user.email} was not approved. Contact your admin if you believe this is a mistake.`,
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/users/:id/suspend", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { status: "suspended", isActive: false }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await Notification_1.Notification.create({
            user: user._id,
            title: "Account suspended",
            message: "Your account has been suspended. Contact your admin if you need access restored.",
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/users/:id/activate", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { status: "active", isActive: true }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await Notification_1.Notification.create({
            user: user._id,
            title: "Account re-activated",
            message: "Your account has been re-activated. You can log in again.",
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// Tasks - admins and leads can manage
exports.adminRouter.post("/tasks", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const adminId = req.user._id;
        const { title, description, points, assignedTo, deadline, category, contributionType, priority, assignmentNote } = req.body;
        const assigneeId = assignedTo != null && String(assignedTo).trim() !== "" && assignedTo !== "__pool__"
            ? assignedTo
            : null;
        const noteTrimmed = assigneeId && assignmentNote != null ? String(assignmentNote).trim().slice(0, 500) : "";
        const assignErr = await assigneeValidationError(assigneeId);
        if (assignErr) {
            return res.status(400).json({ message: assignErr });
        }
        const period = await (0, contributorPeriodService_1.ensureActiveContributorPeriod)(adminId);
        const task = await Task_1.Task.create({
            title,
            description,
            points: points ?? 0,
            category,
            contributionType,
            priority,
            assignedTo: assigneeId,
            assignmentNote: noteTrimmed || undefined,
            createdBy: adminId,
            contributorPeriod: period._id,
            deadline,
            history: [
                {
                    actor: adminId,
                    action: "created",
                    fromStatus: "todo",
                    toStatus: "todo",
                    createdAt: new Date(),
                    meta: { assignedTo: assigneeId },
                },
            ],
        });
        if (assigneeId) {
            await (0, taskNotification_1.notifyUserAboutTask)(assigneeId, task._id, "New Task Assigned", (0, taskNotification_1.buildAssignmentNotificationMessage)(title, noteTrimmed));
        }
        res.status(201).json(task);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/contributor-periods/start", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const result = await (0, contributorPeriodService_1.startNextContributorPeriod)(req.user._id);
        res.status(201).json({
            previous: {
                id: result.previous._id,
                sequence: result.previous.sequence,
                label: result.previous.label,
                startedAt: result.previous.startedAt,
                endedAt: result.previous.endedAt,
            },
            active: {
                id: result.active._id,
                sequence: result.active.sequence,
                label: result.active.label,
                startedAt: result.active.startedAt,
                endedAt: result.active.endedAt,
                isActive: true,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.get("/tasks", (0, auth_1.requireRole)("admin", "lead"), async (_req, res, next) => {
    try {
        const tasks = await Task_1.Task.find()
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("contributorPeriod", "sequence label startedAt endedAt")
            .populate("pendingAssignmentRequests.user", "name email")
            .sort({ createdAt: -1 });
        res.json(tasks);
    }
    catch (err) {
        next(err);
    }
});
const CREATOR_EDIT_FIELDS = [
    "title",
    "description",
    "deadline",
    "category",
    "contributionType",
    "priority",
    "assignedTo",
    "points",
    "assignmentNote",
];
function taskCreatedByUser(task, userId) {
    const createdBy = task.createdBy;
    const creatorId = createdBy?._id ?? task.createdBy;
    return creatorId != null && String(creatorId) === String(userId);
}
/** These roles cannot be picked as task assignees (UI + API). */
const ROLES_EXCLUDED_FROM_TASK_ASSIGNMENT = ["accounts", "evangelist"];
function parseAssigneeIdFromBody(assignedTo) {
    if (assignedTo == null || String(assignedTo).trim() === "" || assignedTo === "__pool__")
        return null;
    return String(assignedTo);
}
async function assigneeValidationError(assigneeId) {
    if (!assigneeId)
        return null;
    const u = await User_1.User.findById(assigneeId).select("role status isActive");
    if (!u)
        return "Assignee not found";
    if (u.status === "rejected") {
        return "Rejected users cannot be assigned tasks";
    }
    if (u.status === "pending") {
        return "Pending users cannot be assigned tasks until an admin approves their account";
    }
    if (u.status === "suspended" || !u.isActive) {
        return "Suspended users cannot be assigned tasks";
    }
    if (ROLES_EXCLUDED_FROM_TASK_ASSIGNMENT.includes(String(u.role))) {
        return "Accounts and evangelist users cannot be assigned tasks";
    }
    return null;
}
/**
 * Lead may PATCH only `{ assignedTo: ownUserId }` to claim an open pool task (no other fields).
 * Reassigning from another user still requires an admin-approved edit request.
 */
function isLeadSelfAssignOnlyPatch(req, body, task) {
    if (req.user.role !== "lead")
        return false;
    if (task.assignedTo != null)
        return false;
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "assignedTo")
        return false;
    const next = parseAssigneeIdFromBody(body.assignedTo);
    return Boolean(next && String(next) === String(req.user._id));
}
function applyCreatorPayloadToTask(task, body) {
    const { title, description, deadline, category, contributionType, priority, assignedTo, points, assignmentNote } = body;
    if (title !== undefined)
        task.title = String(title).trim();
    if (description !== undefined)
        task.description = String(description ?? "");
    if (deadline !== undefined) {
        task.deadline = deadline ? new Date(String(deadline)) : undefined;
    }
    if (category !== undefined)
        task.category = category;
    if (contributionType !== undefined)
        task.contributionType = contributionType;
    if (priority !== undefined)
        task.priority = priority;
    if (assignedTo !== undefined) {
        const assigneeId = assignedTo != null &&
            String(assignedTo).trim() !== "" &&
            assignedTo !== "__pool__"
            ? assignedTo
            : null;
        task.assignedTo = assigneeId;
    }
    if (points !== undefined) {
        const p = Math.min(100, Math.max(1, parseInt(String(points), 10) || 10));
        task.points = p;
    }
    if (assignmentNote !== undefined) {
        const note = String(assignmentNote ?? "").trim().slice(0, 500);
        task.assignmentNote = note || undefined;
    }
}
async function notifyAdminsLeadActionLine(message) {
    const admins = await User_1.User.find({ role: "admin" }).select("_id");
    for (const a of admins) {
        await Notification_1.Notification.create({
            user: a._id,
            title: "Lead action needs approval",
            message,
        });
    }
}
exports.adminRouter.patch("/tasks/:id", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const isAdmin = req.user.role === "admin";
        const isLead = req.user.role === "lead";
        const leadOwnsTask = isLead && taskCreatedByUser(task, req.user._id);
        const hasCreatorUpdates = CREATOR_EDIT_FIELDS.some((k) => req.body[k] !== undefined);
        const leadSelfAssignOnly = isLeadSelfAssignOnlyPatch(req, req.body, task);
        if (hasCreatorUpdates) {
            if (isLead && !leadSelfAssignOnly && !leadOwnsTask) {
                return res.status(403).json({
                    code: "LEAD_REQUIRES_APPROVAL",
                    message: "Leads cannot edit tasks they did not create. Submit an edit request from the Tasks panel — an admin must approve before changes apply.",
                });
            }
            if (!isLead && !isAdmin && !taskCreatedByUser(task, req.user._id)) {
                return res.status(403).json({ message: "Only the task creator or an admin can edit task details" });
            }
            const prevAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
            if (req.body.assignedTo !== undefined) {
                const nextAssignee = parseAssigneeIdFromBody(req.body.assignedTo);
                const assignErr = await assigneeValidationError(nextAssignee);
                if (assignErr) {
                    return res.status(400).json({ message: assignErr });
                }
            }
            applyCreatorPayloadToTask(task, req.body);
            task.history.push({
                actor: req.user._id,
                action: "edited",
                fromStatus: task.status,
                toStatus: task.status,
                createdAt: new Date(),
                meta: { fields: CREATOR_EDIT_FIELDS.filter((k) => req.body[k] !== undefined) },
            });
            if (req.body.assignedTo !== undefined) {
                const nextAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
                if (nextAssigneeId && nextAssigneeId !== prevAssigneeId) {
                    await (0, taskNotification_1.notifyUserAboutTask)(nextAssigneeId, task._id, "New Task Assigned", (0, taskNotification_1.buildAssignmentNotificationMessage)(task.title, task.assignmentNote));
                }
            }
        }
        const fromStatus = task.status;
        if (req.body.status !== undefined) {
            if (isLead && !leadOwnsTask) {
                return res.status(403).json({
                    code: "LEAD_REQUIRES_APPROVAL",
                    message: "Leads cannot approve or reject submissions on tasks they did not create. Submit a request from the Tasks panel — an admin must approve.",
                });
            }
            const nextStatus = req.body.status;
            if (fromStatus === "completed") {
                if (nextStatus === "rejected") {
                    if (!isAdmin) {
                        return res.status(403).json({
                            message: "Only an admin can undo a mistaken approval by marking the task as rejected.",
                        });
                    }
                }
                else if (nextStatus !== fromStatus) {
                    return res.status(400).json({
                        message: "Completed tasks cannot change status except an admin may reject to undo a mistaken approval.",
                    });
                }
            }
            task.status = nextStatus;
        }
        const rejectComment = typeof req.body.rejectComment === "string" ? req.body.rejectComment.trim().slice(0, 500) : "";
        const statusChanged = fromStatus !== task.status;
        if (statusChanged) {
            task.history.push({
                actor: req.user._id,
                action: "admin_update",
                fromStatus,
                toStatus: task.status,
                createdAt: new Date(),
                meta: task.status === "rejected" && rejectComment
                    ? { rejectComment }
                    : req.body.points !== undefined && typeof req.body.points === "number"
                        ? { points: req.body.points }
                        : undefined,
            });
        }
        await task.save();
        if (fromStatus === "submitted" && task.status === "completed" && task.assignedTo) {
            const msg = `Your submission for "${task.title}" has been approved!`;
            await (0, taskNotification_1.notifyUserAboutTask)(task.assignedTo, task._id, "Task Approved", msg);
        }
        if (fromStatus === "submitted" && (task.status === "rejected" || task.status === "in_progress") && task.assignedTo) {
            const msg = rejectComment
                ? `Your submission for "${task.title}" was not approved. Note from reviewer: "${rejectComment}". Please revise and resubmit when ready.`
                : `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`;
            await (0, taskNotification_1.notifyUserAboutTask)(task.assignedTo, task._id, "Submission needs revision", msg);
        }
        if (fromStatus === "completed" && task.status === "rejected" && task.assignedTo) {
            const msg = rejectComment
                ? `Your completed task "${task.title}" was marked rejected by an admin (approval reversed). Reason: "${rejectComment}". Contact your lead if this is unexpected.`
                : `Your completed task "${task.title}" was marked rejected by an admin to reverse a mistaken approval. Contact your lead if this is unexpected.`;
            await (0, taskNotification_1.notifyUserAboutTask)(task.assignedTo, task._id, "Task approval reversed", msg);
        }
        const populated = await Task_1.Task.findById(task._id)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email");
        res.json(populated);
    }
    catch (err) {
        next(err);
    }
});
/** Admins may delete any task. Leads may delete tasks they created. */
exports.adminRouter.delete("/tasks/:id", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (req.user.role !== "admin" && !taskCreatedByUser(task, req.user._id)) {
            return res.status(403).json({
                code: "LEAD_REQUIRES_APPROVAL",
                message: "Leads can only delete tasks they created. Submit a delete request for other tasks — an admin must approve it.",
            });
        }
        const assigneeId = task.assignedTo;
        const taskTitle = task.title;
        await Task_1.Task.findByIdAndDelete(req.params.id);
        if (assigneeId) {
            await Notification_1.Notification.create({
                user: assigneeId,
                title: "Task removed",
                message: `The task "${taskTitle}" has been removed.`,
            });
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
/** Tasks with at least one pending assignment request (pool tasks contributors asked for). */
exports.adminRouter.get("/pending-assignment-requests", (0, auth_1.requireRole)("admin", "lead"), async (_req, res, next) => {
    try {
        const tasks = await Task_1.Task.find({ "pendingAssignmentRequests.0": { $exists: true } })
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("pendingAssignmentRequests.user", "name email")
            .sort({ updatedAt: -1 });
        res.json(tasks);
    }
    catch (err) {
        next(err);
    }
});
/** Approve one contributor — assign task to them and clear pending requests. */
exports.adminRouter.post("/tasks/:id/approve-assignment", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId || String(userId).trim() === "") {
            return res.status(400).json({ message: "userId is required" });
        }
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (task.assignedTo != null) {
            return res.status(400).json({ message: "Task is already assigned" });
        }
        const pending = (task.pendingAssignmentRequests || []).some((p) => p.user.toString() === String(userId));
        if (!pending) {
            return res.status(400).json({ message: "No pending request from this user for this task" });
        }
        const assignErr = await assigneeValidationError(String(userId));
        if (assignErr) {
            return res.status(400).json({ message: assignErr });
        }
        task.assignedTo = userId;
        task.pendingAssignmentRequests = [];
        task.history.push({
            actor: req.user._id,
            action: "assignment_approved",
            fromStatus: task.status,
            toStatus: task.status,
            createdAt: new Date(),
            meta: { assignedTo: userId },
        });
        await task.save();
        const assignMsg = `You've been assigned: "${task.title}"`;
        await (0, taskNotification_1.notifyUserAboutTask)(userId, task._id, "Task assigned to you", assignMsg);
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
/** Remove one user's request without assigning (decline). Admin only. */
exports.adminRouter.post("/tasks/:id/reject-assignment", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const before = (task.pendingAssignmentRequests || []).length;
        task.pendingAssignmentRequests = (task.pendingAssignmentRequests || []).filter((p) => p.user.toString() !== String(userId));
        if (task.pendingAssignmentRequests.length === before) {
            return res.status(400).json({ message: "No pending request from this user" });
        }
        await task.save();
        const declineMsg = `Your request to work on "${task.title}" was declined.`;
        await Notification_1.Notification.create({
            user: userId,
            title: "Assignment request",
            message: declineMsg,
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
const LEAD_ACTION_TYPES = [
    "edit_task",
    "delete_task",
    "reject_submission",
    "approve_submission",
];
/** Lead submits edit/delete/approve/reject — admins approve here (all task changes go through this for leads). */
exports.adminRouter.post("/lead-action-requests", (0, auth_1.requireRole)("lead"), async (req, res, next) => {
    try {
        const { type, taskId, payload, reason: reasonRaw } = req.body;
        const reason = String(reasonRaw ?? "").trim();
        if (!reason) {
            return res.status(400).json({ message: "reason is required — explain why you need this action" });
        }
        if (reason.length > 2000) {
            return res.status(400).json({ message: "reason must be at most 2000 characters" });
        }
        if (reason.length < 5) {
            return res.status(400).json({ message: "reason must be at least 5 characters" });
        }
        if (!type || !taskId || !LEAD_ACTION_TYPES.includes(type)) {
            return res.status(400).json({ message: "type and taskId are required; type must be valid" });
        }
        const task = await Task_1.Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (type === "approve_submission" || type === "reject_submission") {
            if (task.status !== "submitted") {
                return res.status(400).json({ message: "Task must be in submitted status" });
            }
        }
        if (type === "edit_task") {
            if (!payload || typeof payload !== "object") {
                return res.status(400).json({ message: "payload is required for edit_task" });
            }
        }
        const dup = await LeadActionRequest_1.LeadActionRequest.findOne({
            task: taskId,
            requestedBy: req.user._id,
            status: "pending",
            type,
        });
        if (dup) {
            return res.status(400).json({ message: "You already have a pending request of this type for this task" });
        }
        const normalizedPayload = type === "edit_task"
            ? payload
            : type === "reject_submission"
                ? {
                    rejectComment: typeof payload?.rejectComment === "string"
                        ? String(payload.rejectComment).trim().slice(0, 500)
                        : undefined,
                }
                : undefined;
        const doc = await LeadActionRequest_1.LeadActionRequest.create({
            type,
            task: taskId,
            requestedBy: req.user._id,
            status: "pending",
            payload: normalizedPayload,
            reason,
        });
        const populated = await LeadActionRequest_1.LeadActionRequest.findById(doc._id)
            .populate("task", "title status")
            .populate("requestedBy", "name email");
        const leadName = req.user.name || "A lead";
        const reasonPreview = reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;
        await notifyAdminsLeadActionLine(`${leadName} requested ${type.replace(/_/g, " ")} for "${task.title}". Reason: ${reasonPreview}`);
        res.status(201).json(populated);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.get("/lead-action-requests", (0, auth_1.requireRole)("admin"), async (_req, res, next) => {
    try {
        const list = await LeadActionRequest_1.LeadActionRequest.find({ status: "pending" })
            .populate({
            path: "task",
            select: "title description status points deadline category contributionType priority assignedTo createdBy submission",
            populate: [
                { path: "assignedTo", select: "name email" },
                { path: "createdBy", select: "name email" },
            ],
        })
            .populate("requestedBy", "name email")
            .sort({ createdAt: -1 });
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.get("/lead-action-requests/mine", (0, auth_1.requireRole)("lead"), async (req, res, next) => {
    try {
        const list = await LeadActionRequest_1.LeadActionRequest.find({ requestedBy: req.user._id })
            .populate("task", "title status")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/lead-action-requests/:id/approve", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const noteRaw = String(req.body?.note ?? "").trim().slice(0, 1000);
        const resolutionNote = noteRaw || undefined;
        const doc = await LeadActionRequest_1.LeadActionRequest.findById(req.params.id);
        if (!doc || doc.status !== "pending") {
            return res.status(404).json({ message: "Request not found or already resolved" });
        }
        const task = await Task_1.Task.findById(doc.task);
        const taskTitle = task?.title ?? "task";
        const adminId = req.user._id;
        if (!task) {
            doc.status = "declined";
            doc.resolvedAt = new Date();
            doc.resolvedBy = adminId;
            doc.resolutionNote = resolutionNote;
            await doc.save();
            return res.status(400).json({ message: "Task no longer exists" });
        }
        switch (doc.type) {
            case "delete_task": {
                const assigneeId = task.assignedTo;
                const taskTitle = task.title;
                await Task_1.Task.findByIdAndDelete(task._id);
                if (assigneeId) {
                    await Notification_1.Notification.create({
                        user: assigneeId,
                        title: "Task removed",
                        message: `The task "${taskTitle}" has been removed.`,
                    });
                }
                break;
            }
            case "edit_task": {
                const payload = (doc.payload || {});
                const prevAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
                if (payload.assignedTo !== undefined) {
                    const nextAssignee = parseAssigneeIdFromBody(payload.assignedTo);
                    const assignErr = await assigneeValidationError(nextAssignee);
                    if (assignErr) {
                        return res.status(400).json({ message: assignErr });
                    }
                }
                applyCreatorPayloadToTask(task, payload);
                task.history.push({
                    actor: adminId,
                    action: "edited",
                    fromStatus: task.status,
                    toStatus: task.status,
                    createdAt: new Date(),
                    meta: { viaLeadApprovalRequest: true },
                });
                await task.save();
                const nextAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
                if (nextAssigneeId && nextAssigneeId !== prevAssigneeId) {
                    await (0, taskNotification_1.notifyUserAboutTask)(nextAssigneeId, task._id, "New Task Assigned", (0, taskNotification_1.buildAssignmentNotificationMessage)(task.title, task.assignmentNote));
                }
                break;
            }
            case "reject_submission": {
                if (task.status !== "submitted") {
                    return res.status(400).json({ message: "Task is no longer submitted" });
                }
                const fromStatus = task.status;
                task.status = "rejected";
                const rejectComment = typeof doc.payload?.rejectComment === "string"
                    ? String(doc.payload.rejectComment).trim().slice(0, 500)
                    : "";
                task.history.push({
                    actor: adminId,
                    action: "admin_update",
                    fromStatus,
                    toStatus: task.status,
                    createdAt: new Date(),
                    meta: rejectComment ? { rejectComment, viaLeadApprovalRequest: true } : { viaLeadApprovalRequest: true },
                });
                await task.save();
                if (task.assignedTo) {
                    const subMsg = rejectComment
                        ? `Your submission for "${task.title}" was not approved. Note from reviewer: "${rejectComment}". Please revise and resubmit when ready.`
                        : `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`;
                    await (0, taskNotification_1.notifyUserAboutTask)(task.assignedTo, task._id, "Submission needs revision", subMsg);
                }
                break;
            }
            case "approve_submission": {
                if (task.status !== "submitted") {
                    return res.status(400).json({ message: "Task is no longer submitted" });
                }
                const fromStatus = task.status;
                task.status = "completed";
                task.history.push({
                    actor: adminId,
                    action: "admin_update",
                    fromStatus,
                    toStatus: task.status,
                    createdAt: new Date(),
                });
                await task.save();
                if (task.assignedTo) {
                    const apprMsg = `Your submission for "${task.title}" has been approved!`;
                    await (0, taskNotification_1.notifyUserAboutTask)(task.assignedTo, task._id, "Task Approved", apprMsg);
                }
                break;
            }
            default:
                return res.status(400).json({ message: "Unknown request type" });
        }
        doc.status = "approved";
        doc.resolvedAt = new Date();
        doc.resolvedBy = adminId;
        doc.resolutionNote = resolutionNote;
        await doc.save();
        const noteSuffix = resolutionNote ? ` Note: ${resolutionNote}` : "";
        const approvedMsg = `Your request (${doc.type.replace(/_/g, " ")}) for "${taskTitle}" was approved by an admin.${noteSuffix}`;
        await Notification_1.Notification.create({
            user: doc.requestedBy,
            title: "Request approved",
            message: approvedMsg,
        });
        res.json({ success: true, type: doc.type });
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/lead-action-requests/:id/decline", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const noteRaw = String(req.body?.note ?? "").trim().slice(0, 1000);
        const resolutionNote = noteRaw || undefined;
        const doc = await LeadActionRequest_1.LeadActionRequest.findById(req.params.id).populate("task", "title");
        if (!doc || doc.status !== "pending") {
            return res.status(404).json({ message: "Request not found or already resolved" });
        }
        doc.status = "declined";
        doc.resolvedAt = new Date();
        doc.resolvedBy = req.user._id;
        doc.resolutionNote = resolutionNote;
        await doc.save();
        const t = doc.task;
        const noteSuffix = resolutionNote ? ` Note: ${resolutionNote}` : "";
        const declinedMsg = `Your request (${doc.type.replace(/_/g, " ")}) for "${t?.title ?? "a task"}" was declined by an admin.${noteSuffix}`;
        await Notification_1.Notification.create({
            user: doc.requestedBy,
            title: "Request declined",
            message: declinedMsg,
        });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// ----- Announcements (admin only) -----
exports.adminRouter.get("/announcements/recipient-count", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const allActive = String(req.query.allActive || "").toLowerCase() === "true";
        const excludeAdmins = String(req.query.excludeAdmins || "true").toLowerCase() !== "false";
        if (allActive) {
            const filter = allActiveRecipientFilter(excludeAdmins);
            const users = await User_1.User.find(filter).select("role").lean();
            const byRole = ANNOUNCEMENT_ROLES.map((role) => ({
                role,
                count: users.filter((u) => u.role === role).length,
            })).filter((r) => r.count > 0);
            return res.json({
                count: users.length,
                allActive: true,
                excludeAdmins,
                byRole,
            });
        }
        const rolesParam = String(req.query.roles ?? "");
        const rolesRaw = rolesParam ? rolesParam.split(",").map((r) => r.trim()) : [];
        const validRoles = parseAnnouncementTargetRoles(rolesRaw);
        if (validRoles.length === 0) {
            return res.status(400).json({ message: "Provide at least one valid role in ?roles=" });
        }
        const filter = announcementRecipientFilter(validRoles);
        const users = await User_1.User.find(filter).select("role").lean();
        const byRole = validRoles.map((role) => ({
            role,
            count: users.filter((u) => u.role === role).length,
        }));
        res.json({
            count: users.length,
            allActive: false,
            roles: validRoles,
            byRole,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.get("/announcements", (0, auth_1.requireRole)("admin"), async (_req, res, next) => {
    try {
        const list = await Announcement_1.Announcement.find()
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(list);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.post("/announcements", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const { title: titleRaw, message: messageRaw, targetRoles: rolesRaw, audience, excludeAdmins } = req.body;
        const title = String(titleRaw ?? "").trim();
        const message = String(messageRaw ?? "").trim();
        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }
        if (title.length > 120) {
            return res.status(400).json({ message: "Title must be at most 120 characters" });
        }
        if (!message) {
            return res.status(400).json({ message: "Message is required" });
        }
        if (message.length > 5000) {
            return res.status(400).json({ message: "Message must be at most 5000 characters" });
        }
        const sendToAllActive = audience !== "roles";
        const omitAdmins = excludeAdmins !== false;
        let validRoles = [];
        let recipients;
        if (sendToAllActive) {
            recipients = await User_1.User.find(allActiveRecipientFilter(omitAdmins)).select("_id email name role status");
            validRoles = [...new Set(recipients.map((u) => u.role))];
        }
        else {
            validRoles = parseAnnouncementTargetRoles(rolesRaw);
            if (validRoles.length === 0) {
                return res.status(400).json({ message: "Select at least one valid role" });
            }
            recipients = await User_1.User.find(announcementRecipientFilter(validRoles)).select("_id email name role status");
        }
        const notificationTitle = `Announcement: ${title}`;
        if (recipients.length > 0) {
            await Notification_1.Notification.insertMany(recipients.map((user) => ({
                user: user._id,
                title: notificationTitle,
                message,
                read: false,
            })));
        }
        let emailsSent = 0;
        let emailsFailed = 0;
        let emailsSkipped = 0;
        const emailErrors = [];
        for (const user of recipients) {
            const email = String(user.email || "").trim();
            if (!email) {
                emailsSkipped += 1;
                continue;
            }
            const result = await sendAnnouncementEmailWithRetry(email, notificationTitle, message);
            if (result.ok) {
                emailsSent += 1;
            }
            else if ("skipped" in result && result.skipped) {
                emailsSkipped += 1;
            }
            else {
                emailsFailed += 1;
                const errMsg = "error" in result ? result.error : "Unknown error";
                emailErrors.push(`${user.name || email}: ${errMsg}`);
                console.error("[announcements] email failed for", email, errMsg);
            }
        }
        const announcement = await Announcement_1.Announcement.create({
            title,
            message,
            targetRoles: validRoles,
            createdBy: req.user._id,
            recipientCount: recipients.length,
        });
        const populated = await Announcement_1.Announcement.findById(announcement._id).populate("createdBy", "name email");
        res.status(201).json({
            announcement: populated,
            recipientCount: recipients.length,
            notificationsCreated: recipients.length,
            emailsSent,
            emailsFailed,
            emailsSkipped,
            emailErrors: emailErrors.slice(0, 10),
            audience: sendToAllActive ? "all_active" : "roles",
        });
    }
    catch (err) {
        next(err);
    }
});
