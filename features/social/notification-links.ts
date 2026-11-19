import type { NotificationItem } from './notifications'

/** Client-safe navigation helper. Resource authorization is checked again by target pages. */
export function notificationDestination(item: Pick<NotificationItem,'space_id'|'type'>) {
  if (!item.space_id) return '/notifications'
  if (item.type === 'mission.submitted') return '/s/' + item.space_id + '/reviews'
  if (item.type === 'mission.review') return '/s/' + item.space_id + '/progress'
  return '/s/' + item.space_id
}
