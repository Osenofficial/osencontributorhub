import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  task: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CommentSchema.index({ task: 1, createdAt: 1 });

export const Comment =
  mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);
