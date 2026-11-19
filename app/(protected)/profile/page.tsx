import type { Metadata } from 'next'
import Link from 'next/link'
import { loadMyProfile } from '@/features/profiles/data'
import { ProfileForm } from '@/features/profiles/profile-form'

export const metadata: Metadata = { title: 'โปรไฟล์' }
export default async function ProfilePage() {
  const { user, profile, error } = await loadMyProfile()
  return (
    <>
      <h1 className="page-title">โปรไฟล์ของฉัน</h1>
      <p className="muted">จัดการชื่อที่แสดง ภาษา และเขตเวลาที่ใช้ใน PointPlus</p>
      <p className="muted">บัญชี: {user.email}</p>
      {error || !profile
        ? <div className="card" role="alert">ไม่พบโปรไฟล์ในฐานข้อมูล โปรดตรวจสอบการสร้างข้อมูลเริ่มต้นของบัญชีและติดต่อผู้ดูแลระบบ</div>
        : <ProfileForm profile={profile} />}
      <p><Link href="/spaces" className="text-link">ดูพื้นที่ของฉัน</Link></p>
    </>
  )
}
