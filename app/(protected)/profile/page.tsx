import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { loadMyProfile } from '@/features/profiles/data'
import { ProfileForm } from '@/features/profiles/profile-form'

export const metadata: Metadata = { title: 'โปรไฟล์' }
export default async function ProfilePage() {
  const { user, profile, error } = await loadMyProfile()
  return (
    <section className="stationery-stack">
      <SectionHeader title="โปรไฟล์ของฉัน" heading="h1" description={user.email}/>
      {error || !profile
        ? <div className="card" role="alert">ยังเปิดโปรไฟล์ไม่ได้ ลองโหลดใหม่อีกครั้ง</div>
        : <ProfileForm profile={profile} />}
      <p><Link href="/rooms" className="text-link">กลับไปห้องของฉัน</Link></p>
    </section>
  )
}
