"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
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
// User list - admins only
exports.adminRouter.get("/users", (0, auth_1.requireRole)("admin"), async (_req, res, next) => {
    try {
        const users = await User_1.User.find().sort({ createdAt: -1 }).select("-passwordHash");
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
exports.adminRouter.patch("/users/:id/role", (0, auth_1.requireRole)("admin"), async (req, res, next) => {
    try {
        const { role } = req.body;
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
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
        const { title, description, points, assignedTo, deadline, category, contributionType, priority } = req.body;
        const assigneeId = assignedTo != null && String(assignedTo).trim() !== "" && assignedTo !== "__pool__"
            ? assignedTo
            : null;
        const task = await Task_1.Task.create({
            title,
            description,
            points: points ?? 0,
            category,
            contributionType,
            priority,
            assignedTo: assigneeId,
            createdBy: adminId,
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
            await Notification_1.Notification.create({
                user: assigneeId,
                title: "New Task Assigned",
                message: title,
            });
        }
        res.status(201).json(task);
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
];
exports.adminRouter.patch("/tasks/:id", (0, auth_1.requireRole)("admin", "lead"), async (req, res, next) => {
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        const hasCreatorUpdates = CREATOR_EDIT_FIELDS.some((k) => req.body[k] !== undefined);
        if (hasCreatorUpdates) {
            if (String(task.createdBy) !== String(req.user._id)) {
                return res.status(403).json({ message: "Only the task creator can edit task details" });
            }
            const { title, description, deadline, category, contributionType, priority, assignedTo, points } = req.body;
            if (title !== undefined)
                task.title = String(title).trim();
            if (description !== undefined)
                task.description = String(description ?? "");
            if (deadline !== undefined) {
                task.deadline = deadline ? new Date(deadline) : undefined;
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
            task.history.push({
                actor: req.user._id,
                action: "edited",
                fromStatus: task.status,
                toStatus: task.status,
                createdAt: new Date(),
                meta: { fields: CREATOR_EDIT_FIELDS.filter((k) => req.body[k] !== undefined) },
            });
        }
        const fromStatus = task.status;
        if (req.body.status !== undefined) {
            task.status = req.body.status;
        }
        const statusChanged = fromStatus !== task.status;
        if (statusChanged) {
            task.history.push({
                actor: req.user._id,
                action: "admin_update",
                fromStatus,
                toStatus: task.status,
                createdAt: new Date(),
                meta: req.body.points !== undefined && typeof req.body.points === "number"
                    ? { points: req.body.points }
                    : undefined,
            });
        }
        await task.save();
        if (fromStatus === "submitted" && task.status === "completed" && task.assignedTo) {
            await Notification_1.Notification.create({
                user: task.assignedTo,
                title: "Task Approved",
                message: `Your submission for "${task.title}" has been approved!`,
            });
        }
        if (fromStatus === "submitted" && task.status === "in_progress" && task.assignedTo) {
            await Notification_1.Notification.create({
                user: task.assignedTo,
                title: "Submission needs revision",
                message: `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`,
            });
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
exports.adminRouter.delete("/tasks/:id", (0, auth_1.requireRole)("admin", "lead"), async (_req, res, next) => {
    try {
        const task = await Task_1.Task.findByIdAndDelete(_req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
