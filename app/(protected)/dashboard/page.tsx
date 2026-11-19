import type { Metadata } from 'next'
import Link from 'next/link'
import { loadDashboard } from '@/features/dashboard/data'

export const metadata: Metadata = { title: 'ภาพรวม' }
export default async function DashboardPage() {
  const { identity, summaries } = await loadDashboard()
  const profile = identity.profile
  return <>
    <span className="eyebrow">PointPlus</span>
    <h1 className="page-title">สวัสดี{profile?.display_name && profile.display_name !== 'Member' ? ' ' + profile.display_name : ''}</h1>
    <p className="muted">ภารกิจของคุณและคนสำคัญ ในทุกพื้นที่ที่เข้าถึงได้</p>
    <div className="hero__actions" style={{ marginTop: 16, marginBottom: 24 }}>
      <Link href="/activities/new" className="button button--primary">สร้างกิจกรรมใหม่</Link>
      <Link href="/spaces" className="button button--secondary">สร้างพื้นที่สำหรับคนสำคัญ</Link>
    </div>
    {identity.error || !profile
      ? <div className="card" role="alert">ยังโหลดโปรไฟล์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลและข้อมูลตั้งต้นของบัญชี</div>
      : profile.display_name === 'Member' && <p><Link className="button button--primary" href="/onboarding">ตั้งค่าโปรไฟล์</Link></p>}
    {!summaries.length
      ? <div className="card empty-state"><h2>ยังไม่มีพื้นที่ให้แสดง</h2>
          <p>หลังสมัครสมาชิกระบบจะสร้างพื้นที่ส่วนตัวอัตโนมัติ หากยังไม่พบ โปรดตรวจสอบฐานข้อมูล</p>
          <Link href="/spaces" className="button button--primary">ไปยังพื้นที่ของฉัน</Link>
        </div>
      : <div className="dashboard-grid">{summaries.map(s => <section key={s.space.id} className="feature-card">
        <span className="eyebrow">{s.space.kind === 'personal' ? 'ส่วนตัว' : s.space.kind === 'couple' ? 'คนรัก' : 'ครอบครัว'}</span>
        <h2>{s.space.name}</h2>
        <p className="muted">บทบาท: {s.role} · ผู้เข้าร่วมที่มองเห็น: {s.visibleParticipants} คน · สมาชิก: {s.memberCount} คน</p>
        <div className="dashboard-stats">
          <div><strong>{s.activeCount}</strong><span>ภารกิจเปิดใช้งานที่มองเห็น</span></div>
          <div><strong>{s.currentlyAvailable}</strong><span>อยู่ในช่วงเวลาที่กำหนด</span></div>
          <div><strong>{s.assignedCount}</strong><span>ภารกิจแบบมอบหมาย</span></div>
          <div><strong>{s.points === null ? '—' : s.points.toLocaleString('th-TH')}</strong><span>แต้มของ {s.participantName ?? 'ผู้เข้าร่วม'}</span></div>
        </div>
        <div className="hero__actions">
          <Link href={'/s/' + s.space.id + '/missions'} className="button button--primary">เปิดภารกิจ</Link>
          <Link href={'/s/' + s.space.id} className="button button--secondary">ดูพื้นที่</Link>
          {(s.role === 'owner' || s.role === 'admin') &&
            <Link href={'/s/' + s.space.id + '/missions/new'} className="text-link">สร้างภารกิจ</Link>}
        </div>
      </section>)}</div>}
    <p className="muted" style={{ marginTop: 20 }}>จำนวนภารกิจนับจากรายการที่บัญชีและผู้เข้าร่วมนี้มองเห็น ไม่ใช่สถิติการทำสำเร็จหรือคะแนนที่จำลองขึ้น</p>
  </>
}
