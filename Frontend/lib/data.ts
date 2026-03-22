// Types and constants for OSEN Contributor Hub
// All dynamic data comes from the API

export type Role =
  | 'admin'
  | 'lead'
  | 'associate'
  | 'intern'
  | 'accounts'
  | 'evangelist'
export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'completed'
export type TaskCategory = 'content' | 'development' | 'design' | 'community' | 'research'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar: string
  avatarSrc?: string
  points: number
  tasksCompleted: number
  rank: number
  joinedAt: string
  badges: Badge[]
  bio: string
  position: string
  interests: string[]
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

export interface Task {
  id: string
  title: string
  description: string
  category: TaskCategory
  points: number
  deadline: string
  assignedTo: string
  createdBy: string
  status: TaskStatus
  priority: Priority
  submission?: Submission
  createdAt: string
}

export interface Submission {
  githubLink?: string
  googleDoc?: string
  notionLink?: string
  comments?: string
  submittedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: 'task_assigned' | 'task_approved' | 'points_awarded' | 'admin_comment'
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface Activity {
  id: string
  userId: string
  action: string
  detail: string
  points?: number
  createdAt: string
}

export const BADGES: Badge[] = [
  { id: 'top_contributor', name: 'Top Contributor', description: 'Ranked #1 in monthly leaderboard', icon: 'Trophy', color: 'text-yellow-400' },
  { id: 'builder', name: 'Builder', description: 'Completed 10+ development tasks', icon: 'Hammer', color: 'text-blue-400' },
  { id: 'community_leader', name: 'Community Leader', description: 'Led 5+ community initiatives', icon: 'Users', color: 'text-green-400' },
  { id: 'event_organizer', name: 'Event Organizer', description: 'Organized 3+ events', icon: 'Calendar', color: 'text-purple-400' },
  { id: 'researcher', name: 'Researcher', description: 'Completed 5+ research tasks', icon: 'Search', color: 'text-cyan-400' },
  { id: 'designer', name: 'Designer', description: 'Completed 5+ design tasks', icon: 'Palette', color: 'text-pink-400' },
]

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  content: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  development: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  design: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
  community: 'text-green-400 bg-green-400/10 border-green-400/30',
  research: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-green-400 bg-green-400/10 border-green-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  high: 'text-red-400 bg-red-400/10 border-red-400/30',
  urgent: 'text-red-500 bg-red-500/20 border-red-500/40',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'text-muted-foreground bg-muted/50 border-border',
  in_progress: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  submitted: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  completed: 'text-green-400 bg-green-400/10 border-green-400/30',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  completed: 'Completed',
}

export const MONTHLY_POINT_CAP = 100

/** Tiered payout by monthly points (min 10 pts to qualify). Cap 100 pts = ₹5000. */
export const PAYOUT_TIERS: { min: number; max: number; amount: number }[] = [
  { min: 10, max: 20, amount: 500 },
  { min: 21, max: 40, amount: 1000 },
  { min: 41, max: 60, amount: 2000 },
  { min: 61, max: 80, amount: 3000 },
  { min: 81, max: 99, amount: 4000 },
  { min: 100, max: 100, amount: 5000 },
]

export const MIN_POINTS_FOR_PAYOUT = 10
export const MAX_PAYOUT_INR = 5000

/** Get payout amount and tier label for a given monthly points total. Below 10 pts = no payout. */
export function getPayoutForPoints(points: number): { amount: number; tierLabel: string } {
  if (points < MIN_POINTS_FOR_PAYOUT) {
    return { amount: 0, tierLabel: `Below ${MIN_POINTS_FOR_PAYOUT} pts (no payout)` }
  }
  const pts = Math.min(points, MONTHLY_POINT_CAP)
  const tier = PAYOUT_TIERS.find((t) => pts >= t.min && pts <= t.max)
  if (!tier) return { amount: 0, tierLabel: '' }
  const label = tier.min === tier.max ? `${tier.min} pts` : `${tier.min}-${tier.max} pts`
  return { amount: tier.amount, tierLabel: label }
}

/** @deprecated Use tiered getPayoutForPoints; kept for any legacy display. */
export const POINT_VALUE_INR = 50
