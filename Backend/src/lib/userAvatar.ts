/** Initials-only avatars — no external image URLs (dicebear / v0). */
export function initialsFromName(name: string, fallback = "?"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return parts
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function normalizeAvatarField(name: string, avatar?: string | null): string {
  const initials = initialsFromName(name)
  if (!avatar || typeof avatar !== "string") return initials
  const trimmed = avatar.trim()
  if (!trimmed) return initials
  if (trimmed.includes("dicebear.com") || trimmed.startsWith("http")) return initials
  if (trimmed.length <= 3) return trimmed.toUpperCase()
  return initials
}
