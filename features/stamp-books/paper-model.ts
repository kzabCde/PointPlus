/** Pure, device-independent paper geometry. No browser or Supabase dependency. */
export const stampsOnNotebookPage = 6

export type PaperLayout = 'single_sheet' | 'notebook'
export type PaperPosition = { pageIndex: number; x: number; y: number; rotation: number }

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
  }
}

export function normalizedPaperPosition(clientX: number, clientY: number,
  bounds: { left: number; top: number; width: number; height: number }) {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height]
    .every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: Math.max(.10, Math.min(.90, (clientX - bounds.left) / bounds.width)),
    y: Math.max(.10, Math.min(.90, (clientY - bounds.top) / bounds.height)),
  }
}

export function deterministicRotation(x: number, y: number) {
  return Math.round(((x * 137 + y * 233) % 13) - 6)
}
