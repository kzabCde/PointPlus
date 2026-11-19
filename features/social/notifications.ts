import { requireUser } from '@/lib/auth/session'
export type NotificationItem = {
  id: string; space_id: string | null; type: string; title: string
  body: string | null; payload: Record<string,unknown>
  read_at: string | null; created_at: string
}
export async function loadNotifications() {
  const {supabase,user}=await requireUser()
  const {data,error,count}=await supabase.from('notifications')
    .select('id,space_id,type,title,body,payload,read_at,created_at',{count:'exact'})
    .eq('recipient_user_id',user.id).order('created_at',{ascending:false}).limit(50)
  if(error) throw new Error('Cannot load your notifications')
  return { notifications:(data??[]) as NotificationItem[],count:count??0 }
}
export { notificationDestination } from './notification-links'
