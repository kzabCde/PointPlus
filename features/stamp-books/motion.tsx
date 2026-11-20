'use client'

import { createContext, useActionState, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { StampBookState } from './actions'
import { activityKey, type BookActivity } from './journal-model'

export const idle: StampBookState = { status: 'idle', message: '' }

type MotionContext = {
  known: ReadonlySet<string>
  receipts: BookActivity[]
  publish: (receipt: BookActivity) => void
  take: (receipt: BookActivity) => boolean
}

const BookMotionContext = createContext<MotionContext | null>(null)

export function BookMotionProvider({ confirmed, children }: { confirmed: string[]; children: ReactNode }) {
  const [receipts, setReceipts] = useState<BookActivity[]>([])
  const played = useRef(new Set<string>())
  const known = useMemo(() => new Set(confirmed), [confirmed])

  const publish = useCallback((receipt: BookActivity) => {
    setReceipts(previous => previous.some(entry => activityKey(entry) === activityKey(receipt))
      ? previous : [...previous.slice(-15), receipt])
  }, [])

  const take = useCallback((receipt: BookActivity) => {
    const key = activityKey(receipt)
    if (played.current.has(key)) return false
    played.current.add(key)
    return true
  }, [])

  return <BookMotionContext.Provider value={{ known, receipts, publish, take }}>
    {children}
  </BookMotionContext.Provider>
}

export function useBookMotion() {
  return useContext(BookMotionContext)
}

export function useBookAction(action: (state: StampBookState, form: FormData) => Promise<StampBookState>) {
  const motion = useBookMotion()

  return useActionState(async (state: StampBookState, form: FormData) => {
    // Capture the records visible before the Server Action applies its route refresh.
    const knownBefore = motion?.known
    const result = await action(state, form)
    if (result.receipt && knownBefore && !knownBefore.has(activityKey(result.receipt))) {
      motion?.publish(result.receipt)
    }
    return result
  }, idle)
}
