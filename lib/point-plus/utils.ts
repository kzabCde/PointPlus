/** Pure display-asset lookups. No database, progress or unlock state. */
import {
  pointPlusBadges,
  pointPlusStamps,
  type BadgeDefinition,
  type PointPlusMode,
  type StampDefinition,
} from './assets'

/** Find an existing design by its stable *asset* identifier. */
export function findStampById(id: string): StampDefinition | undefined {
  return pointPlusStamps.find((stamp) => stamp.id === id)
}

export function findBadgeById(id: string): BadgeDefinition | undefined {
  return pointPlusBadges.find((badge) => badge.id === id)
}

export function listStampsByMode(mode: PointPlusMode): readonly StampDefinition[] {
  return pointPlusStamps.filter((stamp) => stamp.mode === mode)
}

export function listBadgesByMode(mode: PointPlusMode): readonly BadgeDefinition[] {
  return pointPlusBadges.filter((badge) => badge.mode === mode)
}

/** PNG is the bundled fallback for a known design; unknown IDs use the provided app fallback. */
export function stampAssetUrl(id: string, fallback = '/point-plus/stamps/personal/sunrise.png'): string {
  return findStampById(id)?.png ?? fallback
}

export function badgeAssetUrl(id: string, fallback = '/point-plus/badges/personal/fresh-start.png'): string {
  return findBadgeById(id)?.png ?? fallback
}
