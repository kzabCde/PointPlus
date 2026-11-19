import { redirect } from 'next/navigation'
/** Legacy URL: bypass the expensive cross-Space dashboard altogether. */
export default function DashboardPage() { redirect('/rooms') }
