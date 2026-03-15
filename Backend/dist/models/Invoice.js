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
exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceSchema = new mongoose_1.Schema({
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },
}, { timestamps: true });
InvoiceSchema.index({ status: 1, createdAt: -1 });
exports.Invoice = mongoose_1.default.models.Invoice || mongoose_1.default.model("Invoice", InvoiceSchema);
