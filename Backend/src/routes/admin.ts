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
    const { title, description, points, assignedTo, deadline, category, priority } = req.body;
    const task = await Task.create({
      title,
      description,
      points: points ?? 0,
      category,
      priority,
      assignedTo,
      createdBy: adminId,
      deadline,
    });

    await Notification.create({
      user: assignedTo,
      title: "New Task Assigned",
      message: title,
    });

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
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/tasks/:id", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const { status, points } = req.body;
    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (typeof points === "number") update.points = points;

    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
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

