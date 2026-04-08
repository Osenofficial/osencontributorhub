"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PayoutRequestSchema = new mongoose_1.Schema({
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    pointsAtSubmit: { type: Number, required: true, min: 0 },
    contributorPeriod: { type: mongoose_1.Schema.Types.ObjectId, ref: "ContributorPeriod", required: true, index: true },
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
    adminReviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    adminReviewedAt: { type: Date },
    adminReviewNotes: { type: String, trim: true },
    accountsReviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    accountsReviewedAt: { type: Date },
    accountsReviewNotes: { type: String, trim: true },
    paidAt: { type: Date },
    comments: [
        {
            author: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
            role: { type: String, required: true, trim: true },
            body: { type: String, required: true, trim: true, maxlength: 2000 },
            createdAt: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });
PayoutRequestSchema.index({ status: 1, createdAt: -1 });
exports.PayoutRequest = mongoose_1.default.models.PayoutRequest || mongoose_1.default.model("PayoutRequest", PayoutRequestSchema);
