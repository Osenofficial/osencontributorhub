"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const Task_1 = require("../models/Task");
const auth_1 = require("../middleware/auth");
exports.authRouter = (0, express_1.Router)();
function getAvatarForUser(name, email) {
    const seed = encodeURIComponent(email || name || "user");
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=8b5cf6,6366f1,3b82f6`;
}
async function getUserWithPoints(userId) {
    const [user, completedTasks] = await Promise.all([
        User_1.User.findById(userId).select("-passwordHash"),
        Task_1.Task.find({ assignedTo: userId, status: "completed" }),
    ]);
    if (!user)
        return null;
    const points = completedTasks.reduce((sum, t) => sum + (t.points || 0), 0);
    const tasksCompleted = completedTasks.length;
    const initials = user.name
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
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
        position: user.position || "",
        interests: user.interests || [],
        badges: user.badges || [],
        createdAt: user.createdAt,
    };
}
exports.authRouter.post("/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        const existing = await User_1.User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Email already in use" });
        }
        const avatar = getAvatarForUser(name, email);
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.User.create({
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
    }
    catch (err) {
        next(err);
    }
});
exports.authRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const user = await User_1.User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // Only enforce approval workflow for non-admins and non-internal invoice roles
        // (admin/accounts can log in to handle invoices)
        if (user.role !== "admin" && user.role !== "finance" && user.role !== "accounts") {
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
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        user.lastLoginAt = new Date();
        await user.save();
        const token = (0, auth_1.generateToken)(user);
        const fullUser = await getUserWithPoints(user._id);
        res.json({
            token,
            user: fullUser,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const fullUser = await getUserWithPoints(req.user._id);
        if (!fullUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(fullUser);
    }
    catch (err) {
        next(err);
    }
});
// Update profile preferences (position + interests)
exports.authRouter.patch("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { position, interests } = req.body;
        const cleanPosition = typeof position === "string" ? position.trim().slice(0, 80) : undefined;
        const cleanInterests = Array.isArray(interests) && interests.every((x) => typeof x === "string")
            ? Array.from(new Set(interests
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 12)))
            : undefined;
        const updated = await User_1.User.findByIdAndUpdate(userId, {
            ...(typeof cleanPosition === "string" ? { position: cleanPosition } : {}),
            ...(Array.isArray(cleanInterests) ? { interests: cleanInterests } : {}),
        }, { new: true, runValidators: true });
        const fullUser = await getUserWithPoints(updated._id);
        res.json(fullUser);
    }
    catch (err) {
        next(err);
    }
});
