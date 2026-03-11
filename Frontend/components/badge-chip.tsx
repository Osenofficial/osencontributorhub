import { cn } from '@/lib/utils'
import { Trophy, Hammer, Users, Calendar, Search, Palette } from 'lucide-react'
import type { Badge } from '@/lib/data'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy,
  Hammer,
  Users,
  Calendar,
  Search,
  Palette,
}

interface BadgeChipProps {
  badge: Badge
  size?: 'sm' | 'md'
}

export function BadgeChip({ badge, size = 'md' }: BadgeChipProps) {
  const Icon = ICON_MAP[badge.icon] ?? Trophy
  return (
    <div
      className={cn(
        'glass flex items-center gap-1.5 rounded-full border px-2 py-1',
        size === 'sm' ? 'text-xs' : 'text-sm',
      )}
      title={badge.description}
    >
      <Icon className={cn('shrink-0', badge.color, size === 'sm' ? 'size-3' : 'size-3.5')} />
      <span className="text-foreground/80">{badge.name}</span>
    </div>
  )
}
