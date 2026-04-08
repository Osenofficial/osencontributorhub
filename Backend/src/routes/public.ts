import { Router } from "express";
import { User } from "../models/User";
import { Task } from "../models/Task";

export const publicRouter = Router();

/** Aligned with Frontend tier table: top payout at 181+ pts. */
const MONTHLY_POINT_CAP = 181;
const MAX_MONTHLY_PAYOUT_INR = 5000;
const POINT_VALUE_INR = 50;

publicRouter.get("/stats", async (_req, res, next) => {
  try {
    const [totalUsers, completedTasks] = await Promise.all([
      User.countDocuments({ status: "active", role: { $ne: "admin" } }),
      Task.countDocuments({ status: "completed" }),
    ]);
    res.json({
      totalUsers,
      completedTasks,
      monthlyCapValue: MAX_MONTHLY_PAYOUT_INR,
      pointValue: POINT_VALUE_INR,
      monthlyCap: MONTHLY_POINT_CAP,
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/leaderboard", async (_req, res, next) => {
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
      { $limit: 10 },
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
          totalPoints: 1,
          completedTasks: 1,
        },
      },
    ]);

    const withAvatar = leaderboard.map((u, i) => {
      const initials =
        u.name
          ?.trim()
          .split(/\s+/)
          .map((s: string) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?";
      const avatar =
        u.avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.email || u.name || "u")}&backgroundColor=8b5cf6,6366f1,3b82f6`;
      return {
        ...u,
        avatar: avatar.startsWith("http") ? avatar : initials,
        initials,
        rank: i + 1,
      };
    });

    res.json(withAvatar);
  } catch (err) {
    next(err);
  }
});
