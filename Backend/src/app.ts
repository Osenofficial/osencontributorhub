import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// CORS: CLIENT_ORIGIN env (comma-separated) + hardcoded fallbacks so it works on Vercel even if env is missing
const fromEnv = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

  
// const allowedOrigins = [
//   ...fromEnv,
//   "https://osencontributorhub-frontend.vercel.app",
//   "https://osenhub.vercel.app",
//   ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
// ];

// function isOriginAllowed(origin: string | undefined): boolean {
//   if (!origin) return true;
//   if (allowedOrigins.includes(origin)) return true;
//   if (allowedOrigins.some((o) => o.toLowerCase() === origin.toLowerCase())) return true;
//   if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
//     return true;
//   return false;
// }

// Handle CORS and preflight first so headers are always set (critical for Vercel serverless)

// app.use((req, res, next) => {
//   const origin = (req.headers.origin || "").trim();
//   const allowOrigin = origin && isOriginAllowed(origin) ? origin : allowedOrigins[0];
//   if (allowOrigin) {
//     res.setHeader("Access-Control-Allow-Origin", allowOrigin);
//   }
//   res.setHeader("Access-Control-Allow-Credentials", "true");
//   res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   if (req.method === "OPTIONS") {
//     return res.status(204).end();
//   }
//   next();
// });

app.use(cors(
));
app.use(express.json());
app.use(morgan("dev"));

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

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);

app.use(errorHandler);

export { app };
