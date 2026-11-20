/** Pure helpers for precise, freely placed stamps. Rendering uses normalized paper coordinates. */
export const stampsOnNotebookPage = 6
export const minStampScale = 0.4
export const maxStampScale = 2.5

export type PaperLayout = 'single_sheet' | 'notebook'
export type PaperPosition = { pageIndex: number; x: number; y: number; rotation: number; scale: number }

export function paperPageCount(target: number, layout: PaperLayout) {
  if (!Number.isFinite(target) || target < 1) return 1
  return layout === 'single_sheet' ? 1 : Math.max(1, Math.ceil(target / stampsOnNotebookPage))
}

export function legacyPaperPosition(index: number): PaperPosition {
  const slot = index % stampsOnNotebookPage
  return {
    pageIndex: Math.floor(index / stampsOnNotebookPage),
    x: ((slot % 3) + .5) / 3,
    y: (Math.floor(slot / 3) + .5) / 2,
    rotation: (index % 5 - 2) * 3,
    scale: 1,
  }
}

export function clampStampScale(value: number) {
  return Number.isFinite(value) ? Math.max(minStampScale, Math.min(maxStampScale, value)) : 1
}

/** Return degrees in [-180, 180). Rotations can freely cover the entire 360-degree circle. */
export function normalizeStampRotation(degrees: number) {
  if (!Number.isFinite(degrees)) return 0
  return ((degrees + 180) % 360 + 360) % 360 - 180
}

/** Supports intentional placement directly at the edges of the sheet (0..1). */
export function normalizedPaperPosition(clientX: number, clientY: number,
  bounds: { left: number; top: number; width: number; height: number }) {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height]
    .every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
  }
}

/** Pinch and twist the *uncommitted stamp*; saved stamps never change. */
export function stampGestureTransform(
  initial: { distance: number; angle: number; scale: number; rotation: number },
  current: { distance: number; angle: number },
) {
  if (initial.distance <= 0 || !Number.isFinite(current.distance) || !Number.isFinite(current.angle)) {
    return { scale: clampStampScale(initial.scale), rotation: normalizeStampRotation(initial.rotation) }
  }
  return {
    scale: clampStampScale(initial.scale * current.distance / initial.distance),
    rotation: normalizeStampRotation(initial.rotation + (current.angle - initial.angle) * 180 / Math.PI),
  }
}

/** Retained for the original deterministic paper layout tests. */
export function deterministicRotation(x: number, y: number) {
  return Math.round(((x * 137 + y * 233) % 13) - 6)
}
