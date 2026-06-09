import mongoose, { Schema, Document, Types } from "mongoose";
import { queueNotifyUserByEmail } from "../lib/notifyEmail";

export interface INotification extends Document {
  user: Types.ObjectId;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Keep email delivery aligned with in-app notifications across the app.
NotificationSchema.post("save", function (doc: INotification) {
  queueNotifyUserByEmail(doc.user, doc.title, doc.message);
});

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

