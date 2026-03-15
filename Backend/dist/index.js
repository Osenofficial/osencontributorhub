"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const db_1 = require("./lib/db");
const auth_1 = require("./routes/auth");
const dashboard_1 = require("./routes/dashboard");
const admin_1 = require("./routes/admin");
const public_1 = require("./routes/public");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
// Allow localhost and 127.0.0.1 on any port for local dev (avoids "Failed to fetch" from CORS)
const corsOrigin = process.env.NODE_ENV === "production"
    ? CLIENT_ORIGIN
    : (origin, cb) => {
        const allowed = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        cb(null, allowed ? origin ?? true : false);
    };
app.use((0, cors_1.default)({
    origin: corsOrigin,
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
});
app.use("/api/auth", auth_1.authRouter);
app.use("/api/dashboard", dashboard_1.dashboardRouter);
app.use("/api/admin", admin_1.adminRouter);
app.use("/api/public", public_1.publicRouter);
app.use(errorHandler_1.errorHandler);
async function start() {
    try {
        await (0, db_1.connectDB)();
        app.listen(PORT, () => {
            console.log(`Server listening on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}
void start();
