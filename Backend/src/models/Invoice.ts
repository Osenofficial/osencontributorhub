import mongoose, { Schema, Document, Types } from "mongoose";

export type InvoiceStatus = "pending" | "approved" | "rejected";
export type OSENRoleOption =
  | "community_manager"
  | "design_team"
  | "video_editor"
  | "evangelist"
  | "ambassador_lead";
export type PaymentMethodOption = "upi" | "bank_transfer";

export interface IInvoice extends Document {
  submittedBy: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  osenRole: OSENRoleOption;
  eventName: string;
  eventDate: Date;
  eventPreApproved: boolean;
  roleAtEvent: string;
  totalAmountClaimed: number;
  budgetBreakdown: string;
  billsDriveLink: string;
  paymentMethod: PaymentMethodOption;
  upiId?: string;
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  notes?: string;
  confirmationChecked: boolean;
  status: InvoiceStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    osenRole: {
      type: String,
      enum: ["community_manager", "design_team", "video_editor", "evangelist", "ambassador_lead"],
      required: true,
    },
    eventName: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    eventPreApproved: { type: Boolean, required: true },
    roleAtEvent: { type: String, required: true, trim: true },
    totalAmountClaimed: { type: Number, required: true, min: 0, max: 1000 },
    budgetBreakdown: { type: String, required: true, trim: true },
    billsDriveLink: { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: ["upi", "bank_transfer"], required: true },
    upiId: { type: String, trim: true },
    bankAccountHolderName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankIfscCode: { type: String, trim: true },
    notes: { type: String, trim: true },
    confirmationChecked: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ status: 1, createdAt: -1 });

export const Invoice =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);
