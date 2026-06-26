"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const User_1 = require("../models/User");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const auth_1 = require("../middleware/auth");
const mail_1 = require("../lib/mail");
const emailTemplate_1 = require("../lib/emailTemplate");
const userAvatar_1 = require("../lib/userAvatar");
exports.authRouter = (0, express_1.Router)();
async function getUserWithPoints(userId) {
    const [user, completedTasks] = await Promise.all([
        User_1.User.findById(userId).select("-passwordHash"),
        Task_1.Task.find({ assignedTo: userId, status: "completed" }),
    ]);
    if (!user)
        return null;
    const points = completedTasks.reduce((sum, t) => sum + (t.points || 0), 0);
    const tasksCompleted = completedTasks.length;
    const initials = (0, userAvatar_1.normalizeAvatarField)(user.name, user.avatar);
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
        position: user.position || "",
        interests: user.interests || [],
        badges: user.badges || [],
        createdAt: user.createdAt,
    };
}
function hashResetToken(token) {
    return node_crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function getFrontendBaseUrl() {
    return (process.env.FRONTEND_URL?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        "http://localhost:3000").replace(/\/$/, "");
}
exports.authRouter.post("/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }
        const existing = await User_1.User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Email already in use" });
        }
        const avatar = (0, userAvatar_1.initialsFromName)(name);
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
        await Notification_1.Notification.create({
            user: user._id,
            title: "Signup received",
            message: `Thanks for signing up, ${name}! Your account is pending approval by an admin. We'll notify you when you can log in.`,
        });
        const admins = await User_1.User.find({ role: "admin" }).select("_id");
        const signupMsg = `${name} (${email}) signed up and is waiting for approval.`;
        for (const a of admins) {
            await Notification_1.Notification.create({
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
        // Legacy DB: migrate removed "finance" role to accounts
        if (user.role === "finance") {
            await User_1.User.collection.updateOne({ _id: user._id }, { $set: { role: "accounts" } });
            user.role = "accounts";
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
exports.authRouter.post("/forgot-password", async (req, res, next) => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const user = await User_1.User.findOne({ email }).select("+passwordResetTokenHash +passwordResetExpires");
        const genericMessage = "If an account exists for that email, we sent a reset link. Check your inbox (and spam).";
        if (!user || user.status === "rejected") {
            return res.json({ message: genericMessage });
        }
        const token = node_crypto_1.default.randomBytes(32).toString("hex");
        user.passwordResetTokenHash = hashResetToken(token);
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        const appName = (0, emailTemplate_1.getEmailAppName)();
        await (0, mail_1.sendMail)({
            to: user.email,
            subject: `[${appName}] Reset your password`,
            text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
            html: `<p>Hi ${user.name},</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
        });
        res.json({ message: genericMessage });
    }
    catch (err) {
        next(err);
    }
});
exports.authRouter.post("/reset-password", async (req, res, next) => {
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
        const user = await User_1.User.findOne({
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: { $gt: new Date() },
        }).select("+passwordResetTokenHash +passwordResetExpires");
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset link. Request a new one." });
        }
        user.passwordHash = await bcryptjs_1.default.hash(password, 10);
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.json({ message: "Password updated. You can sign in with your new password." });
    }
    catch (err) {
        next(err);
    }
});
