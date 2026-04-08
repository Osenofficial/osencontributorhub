import mongoose, { Schema, Document, Types } from "mongoose";

export type TaskCommentAudience = "task" | "staff";

export interface IComment extends Document {
  task: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  /** task = visible to assignee/creator like today; staff = lead & admin only */
  audience: TaskCommentAudience;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    audience: {
      type: String,
      enum: ["task", "staff"],
      default: "task",
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CommentSchema.index({ task: 1, createdAt: 1 });

export const Comment =
  mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);
