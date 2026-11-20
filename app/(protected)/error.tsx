'use client'

import { Button, ButtonLink } from '@/components/ui/button'

export default function ProtectedError({ retry }: { retry: () => void }) {
  return <section className="card empty-state" role="alert">
    <h2>เปิดหน้านี้ไม่สำเร็จ</h2>
    <p>ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง หากยังเปิดไม่ได้ ให้กลับไปเลือกห้องของคุณ</p>
    <div className="hero__actions">
      <Button onClick={retry}>ลองอีกครั้ง</Button>
      <ButtonLink href="/rooms" variant="secondary">กลับไปห้องของฉัน</ButtonLink>
    </div>
  </section>
}
