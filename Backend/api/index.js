// Vercel serverless entry: route all requests to Express app so CORS and routes work
const path = require("path");
const { app } = require(path.join(__dirname, "..", "dist", "app"));
const { connectDB } = require(path.join(__dirname, "..", "dist", "lib", "db"));

let dbConnected = false;

module.exports = async (req, res) => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch (err) {
      console.error("DB connect failed", err);
      res.status(500).json({ message: "Database connection failed" });
      return;
    }
  }
  app(req, res);
};
