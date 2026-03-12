import { cn } from '@/lib/utils'

interface AvatarCircleProps {
  initials: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

export function AvatarCircle({ initials, src, size = 'md', className }: AvatarCircleProps) {
  const sizeClass = SIZE_MAP[size]
  const isUrl = src && (src.startsWith('http') || src.startsWith('//'))

  if (isUrl) {
    return (
      <div
        className={cn('relative shrink-0 overflow-hidden rounded-full border border-primary/30', sizeClass, className)}
      >
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        'bg-primary/20 text-primary border border-primary/30',
        sizeClass,
        className,
      )}
    >
      {initials}
    </div>
  )
}
