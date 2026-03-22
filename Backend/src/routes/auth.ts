import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Task } from "../models/Task";
import { generateToken, requireAuth, AuthRequest } from "../middleware/auth";

export const authRouter = Router();

function getAvatarForUser(name: string, email: string): string {
  const seed = encodeURIComponent(email || name || "user");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=8b5cf6,6366f1,3b82f6`;
}

async function getUserWithPoints(userId: any) {
  const [user, completedTasks] = await Promise.all([
    User.findById(userId).select("-passwordHash"),
    Task.find({ assignedTo: userId, status: "completed" }),
  ]);
  if (!user) return null;
  const points = completedTasks.reduce((sum, t) => sum + (t.points || 0), 0);
  const tasksCompleted = completedTasks.length;
  const initials = user.name
    .trim()
    .split(/\s+/)
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: user.avatar || getAvatarForUser(user.name, user.email),
    initials: user.avatar?.length <= 3 ? user.avatar : initials,
    points,
    tasksCompleted,
    rank: 0,
    joinedAt: user.joinedAt,
    bio: user.bio || "",
    position: (user as any).position || "",
    interests: (user as any).interests || [],
    badges: user.badges || [],
    createdAt: user.createdAt,
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const avatar = getAvatarForUser(name, email);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "intern",
      status: "pending",
      isActive: false,
      avatar,
    });

    res.status(201).json({
      message: "Signup successful. Your account is pending approval by an admin.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Legacy DB: migrate removed "finance" role to accounts
    if ((user as { role: string }).role === "finance") {
      await User.collection.updateOne({ _id: user._id }, { $set: { role: "accounts" } });
      user.role = "accounts" as typeof user.role;
    }

    // Only enforce approval workflow for non-admins and non-internal invoice roles
    // (admin/accounts can log in to handle invoices)
    if (user.role !== "admin" && user.role !== "accounts") {
      if (user.status === "pending") {
        return res.status(403).json({ message: "Your account is pending approval by an admin." });
      }
      if (user.status === "rejected") {
        return res.status(403).json({ message: "Your signup request was rejected." });
      }
      if (user.status === "suspended" || !user.isActive) {
        return res.status(403).json({ message: "Your account is suspended." });
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    const fullUser = await getUserWithPoints(user._id);

    res.json({
      token,
      user: fullUser,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const fullUser = await getUserWithPoints(req.user!._id);
    if (!fullUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(fullUser);
  } catch (err) {
    next(err);
  }
});

// Update profile preferences (position + interests)
authRouter.patch("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!._id;
    const { position, interests } = req.body as {
      position?: unknown;
      interests?: unknown;
    };

    const cleanPosition =
      typeof position === "string" ? position.trim().slice(0, 80) : undefined;

    const cleanInterests =
      Array.isArray(interests) && interests.every((x) => typeof x === "string")
        ? Array.from(
            new Set(
              (interests as string[])
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 12),
            ),
          )
        : undefined;

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        ...(typeof cleanPosition === "string" ? { position: cleanPosition } : {}),
        ...(Array.isArray(cleanInterests) ? { interests: cleanInterests } : {}),
      },
      { new: true, runValidators: true },
    );

    const fullUser = await getUserWithPoints(updated!._id);
    res.json(fullUser);
  } catch (err) {
    next(err);
  }
});

