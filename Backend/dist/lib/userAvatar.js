"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialsFromName = initialsFromName;
exports.normalizeAvatarField = normalizeAvatarField;
/** Initials-only avatars — no external image URLs (dicebear / v0). */
function initialsFromName(name, fallback = "?") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return fallback;
    return parts
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}
function normalizeAvatarField(name, avatar) {
    const initials = initialsFromName(name);
    if (!avatar || typeof avatar !== "string")
        return initials;
    const trimmed = avatar.trim();
    if (!trimmed)
        return initials;
    if (trimmed.includes("dicebear.com") || trimmed.startsWith("http"))
        return initials;
    if (trimmed.length <= 3)
        return trimmed.toUpperCase();
    return initials;
}
