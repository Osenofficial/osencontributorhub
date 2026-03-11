// Mock data store for OSEN Contributor Hub
// All data is in-memory for demo purposes

export type Role = 'admin' | 'lead' | 'associate' | 'intern'
export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'completed'
export type TaskCategory = 'content' | 'development' | 'design' | 'community' | 'research'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar: string
  points: number
  tasksCompleted: number
  rank: number
  joinedAt: string
  badges: Badge[]
  bio: string
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

export const USERS: User[] = [
  {
    id: 'u1',
    name: 'Arjun Sharma',
    email: 'arjun@osen.dev',
    role: 'admin',
    avatar: 'AS',
    points: 95,
    tasksCompleted: 12,
    rank: 1,
    joinedAt: '2024-01-15',
    bio: 'Full-stack developer and OSEN co-founder. Passionate about open-source.',
    badges: [BADGES[0], BADGES[1], BADGES[2]],
  },
  {
    id: 'u2',
    name: 'Priya Nair',
    email: 'priya@osen.dev',
    role: 'lead',
    avatar: 'PN',
    points: 82,
    tasksCompleted: 10,
    rank: 2,
    joinedAt: '2024-02-01',
    bio: 'UI/UX designer focused on futuristic interfaces.',
    badges: [BADGES[5], BADGES[2]],
  },
  {
    id: 'u3',
    name: 'Rahul Verma',
    email: 'rahul@osen.dev',
    role: 'associate',
    avatar: 'RV',
    points: 74,
    tasksCompleted: 9,
    rank: 3,
    joinedAt: '2024-02-10',
    bio: 'Backend engineer. Loves Rust, Go, and distributed systems.',
    badges: [BADGES[1], BADGES[4]],
  },
  {
    id: 'u4',
    name: 'Sneha Patel',
    email: 'sneha@osen.dev',
    role: 'associate',
    avatar: 'SP',
    points: 65,
    tasksCompleted: 8,
    rank: 4,
    joinedAt: '2024-03-05',
    bio: 'Content strategist and community builder.',
    badges: [BADGES[2], BADGES[3]],
  },
  {
    id: 'u5',
    name: 'Dev Kapoor',
    email: 'dev@osen.dev',
    role: 'intern',
    avatar: 'DK',
    points: 58,
    tasksCompleted: 7,
    rank: 5,
    joinedAt: '2024-03-20',
    bio: 'Research lead exploring Web3 and DeFi protocols.',
    badges: [BADGES[4]],
  },
  {
    id: 'u6',
    name: 'Meera Iyer',
    email: 'meera@osen.dev',
    role: 'intern',
    avatar: 'MI',
    points: 47,
    tasksCompleted: 6,
    rank: 6,
    joinedAt: '2024-04-01',
    bio: 'Event coordinator and community manager.',
    badges: [BADGES[3]],
  },
  {
    id: 'u7',
    name: 'Karan Singh',
    email: 'karan@osen.dev',
    role: 'associate',
    avatar: 'KS',
    points: 38,
    tasksCompleted: 5,
    rank: 7,
    joinedAt: '2024-04-15',
    bio: 'Frontend developer passionate about animations and interactions.',
    badges: [BADGES[1]],
  },
  {
    id: 'u8',
    name: 'Ananya Roy',
    email: 'ananya@osen.dev',
    role: 'associate',
    avatar: 'AR',
    points: 29,
    tasksCompleted: 4,
    rank: 8,
    joinedAt: '2024-05-01',
    bio: 'Designer and illustrator creating visual stories.',
    badges: [BADGES[5]],
  },
]

