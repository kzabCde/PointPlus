import type {Metadata} from 'next'
import { loadNotifications } from '@/features/social/notifications'
import { NotificationCenter } from '@/features/social/notification-center'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'การแจ้งเตือน'}
export default async function NotificationsPage() {
  const {notifications}=await loadNotifications()
  return <div className="social-stack">
    <h1 className="page-title">การแจ้งเตือน</h1>
    <RefreshControl/>
    <NotificationCenter items={notifications}/>
  </div>
}
