import type { BookClaim, BookMark, StampCycle } from './data'

export const slotsPerPage = 6

export type BookActivity = {
  kind: 'stamp' | 'requested' | 'fulfilled'
  id: string
}

export type JournalMark = Pick<BookMark, 'id' | 'request_id' | 'asset_id' | 'stamped_at' | 'note' | 'page_index' | 'position_x' | 'position_y' | 'rotation_deg'> & {
  giver: string
  date: string
}

export type JournalCycle = Pick<StampCycle, 'id' | 'cycle_no' | 'target_snapshot' | 'progress_count' | 'completed_at'> & {
  completedDate?: string
  marks: JournalMark[]
  claim?: Pick<BookClaim, 'id' | 'status' | 'reward_title_snapshot'>
}

export const activityKey = ({ kind, id }: BookActivity) => kind + ':' + id

export function pageCount(target: number) {
  return Math.max(1, Math.ceil(target / slotsPerPage))
}

export function stampPage(target: number, page: number) {
  const start = page * slotsPerPage
  return Array.from({ length: Math.min(slotsPerPage, target - start) }, (_, offset) => start + offset)
}

/** Motion requires both a local action receipt and the exact persisted row. */
export function locateActivity(cycles: readonly JournalCycle[], activity: BookActivity) {
  for (const cycle of cycles) {
    if (activity.kind === 'stamp') {
      const slot = cycle.marks.findIndex(mark => mark.request_id === activity.id)
      if (slot >= 0 && slot < cycle.target_snapshot) {
        return {
          cycleId: cycle.id, page: cycle.marks[slot].page_index ?? Math.floor(slot / 8),
          completedByStamp: !!cycle.completed_at && slot === cycle.target_snapshot - 1,
        }
      }
    } else if (cycle.claim?.status === activity.kind) {
      const id = activity.kind === 'requested' ? cycle.id : cycle.claim.id
      if (id === activity.id) return { cycleId: cycle.id }
    }
  }
}
