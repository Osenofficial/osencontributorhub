import mongoose, { Schema, Document, Types } from "mongoose";

export type PayoutRequestStatus = "pending_admin" | "pending_accounts" | "paid" | "rejected";
export type PayoutPaymentMethod = "upi" | "bank_transfer";

export interface IPayoutRequest extends Document {
  submittedBy: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  /** Completed-task points for the selected contributor cycle at submission (server-verified). */
  pointsAtSubmit: number;
  contributorPeriod: Types.ObjectId;
  cycleLabel: string;
  cycleSequence: number;
  /** Tier table amount (INR). */
  requestedPayoutINR: number;
  tierLabel: string;
  paymentMethod: PayoutPaymentMethod;
  upiId?: string;
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  notes?: string;
  confirmationChecked: boolean;
  status: PayoutRequestStatus;
  adminReviewedBy?: Types.ObjectId;
  adminReviewedAt?: Date;
  adminReviewNotes?: string;
  accountsReviewedBy?: Types.ObjectId;
  accountsReviewedAt?: Date;
  accountsReviewNotes?: string;
  paidAt?: Date;
  comments?: Array<{
    author: Types.ObjectId;
    role: string;
    body: string;
    createdAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutRequestSchema = new Schema<IPayoutRequest>(
  {
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    pointsAtSubmit: { type: Number, required: true, min: 0 },
    contributorPeriod: { type: Schema.Types.ObjectId, ref: "ContributorPeriod", required: true, index: true },
    cycleLabel: { type: String, required: true, trim: true },
    cycleSequence: { type: Number, required: true },
    requestedPayoutINR: { type: Number, required: true, min: 0, max: 5000 },
    tierLabel: { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: ["upi", "bank_transfer"], required: true },
    upiId: { type: String, trim: true },
    bankAccountHolderName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankIfscCode: { type: String, trim: true },
    notes: { type: String, trim: true },
    confirmationChecked: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["pending_admin", "pending_accounts", "paid", "rejected"],
      default: "pending_admin",
      index: true,
    },
    adminReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    adminReviewedAt: { type: Date },
    adminReviewNotes: { type: String, trim: true },
    accountsReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    accountsReviewedAt: { type: Date },
    accountsReviewNotes: { type: String, trim: true },
    paidAt: { type: Date },
    comments: [
      {
        author: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, required: true, trim: true },
        body: { type: String, required: true, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

PayoutRequestSchema.index({ status: 1, createdAt: -1 });

export const PayoutRequest =
  mongoose.models.PayoutRequest || mongoose.model<IPayoutRequest>("PayoutRequest", PayoutRequestSchema);
