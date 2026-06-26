import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User } from "../models/User";
import { Task } from "../models/Task";
import { Notification } from "../models/Notification";
import { generateToken, requireAuth, AuthRequest } from "../middleware/auth";
import { sendMail } from "../lib/mail";
import { getEmailAppName } from "../lib/emailTemplate";
import { initialsFromName, normalizeAvatarField } from "../lib/userAvatar";

export const authRouter = Router();

async function getUserWithPoints(userId: any) {
  const [user, completedTasks] = await Promise.all([
    User.findById(userId).select("-passwordHash"),
    Task.find({ assignedTo: userId, status: "completed" }),
  ]);
  if (!user) return null;
  const points = completedTasks.reduce((sum, t) => sum + (t.points || 0), 0);
  const tasksCompleted = completedTasks.length;
  const initials = normalizeAvatarField(user.name, user.avatar);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: initials,
    initials,
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

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getFrontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const avatar = initialsFromName(name);
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

    await Notification.create({
      user: user._id,
      title: "Signup received",
      message: `Thanks for signing up, ${name}! Your account is pending approval by an admin. We'll notify you when you can log in.`,
    });

    const admins = await User.find({ role: "admin" }).select("_id");
    const signupMsg = `${name} (${email}) signed up and is waiting for approval.`;
    for (const a of admins) {
      await Notification.create({
        user: a._id,
        title: "New signup pending approval",
        message: signupMsg,
      });
    }

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

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("+passwordResetTokenHash +passwordResetExpires");
    const genericMessage =
      "If an account exists for that email, we sent a reset link. Check your inbox (and spam).";

    if (!user || user.status === "rejected") {
      return res.json({ message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const appName = getEmailAppName();
    await sendMail({
      to: user.email,
      subject: `[${appName}] Reset your password`,
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
      html: `<p>Hi ${user.name},</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
    });

    res.json({ message: genericMessage });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link. Request a new one." });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password updated. You can sign in with your new password." });
  } catch (err) {
    next(err);
  }
});
