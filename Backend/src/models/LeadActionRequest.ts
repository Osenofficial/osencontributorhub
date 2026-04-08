import mongoose, { Schema, Document, Types } from "mongoose";

export type LeadActionType = "edit_task" | "delete_task" | "reject_submission" | "approve_submission";

export interface ILeadActionRequest extends Document {
  type: LeadActionType;
  task: Types.ObjectId;
  requestedBy: Types.ObjectId;
  status: "pending" | "approved" | "declined";
  /** For edit_task: same shape as PATCH body (creator fields + optional status) */
  payload?: Record<string, unknown>;
  /** Why the lead is asking for this (visible to admins). */
  reason?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  /** Optional message from admin to the lead when resolving (approve or decline). */
  resolutionNote?: string;
}

const LeadActionRequestSchema = new Schema<ILeadActionRequest>(
  {
    type: {
      type: String,
      enum: ["edit_task", "delete_task", "reject_submission", "approve_submission"],
      required: true,
    },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "declined"],
      default: "pending",
      index: true,
    },
    payload: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true, maxlength: 2000 },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

LeadActionRequestSchema.index({ status: 1, createdAt: -1 });

export const LeadActionRequest =
  mongoose.models.LeadActionRequest ||
  mongoose.model<ILeadActionRequest>("LeadActionRequest", LeadActionRequestSchema);
