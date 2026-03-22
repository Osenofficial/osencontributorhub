import { redirect } from 'next/navigation'

/** Legacy route — personal task board was removed; use All tasks instead. */
export default function TasksPageRedirect() {
  redirect('/dashboard/all-tasks')
}
