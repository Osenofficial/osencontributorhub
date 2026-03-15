"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
function generateToken(user) {
    return jsonwebtoken_1.default.sign({ sub: user._id.toString(), role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }
    const token = authHeader.slice("Bearer ".length);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await User_1.User.findById(payload.sub);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        req.user = user;
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
}
