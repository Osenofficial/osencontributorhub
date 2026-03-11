import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
}

