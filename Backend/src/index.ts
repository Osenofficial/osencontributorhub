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

// CORS: allow frontend origin. In production, use CLIENT_ORIGIN env or allow known Vercel frontend.
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : process.env.NODE_ENV === "production"
    ? ["https://osencontributorhub-frontend.vercel.app"]
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
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

