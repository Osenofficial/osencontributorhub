import { cn } from '@/lib/utils'

interface AvatarCircleProps {
  initials: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

export function AvatarCircle({ initials, size = 'md', className }: AvatarCircleProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        'bg-primary/20 text-primary border border-primary/30',
        SIZE_MAP[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}
