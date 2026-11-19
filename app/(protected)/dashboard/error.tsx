'use client'

import { Button } from '@/components/ui/button'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card">
      <h2>ไม่สามารถเปิดภาพรวมได้</h2>
      <p>โปรดลองใหม่อีกครั้ง หากยังมีปัญหาให้กลับไปหน้าแรก</p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </div>
  )
}
