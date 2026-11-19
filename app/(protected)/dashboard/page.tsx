import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'ภาพรวม',
}

/**
 * M01 is the protected route scaffold only.
 * M03/M04/M07/M10 will connect profiles, spaces, missions and dashboard data.
 * Never show fabricated points, missions or activity statistics.
 */
export default function DashboardPage() {
  return (
    <>
      <span className="eyebrow">PointPlus</span>
      <h1 className="page-title">ภาพรวมของคุณ</h1>
      <p className="muted">พื้นที่นี้จะรวบรวมภารกิจและเรื่องดี ๆ ที่คุณทำสำเร็จไว้ด้วยกัน</p>
      <Card className="empty-state">
        <span className="empty-state__symbol" aria-hidden="true">♡</span>
        <h2>กำลังเตรียมพื้นที่สำหรับภารกิจ</h2>
        <p>ยังไม่มีรายการภารกิจให้แสดงในขั้นตอนนี้ ระบบข้อมูลผู้ใช้ พื้นที่ และภารกิจจะเชื่อมต่อในขั้นตอนถัดไป</p>
      </Card>
    </>
  )
}
