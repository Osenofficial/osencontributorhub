import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "admin" | "lead" | "associate" | "intern" | "finance";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar: string;
  points: number;
  tasksCompleted: number;
  rank: number;
  joinedAt: Date;
  bio: string;
  badges: string[];
  isActive: boolean;
  status: "pending" | "active" | "rejected" | "suspended";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "lead", "associate", "intern", "finance"], default: "intern", index: true },
    avatar: { type: String, default: "" },
    points: { type: Number, default: 0, min: 0 },
    tasksCompleted: { type: Number, default: 0, min: 0 },
    rank: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    bio: { type: String, default: "" },
    badges: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    status: { type: String, enum: ["pending", "active", "rejected", "suspended"], default: "pending", index: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

