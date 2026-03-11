import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Task } from "../models/Task";
import { Notification } from "../models/Notification";

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
    const { status } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignedTo: userId },
      { status },
      { new: true }
    );
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/notifications", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20);
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

