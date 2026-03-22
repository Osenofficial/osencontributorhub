import { Router } from "express";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Task } from "../models/Task";
import { Notification } from "../models/Notification";

export const adminRouter = Router();

adminRouter.use(requireAuth);

// Stats - admins and leads
adminRouter.get("/stats", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const [totalUsers, totalTasks, completedTasks] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments(),
      Task.countDocuments({ status: "completed" }),
    ]);

    res.json({
      totalUsers,
      totalTasks,
      completedTasks,
      completionRate: totalTasks ? completedTasks / totalTasks : 0,
    });
  } catch (err) {
    next(err);
  }
});

// User list - admins only
adminRouter.get("/users", requireRole("admin"), async (_req: AuthRequest, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-passwordHash");
    res.json(users);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:id/role", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select(
      "-passwordHash"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// User approval / suspension - admins only
adminRouter.post("/users/:id/approve", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", isActive: true },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/reject", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", isActive: false },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/suspend", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "suspended", isActive: false },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/activate", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", isActive: true },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Tasks - admins and leads can manage
adminRouter.post("/tasks", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const adminId = req.user!._id;
    const { title, description, points, assignedTo, deadline, category, contributionType, priority } = req.body;
    const assigneeId =
      assignedTo != null && String(assignedTo).trim() !== "" && assignedTo !== "__pool__"
        ? assignedTo
        : null;

    const task = await Task.create({
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
      await Notification.create({
        user: assigneeId,
        title: "New Task Assigned",
        message: title,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tasks", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
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
] as const;

adminRouter.patch("/tasks/:id", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasCreatorUpdates = CREATOR_EDIT_FIELDS.some((k) => req.body[k] !== undefined);

    if (hasCreatorUpdates) {
      if (String(task.createdBy) !== String(req.user!._id)) {
        return res.status(403).json({ message: "Only the task creator can edit task details" });
      }
      const { title, description, deadline, category, contributionType, priority, assignedTo, points } = req.body;
      if (title !== undefined) task.title = String(title).trim();
      if (description !== undefined) task.description = String(description ?? "");
      if (deadline !== undefined) {
        task.deadline = deadline ? new Date(deadline) : undefined;
      }
      if (category !== undefined) task.category = category;
      if (contributionType !== undefined) task.contributionType = contributionType;
      if (priority !== undefined) task.priority = priority;
      if (assignedTo !== undefined) {
        const assigneeId =
          assignedTo != null &&
          String(assignedTo).trim() !== "" &&
          assignedTo !== "__pool__"
            ? assignedTo
            : null;
        task.assignedTo = assigneeId as any;
      }
      if (points !== undefined) {
        const p = Math.min(100, Math.max(1, parseInt(String(points), 10) || 10));
        task.points = p;
      }
      task.history.push({
        actor: req.user!._id,
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
        actor: req.user!._id,
        action: "admin_update",
        fromStatus,
        toStatus: task.status,
        createdAt: new Date(),
        meta:
          req.body.points !== undefined && typeof req.body.points === "number"
            ? { points: req.body.points }
            : undefined,
      });
    }

    await task.save();

    if (fromStatus === "submitted" && task.status === "completed" && task.assignedTo) {
      await Notification.create({
        user: task.assignedTo,
        title: "Task Approved",
        message: `Your submission for "${task.title}" has been approved!`,
      });
    }

    if (fromStatus === "submitted" && task.status === "in_progress" && task.assignedTo) {
      await Notification.create({
        user: task.assignedTo,
        title: "Submission needs revision",
        message: `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/tasks/:id", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(_req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** Tasks with at least one pending assignment request (pool tasks contributors asked for). */
adminRouter.get("/pending-assignment-requests", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const tasks = await Task.find({ "pendingAssignmentRequests.0": { $exists: true } })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email")
      .sort({ updatedAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

/** Approve one contributor — assign task to them and clear pending requests. */
adminRouter.post("/tasks/:id/approve-assignment", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId || String(userId).trim() === "") {
      return res.status(400).json({ message: "userId is required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.assignedTo != null) {
      return res.status(400).json({ message: "Task is already assigned" });
    }
    const pending = (task.pendingAssignmentRequests || []).some(
      (p: { user: { toString: () => string } }) => p.user.toString() === String(userId)
    );
    if (!pending) {
      return res.status(400).json({ message: "No pending request from this user for this task" });
    }

    task.assignedTo = userId as any;
    task.pendingAssignmentRequests = [];
    task.history.push({
      actor: req.user!._id,
      action: "assignment_approved",
      fromStatus: task.status,
      toStatus: task.status,
      createdAt: new Date(),
      meta: { assignedTo: userId },
    });
    await task.save();

    await Notification.create({
      user: userId,
      title: "Task assigned to you",
      message: `You've been assigned: "${task.title}"`,
    });

    const updated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** Remove one user's request without assigning (decline). */
adminRouter.post("/tasks/:id/reject-assignment", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    const before = (task.pendingAssignmentRequests || []).length;
    task.pendingAssignmentRequests = (task.pendingAssignmentRequests || []).filter(
      (p: { user: { toString: () => string } }) => p.user.toString() !== String(userId)
    );
    if (task.pendingAssignmentRequests.length === before) {
      return res.status(400).json({ message: "No pending request from this user" });
    }
    await task.save();

    await Notification.create({
      user: userId,
      title: "Assignment request",
      message: `Your request to work on "${task.title}" was declined.`,
    });

    const updated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

