import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Task } from "../models/Task";
import { Notification } from "../models/Notification";
import { User } from "../models/User";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/overview", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;

    const [totalTasks, completedTasks, notifications, recentTasks] = await Promise.all([
      Task.countDocuments({ assignedTo: userId }),
      Task.countDocuments({ assignedTo: userId, status: "completed" }),
      Notification.find({ user: userId, read: false }).sort({ createdAt: -1 }).limit(10),
      Task.find({ assignedTo: userId }).sort({ updatedAt: -1 }).limit(5),
    ]);

    res.json({
      totalTasks,
      completedTasks,
      completionRate: totalTasks ? completedTasks / totalTasks : 0,
      notifications,
      recentTasks,
    });
  } catch (err) {
    next(err);
  }
});

// Self-submit: user submits a completed contribution they did on their own (not assigned)
dashboardRouter.post("/contribute", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const { title, description, contributionType, category, points, githubLink, notionLink, googleDoc, comments } = req.body;

    if (!title || !contributionType) {
      return res.status(400).json({ message: "Title and contribution type are required" });
    }

    const pts = Math.min(100, Math.max(1, parseInt(String(points)) || 10));
    const task = await Task.create({
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

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/team", async (req: AuthRequest, res, next) => {
  try {
    const users = await User.find({
      role: { $ne: "admin" },
      status: { $in: ["active", "pending"] },
    })
      .sort({ name: 1 })
      .select("name email avatar");
    res.json(users);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/tasks", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const tasks = await Task.find({ assignedTo: userId })
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.patch("/tasks/:id", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const { status, submission, assignedTo: newAssigneeId } = req.body;

    const task = await Task.findOne({ _id: req.params.id, assignedTo: userId }).populate(
      "assignedTo",
      "name email"
    );
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (newAssigneeId && newAssigneeId !== task.assignedTo._id?.toString()) {
      task.assignedTo = newAssigneeId as any;
      task.history.push({
        actor: userId,
        action: "reassigned",
        fromStatus: task.status,
        toStatus: task.status,
        createdAt: new Date(),
        meta: { assignedTo: newAssigneeId },
      });
      await Notification.create({
        user: newAssigneeId,
        title: "Task Assigned to You",
        message: task.title,
      });
    }

    const fromStatus = task.status;
    if (status) {
      task.status = status;
    }
    if (submission) {
      task.submission = submission;
    }
    if (status) {
      task.history.push({
        actor: userId,
        action: "status_update",
        fromStatus,
        toStatus: status,
        createdAt: new Date(),
        meta: submission ? { hasSubmission: true } : undefined,
      });
    }

    await task.save();

    const updated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/notifications", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/notifications/read-all", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    await Notification.updateMany({ user: userId, read: false }, { read: true });
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/notifications/:id/read", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/leaderboard", async (_req: AuthRequest, res, next) => {
  try {
    const leaderboard = await Task.aggregate([
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

    const withAvatar = leaderboard.map((u: any, i: number) => {
      const initials =
        u.name
          ?.trim()
          .split(/\s+/)
          .map((s: string) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?";
      const avatarUrl =
        u.avatar?.startsWith?.("http")
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
  } catch (err) {
    next(err);
  }
});

// Contribution report for a user in a date range
dashboardRouter.get("/report", async (req: AuthRequest, res, next) => {
  try {
    const { q, from, to } = req.query as { q?: string; from?: string; to?: string };

    let targetUser = req.user!;

    if (q) {
      const query = q.trim();
      const user = await User.findOne({
        $or: [{ email: query.toLowerCase() }, { name: new RegExp(query, "i") }],
      });
      if (!user) {
        return res.status(404).json({ message: "User not found for given query" });
      }
      targetUser = user;
    }

    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) {
        (dateFilter.createdAt as any).$gte = new Date(from);
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (dateFilter.createdAt as any).$lte = end;
      }
    }

    const match: any = {
      assignedTo: targetUser._id,
      ...(Object.keys(dateFilter).length ? dateFilter : {}),
    };

    const tasks = await Task.find(match).sort({ createdAt: -1 });

    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
    const byStatus = tasks.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

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
  } catch (err) {
    next(err);
  }
});

