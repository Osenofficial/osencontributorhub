'use client'

import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseLocalDateInput, toIsoLocalDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

type DateTimeFieldProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  /** If set, dates before this (local midnight) are disabled */
  minDate?: Date
  /** If set, dates after this (local end of day) are disabled */
  maxDate?: Date
  className?: string
  timeClassName?: string
}

function formatDisplay(value: string) {
  const datePart = value.slice(0, 10)
  const timePart = value.includes('T') ? value.slice(11, 16) : ''
  const d = parseLocalDateInput(datePart)
  if (!d) return 'Pick date & time'
  const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return timePart ? `${dateLabel} · ${timePart}` : dateLabel
}

export function DateTimeField({
  value,
  onChange,
  label,
  hint,
  required,
  disabled,
  minDate,
  maxDate,
  className,
  timeClassName,
}: DateTimeFieldProps) {
  const datePart = value?.slice(0, 10) ?? ''
  const timePart = value?.includes('T') ? value.slice(11, 16) : '12:00'

  function updateDate(d: Date | undefined) {
    if (!d) {
      onChange('')
      return
    }
    const nextDate = toIsoLocalDate(d)
    const nextTime = value?.includes('T') ? value.slice(11, 16) : '12:00'
    onChange(`${nextDate}T${nextTime}`)
  }

  function updateTime(nextTime: string) {
    if (!datePart) return
    onChange(`${datePart}T${nextTime}`)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-10 w-full justify-start bg-background/80 font-normal sm:flex-1"
            >
              <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />
              {value ? formatDisplay(value) : 'Pick date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-border/60 bg-popover" align="start">
            <Calendar
              mode="single"
              selected={parseLocalDateInput(datePart)}
              onSelect={updateDate}
              disabled={(date) => {
                if (minDate) {
                  const start = new Date(minDate)
                  start.setHours(0, 0, 0, 0)
                  if (date < start) return true
                }
                if (maxDate) {
                  const end = new Date(maxDate)
                  end.setHours(23, 59, 59, 999)
                  if (date > end) return true
                }
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Time</span>
          <Input
            type="time"
            disabled={disabled || !datePart}
            value={timePart}
            onChange={(e) => updateTime(e.target.value)}
            className={cn(
              'h-10 w-full min-w-[8.5rem] bg-background/80 disabled:opacity-50 sm:w-36',
              timeClassName,
            )}
          />
        </div>
      </div>
    </div>
  )
}

export function defaultDateTimeLocal(offsetHours = 0): string {
  const d = new Date()
  if (offsetHours) d.setHours(d.getHours() + offsetHours)
  const date = toIsoLocalDate(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${date}T${hh}:${mm}`
}
