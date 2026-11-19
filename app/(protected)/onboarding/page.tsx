import type { Metadata } from 'next'
import { loadMyProfile } from '@/features/profiles/data'
import { ProfileForm } from '@/features/profiles/profile-form'
export const metadata: Metadata = { title: 'เริ่มต้นใช้งาน' }
export default async function OnboardingPage() {
  const { profile, error } = await loadMyProfile()
  return <>
    <span className="eyebrow">ยินดีต้อนรับสู่ Point+</span>
    <h1 className="page-title">มาทำความรู้จักกันก่อน</h1>
    <p className="muted">ตั้งชื่อที่จะแสดง จากนั้นสร้างห้องหรือเข้าร่วมห้องของคนสำคัญ</p>
    {error || !profile
      ? <div role="alert" className="card">ข้อมูลโปรไฟล์ยังไม่พร้อม กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล</div>
      : <ProfileForm profile={profile} onboarding />}
  </>
}
