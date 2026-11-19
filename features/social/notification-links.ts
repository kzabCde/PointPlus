import type { NotificationItem } from './notifications'
import { isUuid } from '@/lib/auth/validation'

/** Client-safe routing; destination pages recheck Room membership and mission RLS. */
export function notificationDestination(item: Pick<NotificationItem,'space_id'|'type'|'payload'>) {
  if (!item.space_id || !isUuid(item.space_id)) return '/notifications'
  const base = '/s/' + item.space_id
  if (item.type === 'mission.submitted') return base + '/reviews'
  if (item.type === 'mission.review') return base + '/progress'
  if (item.type === 'mission.assigned') {
    const missionId = item.payload?.mission_id
    return typeof missionId === 'string' && isUuid(missionId)
      ? base + '/missions/' + missionId : base + '/missions'
  }
  return base
}
