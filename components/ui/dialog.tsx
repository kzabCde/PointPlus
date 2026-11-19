'use client'

import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './button'

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <div>{children}</div>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={() => ref.current?.close()}>ปิด</Button>
      </div>
    </dialog>
  )
}