export const TASKS: Task[] = [
  {
    id: 't1',
    title: 'Build Contributor Dashboard UI',
    description: 'Design and develop the main contributor dashboard with stats, task overview, and leaderboard preview.',
    category: 'development',
    points: 15,
    deadline: '2025-08-15',
    assignedTo: 'u2',
    createdBy: 'u1',
    status: 'completed',
    priority: 'high',
    createdAt: '2025-07-01',
    submission: {
      githubLink: 'https://github.com/osen/dashboard',
      comments: 'Completed with Figma mockups and full implementation.',
      submittedAt: '2025-07-14',
    },
  },
  {
    id: 't2',
    title: 'Write Web3 Integration Research Report',
    description: 'Research top Web3 protocols and prepare a comprehensive report on potential integrations for OSEN.',
    category: 'research',
    points: 10,
    deadline: '2025-08-20',
    assignedTo: 'u5',
    createdBy: 'u1',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2025-07-10',
  },
  {
    id: 't3',
    title: 'Design Landing Page Mockups',
    description: 'Create high-fidelity mockups for the new OSEN landing page in Figma. Include mobile and desktop views.',
    category: 'design',
    points: 12,
    deadline: '2025-08-10',
    assignedTo: 'u2',
    createdBy: 'u1',
    status: 'submitted',
    priority: 'high',
    createdAt: '2025-07-05',
    submission: {
      notionLink: 'https://notion.so/osen/landing-mockups',
      comments: 'Figma file linked in Notion. All breakpoints covered.',
      submittedAt: '2025-08-08',
    },
  },
  {
    id: 't4',
    title: 'Organize Community AMA Session',
    description: 'Plan and host a monthly AMA session with 3 industry guests.',
    category: 'community',
    points: 8,
    deadline: '2025-08-25',
    assignedTo: 'u6',
    createdBy: 'u1',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2025-07-15',
  },
  {
    id: 't5',
    title: 'Write Monthly Newsletter',
    description: 'Draft the OSEN monthly newsletter covering highlights, member spotlights, and upcoming events.',
    category: 'content',
    points: 6,
    deadline: '2025-08-30',
    assignedTo: 'u4',
    createdBy: 'u1',
    status: 'todo',
    priority: 'low',
    createdAt: '2025-07-20',
  },
  {
    id: 't6',
    title: 'Implement API Rate Limiting',
    description: 'Add rate limiting middleware to all public API endpoints using Redis.',
    category: 'development',
    points: 14,
    deadline: '2025-08-12',
    assignedTo: 'u3',
    createdBy: 'u1',
    status: 'completed',
    priority: 'high',
    createdAt: '2025-07-08',
    submission: {
      githubLink: 'https://github.com/osen/api-ratelimit',
      comments: 'PR merged. Docs updated.',
      submittedAt: '2025-08-11',
    },
  },
  {
    id: 't7',
    title: 'Create Social Media Content Calendar',
    description: 'Build a 30-day content calendar for X, LinkedIn, and Instagram with post templates.',
    category: 'content',
    points: 7,
    deadline: '2025-09-01',
    assignedTo: 'u4',
    createdBy: 'u1',
    status: 'todo',
    priority: 'medium',
    createdAt: '2025-07-25',
  },
  {
    id: 't8',
    title: 'Design Brand Icon Set',
    description: 'Create a custom SVG icon set (30+ icons) consistent with OSEN branding.',
    category: 'design',
    points: 11,
    deadline: '2025-08-28',
    assignedTo: 'u8',
    createdBy: 'u1',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2025-07-18',
  },
  {
    id: 't9',
    title: 'Build Mobile App Prototype',
    description: 'Create an interactive Figma prototype for the OSEN mobile companion app.',
    category: 'design',
    points: 13,
    deadline: '2025-09-05',
    assignedTo: 'u7',
    createdBy: 'u1',
    status: 'todo',
    priority: 'high',
    createdAt: '2025-07-28',
  },
  {
    id: 't10',
    title: 'Write Smart Contract Documentation',
    description: 'Document the OSEN points smart contract with code comments and integration examples.',
    category: 'research',
    points: 9,
    deadline: '2025-09-10',
    assignedTo: 'u5',
    createdBy: 'u1',
    status: 'todo',
    priority: 'medium',
    createdAt: '2025-07-30',
  },
]

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'u2',
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: 'You have been assigned "Design Landing Page Mockups"',
    read: false,
    createdAt: '2025-07-05T10:00:00Z',
  },
  {
    id: 'n2',
    userId: 'u2',
    type: 'points_awarded',
    title: 'Points Awarded',
    message: 'You earned 15 points for completing "Build Contributor Dashboard UI"',
    read: false,
    createdAt: '2025-07-15T14:30:00Z',
  },
  {
    id: 'n3',
    userId: 'u3',
    type: 'task_approved',
    title: 'Task Approved',
    message: 'Your submission for "Implement API Rate Limiting" has been approved!',
    read: true,
    createdAt: '2025-08-12T09:00:00Z',
  },
  {
    id: 'n4',
    userId: 'u4',
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: 'You have been assigned "Write Monthly Newsletter"',
    read: false,
    createdAt: '2025-07-20T11:00:00Z',
  },
  {
    id: 'n5',
    userId: 'u5',
    type: 'admin_comment',
    title: 'Admin Comment',
    message: 'Arjun left a comment on "Write Web3 Integration Research Report"',
    read: false,
    createdAt: '2025-07-22T16:00:00Z',
  },
]

export const ACTIVITIES: Activity[] = [
  { id: 'a1', userId: 'u2', action: 'Submitted task', detail: '"Design Landing Page Mockups"', createdAt: '2025-08-08T12:00:00Z' },
  { id: 'a2', userId: 'u3', action: 'Completed task', detail: '"Implement API Rate Limiting"', points: 14, createdAt: '2025-08-11T15:00:00Z' },
  { id: 'a3', userId: 'u1', action: 'Created task', detail: '"Write Smart Contract Documentation"', createdAt: '2025-07-30T09:00:00Z' },
  { id: 'a4', userId: 'u5', action: 'Started task', detail: '"Write Web3 Integration Research Report"', createdAt: '2025-07-12T10:00:00Z' },
  { id: 'a5', userId: 'u6', action: 'Started task', detail: '"Organize Community AMA Session"', createdAt: '2025-07-16T14:00:00Z' },
  { id: 'a6', userId: 'u2', action: 'Earned badge', detail: '"Designer"', createdAt: '2025-07-10T11:00:00Z' },
]

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id)
}

export function getTasksByUser(userId: string): Task[] {
  return TASKS.filter((t) => t.assignedTo === userId)
}

export function getNotificationsByUser(userId: string): Notification[] {
  return NOTIFICATIONS.filter((n) => n.userId === userId)
}

export function getActivitiesByUser(userId: string): Activity[] {
  return ACTIVITIES.filter((a) => a.userId === userId)
}

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
export const POINT_VALUE_INR = 50
