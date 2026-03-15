'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { AvatarCircle } from '@/components/avatar-circle'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

export type TaskComment = {
  _id: string
  body: string
  createdAt: string
  author: { _id: string; name?: string; email?: string; avatar?: string }
}

export function TaskComments({
  taskId,
  className,
}: {
  taskId: string
  className?: string
}) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    apiFetch<TaskComment[]>(`/dashboard/tasks/${taskId}/comments`)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [taskId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || !taskId || submitting) return
    setSubmitting(true)
    apiFetch<TaskComment>(`/dashboard/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: trimmed }),
    })
      .then((newComment) => {
        setComments((prev) => [...prev, newComment])
        setBody('')
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  if (!taskId) return null

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="size-3.5" /> Comments ({comments.length})
      </h4>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading comments…</p>
      ) : (
        <>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div
                  key={c._id}
                  className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AvatarCircle
                      size="xs"
                      initials={c.author?.name?.slice(0, 2) ?? '?'}
                      src={c.author?.avatar?.startsWith?.('http') ? c.author.avatar : undefined}
                    />
                    <span className="font-medium">{c.author?.name ?? 'Unknown'}</span>
                    <span className="text-muted-foreground">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap pl-7">{c.body}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[72px] resize-none text-sm"
              maxLength={2000}
              disabled={submitting}
            />
            <Button type="submit" size="icon" className="shrink-0 h-9 w-9" disabled={!body.trim() || submitting}>
              <Send className="size-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
