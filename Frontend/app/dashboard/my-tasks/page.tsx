'use client'

import { AllTasksView } from '../all-tasks/page'

export default function MyTasksPage() {
  return (
    <AllTasksView
      pageTitle="My tasks"
      pageDescription="Everything assigned to you — start work, submit proof, and track review status."
      defaultFilter="assigned_to_me"
      lockFilter
      hideBackLink
    />
  )
}
