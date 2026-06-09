import mongoose, { Schema, Document, Types } from "mongoose";
import type { UserRole } from "./User";

export interface IAnnouncement extends Document {
  title: string;
  message: string;
  targetRoles: UserRole[];
  createdBy: Types.ObjectId;
  recipientCount: number;
  createdAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    targetRoles: {
      type: [{ type: String, enum: ["admin", "lead", "associate", "intern", "accounts", "evangelist"] }],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "At least one target role is required",
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientCount: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Announcement =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
