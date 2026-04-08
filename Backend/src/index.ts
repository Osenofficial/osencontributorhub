import "dotenv/config";
import dns from "node:dns";
import { connectDB } from "./lib/db";
import { logMailStartupStatus } from "./lib/mail";
import { app } from "./app";

// Gmail and others expose IPv6 (AAAA). Many hosts (e.g. Render) have no IPv6 egress → ENETUNREACH on :587.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    logMailStartupStatus();
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

void start();
