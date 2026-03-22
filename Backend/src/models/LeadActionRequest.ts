import mongoose, { Schema, Document, Types } from "mongoose";

export type LeadActionType = "edit_task" | "delete_task" | "reject_submission" | "approve_submission";

export interface ILeadActionRequest extends Document {
  type: LeadActionType;
  task: Types.ObjectId;
  requestedBy: Types.ObjectId;
  status: "pending" | "approved" | "declined";
  /** For edit_task: same shape as PATCH body (creator fields + optional status) */
  payload?: Record<string, unknown>;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
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
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

LeadActionRequestSchema.index({ status: 1, createdAt: -1 });

export const LeadActionRequest =
  mongoose.models.LeadActionRequest ||
  mongoose.model<ILeadActionRequest>("LeadActionRequest", LeadActionRequestSchema);
