"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = require("./routes/auth");
const dashboard_1 = require("./routes/dashboard");
const admin_1 = require("./routes/admin");
const public_1 = require("./routes/public");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
exports.app = app;
// CORS: allow frontend origin. In production, use CLIENT_ORIGIN env or allow known Vercel frontend.
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
    : process.env.NODE_ENV === "production"
        ? ["https://osencontributorhub-frontend.vercel.app"]
        : ["http://localhost:3000", "http://127.0.0.1:3000"];
function isOriginAllowed(origin) {
    if (!origin)
        return true;
    if (allowedOrigins.includes(origin))
        return true;
    if (allowedOrigins.some((o) => o.toLowerCase() === origin.toLowerCase()))
        return true;
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
        return true;
    return false;
}
// Handle CORS and preflight first so headers are always set (critical for Vercel serverless)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin || allowedOrigins[0] || "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    next();
});
app.use((0, cors_1.default)({
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
// Root and /api
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "OSEN Contributor Hub API", docs: "/api/health" });
});
app.get("/api", (_req, res) => {
    res.json({ status: "ok", message: "OSEN Contributor Hub API", health: "/api/health" });
});
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
});
app.use("/api/auth", auth_1.authRouter);
app.use("/api/dashboard", dashboard_1.dashboardRouter);
app.use("/api/admin", admin_1.adminRouter);
app.use("/api/public", public_1.publicRouter);
app.use(errorHandler_1.errorHandler);
