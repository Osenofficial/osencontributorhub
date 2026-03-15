import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./lib/db";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// Allow localhost and 127.0.0.1 on any port for local dev (avoids "Failed to fetch" from CORS)
const corsOrigin = process.env.NODE_ENV === "production"
  ? CLIENT_ORIGIN
  : (origin: string | undefined, cb: (err: Error | null, allow?: boolean | string) => void) => {
      const allowed = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, allowed ? origin ?? true : false);
    };

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Root and /api - so "Cannot GET /" doesn't show on Vercel or direct visits
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "OSEN Contributor Hub API", docs: "/api/health" });
});
app.get("/api", (_req, res) => {
  res.json({ status: "ok", message: "OSEN Contributor Hub API", health: "/api/health" });
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);

app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

void start();

