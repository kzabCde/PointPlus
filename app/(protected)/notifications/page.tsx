import type {Metadata} from 'next'
import { SectionHeader } from '@/components/ui/section-header'
import { loadNotifications } from '@/features/social/notifications'
import { NotificationCenter } from '@/features/social/notification-center'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'การแจ้งเตือน'}
export default async function NotificationsPage() {
  const {notifications}=await loadNotifications()
  return <div className="social-stack">
    <SectionHeader title="การแจ้งเตือน" heading="h1" actions={<RefreshControl/>}/>
    <NotificationCenter items={notifications}/>
  </div>
}
