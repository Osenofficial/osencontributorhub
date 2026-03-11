import { cn } from '@/lib/utils'
import type { TaskCategory, Priority, TaskStatus } from '@/lib/data'
import { CATEGORY_COLORS, PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/data'

interface StatusBadgeProps {
  value: TaskCategory | Priority | TaskStatus
  type: 'category' | 'priority' | 'status'
  className?: string
}

const LABELS: Record<string, string> = {
  content: 'Content',
  development: 'Development',
  design: 'Design',
  community: 'Community',
  research: 'Research',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ...STATUS_LABELS,
}

export function StatusBadge({ value, type, className }: StatusBadgeProps) {
  const colorMap =
    type === 'category' ? CATEGORY_COLORS :
    type === 'priority' ? PRIORITY_COLORS :
    STATUS_COLORS

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
        colorMap[value as keyof typeof colorMap],
        className,
      )}
    >
      {LABELS[value] ?? value}
    </span>
  )
}
