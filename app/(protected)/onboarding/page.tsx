import type { Metadata } from 'next'
import Link from 'next/link'
import { loadMyProfile } from '@/features/profiles/data'
import { ProfileForm } from '@/features/profiles/profile-form'

export const metadata: Metadata = { title: 'เริ่มต้นใช้งาน' }
export default async function OnboardingPage() {
  const { profile, personalSpace, participant, error } = await loadMyProfile()
  return (
    <>
      <span className="eyebrow">ยินดีต้อนรับ</span>
      <h1 className="page-title">มาเริ่มด้วยเรื่องเล็ก ๆ ที่สำคัญกัน</h1>
      <p className="muted">แนะนำตัวคุณสั้น ๆ จากนั้นเลือกพื้นที่ที่อยากเริ่มต้น</p>
      {error || !profile
        ? <div role="alert" className="card">ข้อมูลโปรไฟล์ยังไม่พร้อม กรุณาตรวจสอบว่าการสร้างข้อมูลเมื่อสมัครสมาชิกสำเร็จแล้ว</div>
        : <ProfileForm profile={profile} onboarding />}
      <div className="card" style={{ marginTop: 18 }}>
        <h2>พื้นที่ส่วนตัว</h2>
        {personalSpace && participant
          ? <><p>พื้นที่ของคุณ: <strong>{personalSpace.name}</strong></p><p>ผู้เข้าร่วม: {participant.display_name}</p><Link href={'/s/' + personalSpace.id} className="button button--secondary">เปิดพื้นที่ส่วนตัว</Link></>
          : <p role="status">ยังไม่พบพื้นที่ส่วนตัวหรือผู้เข้าร่วม โปรดตรวจสอบการสร้างข้อมูลอัตโนมัติในฐานข้อมูล โดยไม่สร้างข้อมูลซ้ำจากหน้าเว็บ</p>}
        <p className="muted" style={{ marginTop: 15 }}>สามารถสร้างพื้นที่สำหรับคนรักหรือครอบครัวจากหน้า “พื้นที่ของฉัน” ได้</p>
      </div>
    </>
  )
}
