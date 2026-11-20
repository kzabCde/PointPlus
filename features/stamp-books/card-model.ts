/** Pure mapping of the shared, chronological mark ledger onto card slots.
 * Existing unindexed marks always occupy the earliest unclaimed numbered slots.
 * New explicit slot indexes win without moving the historical marks unnecessarily.
 */
export function cardMarkSlots<T extends { slot_index: number | null }>(
  marks: readonly T[], count: number,
): (T | null)[] {
  if (!Number.isInteger(count) || count < 0 || count > 100) return []
  const cells: (T | null)[] = Array.from({ length: count }, () => null)
  for (const mark of marks) {
    const slot = mark.slot_index
    if (slot !== null && Number.isInteger(slot) && slot >= 0 && slot < count && cells[slot] === null)
      cells[slot] = mark
  }
  let next = 0
  for (const mark of marks) {
    if (mark.slot_index !== null) continue
    while (next < count && cells[next] !== null) next++
    if (next < count) cells[next++] = mark
  }
  return cells
}
