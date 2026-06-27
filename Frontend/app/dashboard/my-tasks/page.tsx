'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AllTasksView } from '../all-tasks/page'
import { DashboardPageShell, PageCard } from '@/components/dashboard-page-shell'
import { Loader2 } from 'lucide-react'

function MyTasksContent() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('task')

  return (
    <AllTasksView
      pageTitle="My tasks"
      pageDescription="Everything assigned to you — start work, submit proof, and track review status."
      defaultFilter="assigned_to_me"
      lockFilter
      hideBackLink
      initialTaskId={taskId}
      defaultMyTasksTab="active"
    />
  )
}

export default function MyTasksPage() {
  return (
    <Suspense
      fallback={
        <DashboardPageShell title="My tasks" description="Everything assigned to you — start work, submit proof, and track review status." width="full">
          <PageCard className="flex flex-col items-center justify-center gap-3 p-16">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your tasks…</p>
          </PageCard>
        </DashboardPageShell>
      }
    >
      <MyTasksContent />
    </Suspense>
  )
}
