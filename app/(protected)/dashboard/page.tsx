import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { loadMyProfile } from '@/features/profiles/data'

export const metadata: Metadata = { title: 'ภาพรวม' }
export default async function DashboardPage() {
  const { profile, personalSpace, error } = await loadMyProfile()
  return (
    <>
      <span className="eyebrow">PointPlus</span>
      <h1 className="page-title">สวัสดี{profile?.display_name && profile.display_name !== 'Member' ? ' ' + profile.display_name : ''}</h1>
      {error || !profile
        ? <div role="alert" className="card">ไม่สามารถโหลดข้อมูลบัญชีจาก Supabase ได้ โปรดลองใหม่อีกครั้ง</div>
        : <p className="muted">ภารกิจและพื้นที่ความสัมพันธ์ของคุณจะอยู่ที่นี่</p>}
      {profile?.display_name === 'Member' && <p><Link href="/onboarding" className="button button--primary">เริ่มตั้งค่าโปรไฟล์</Link></p>}
      <Card className="empty-state">
        <span className="empty-state__symbol" aria-hidden="true">♡</span>
        <h2>เริ่มต้นจากพื้นที่ของคุณ</h2>
        <p>สร้างและติดตามภารกิจที่ทำร่วมกันได้ภายในพื้นที่ส่วนตัว คนรัก หรือครอบครัว</p>
        {personalSpace && <Link href={'/s/' + personalSpace.id} className="button button--primary">เปิดพื้นที่ส่วนตัว</Link>}
        <Link href="/spaces" className="button button--secondary">ดูพื้นที่ทั้งหมด</Link>
      </Card>
    </>
  )
}
