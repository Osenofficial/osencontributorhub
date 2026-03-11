import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { generateToken, requireAuth, AuthRequest } from "../middleware/auth";

export const authRouter = Router();

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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "intern",
      status: "pending",
      isActive: false,
    });

    res.status(201).json({
      message: "Signup successful. Your account is pending approval by an admin.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
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

    // Only enforce approval workflow for non-admins
    if (user.role !== "admin") {
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

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

