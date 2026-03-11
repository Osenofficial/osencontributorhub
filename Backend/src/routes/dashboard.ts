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

dashboardRouter.get("/tasks", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const tasks = await Task.find({ assignedTo: userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.patch("/tasks/:id", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const { status, submission } = req.body;

    const task = await Task.findOne({ _id: req.params.id, assignedTo: userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const fromStatus = task.status;
    task.status = status;
    if (submission) {
      task.submission = submission;
    }
    task.history.push({
      actor: userId,
      action: "status_update",
      fromStatus,
      toStatus: status,
      createdAt: new Date(),
      meta: submission ? { hasSubmission: true } : undefined,
    });

    await task.save();

    res.json(task);
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
          totalPoints: 1,
          completedTasks: 1,
        },
      },
    ]);

    res.json(leaderboard);
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

