import mongoose, { Schema, Document, Types } from "mongoose";

export type TaskStatus = "todo" | "in_progress" | "submitted" | "completed";
export type TaskCategory = "content" | "development" | "design" | "community" | "research";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ITaskSubmission {
  githubLink?: string;
  googleDoc?: string;
  notionLink?: string;
  comments?: string;
  submittedAt?: Date;
}

export interface ITaskHistoryEntry {
  actor: Types.ObjectId;
  action: string;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  createdAt: Date;
  meta?: Record<string, unknown>;
}

export interface IPendingAssignmentRequest {
  user: Types.ObjectId;
  requestedAt: Date;
}

export interface ITask extends Document {
  title: string;
  description?: string;
  status: TaskStatus;
  category: TaskCategory;
  contributionType?: string;
  priority: TaskPriority;
  points: number;
  /** Set when someone is working on the task; null = open pool (anyone can claim). */
  assignedTo?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  deadline?: Date;
  submission?: ITaskSubmission;
  history: ITaskHistoryEntry[];
  /** Contributors request pool tasks here; admin/lead approves to assign. */
  pendingAssignmentRequests?: IPendingAssignmentRequest[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["todo", "in_progress", "submitted", "completed"],
      default: "todo",
      index: true,
    },
    category: {
      type: String,
      enum: ["content", "development", "design", "community", "research"],
      required: true,
    },
    contributionType: { type: String },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    points: { type: Number, default: 0, min: 0 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deadline: { type: Date },
    submission: {
      githubLink: String,
      googleDoc: String,
      notionLink: String,
      comments: String,
      submittedAt: Date,
    },
    history: [
      {
        actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
        action: { type: String, required: true },
        fromStatus: { type: String, enum: ["todo", "in_progress", "submitted", "completed"] },
        toStatus: { type: String, enum: ["todo", "in_progress", "submitted", "completed"] },
        createdAt: { type: Date, default: Date.now },
        meta: { type: Schema.Types.Mixed },
      },
    ],
    pendingAssignmentRequests: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          requestedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Task = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);

