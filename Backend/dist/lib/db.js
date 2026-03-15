"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = process.env.MONGODB_URI || "";
async function connectDB() {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not set");
    }
    if (mongoose_1.default.connection.readyState === 1)
        return;
    await mongoose_1.default.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
}
