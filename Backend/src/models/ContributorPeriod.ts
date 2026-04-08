import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContributorPeriod extends Document {
  sequence: number;
  label: string;
  startedAt: Date;
  /** When the next cycle was started; null means this is the open (current) cycle. */
  endedAt: Date | null;
  startedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContributorPeriodSchema = new Schema<IContributorPeriod>(
  {
    sequence: { type: Number, required: true, unique: true },
    label: { type: String, required: true, trim: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
  },
  { timestamps: true }
);

ContributorPeriodSchema.index({ endedAt: 1 });

export const ContributorPeriod =
  mongoose.models.ContributorPeriod ||
  mongoose.model<IContributorPeriod>("ContributorPeriod", ContributorPeriodSchema);
