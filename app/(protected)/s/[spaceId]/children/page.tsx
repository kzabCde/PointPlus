import type { Metadata } from 'next'
import { getSpaceContext, canManage } from '@/features/spaces/data'
import { loadFamilyChildren } from '@/features/participants/data'
import { ChildForm } from '@/features/participants/child-form'

export const metadata: Metadata = { title: 'เด็กในครอบครัว' }
export default async function ChildrenPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ user, member }, children] = await Promise.all([
    getSpaceContext(spaceId), loadFamilyChildren(spaceId),
  ])
  return (
    <>
      <h2>เด็กในครอบครัว</h2>
      <p className="muted">แสดงเฉพาะโปรไฟล์ที่คุณมีสิทธิ์ดูแลหรือได้รับสิทธิ์ผู้จัดการตาม RLS</p>
      {children.length ? <div className="feature-grid" style={{ marginBottom: 24 }}>
        {children.map((child) => <article key={child.id} className="feature-card">
          <h3>{child.display_name}</h3>
          <p>{child.guardian_user_id === user.id ? 'คุณเป็นผู้ปกครอง' : canManage(member.role) ? 'โปรไฟล์ที่ผู้ดูแลเข้าถึงได้' : 'สมาชิกครอบครัว'}</p>
          {child.birth_year !== null && <p>ปีเกิด (ค.ศ.): {child.birth_year}</p>}
          {child.note && <p>หมายเหตุ: {child.note}</p>}
        </article>)}
      </div> : <div role="status" className="card" style={{ marginBottom: 20 }}>ยังไม่มีโปรไฟล์เด็กที่คุณเข้าถึงได้</div>}
      <ChildForm spaceId={spaceId} />
    </>
  )
}
