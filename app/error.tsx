'use client'

import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main-content" className="container section" role="alert">
      <h1 className="page-title">มีบางอย่างขัดข้อง</h1>
      <p className="muted">หน้านี้ยังโหลดไม่สำเร็จ คุณสามารถลองอีกครั้งได้</p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </main>
  )
}
