import type { Metadata } from 'next'
import { getManagerContext, getMissionCatalog } from '@/features/missions/catalog'
import { CreateMissionForm } from '@/features/missions/create-form'
import { QuickMissionForm } from '@/features/missions/quick-form'
export const metadata:Metadata = {title:'สร้างภารกิจ'}
export default async function NewMissionPage({params}: {params:Promise<{spaceId:string}>}) {
  const {spaceId} = await params
  const [{space},catalog] = await Promise.all([
    getManagerContext(spaceId), getMissionCatalog(spaceId),
  ])
  return <>
    <h2>สร้างภารกิจใหม่</h2>
    <p className="muted">เลือกสร้างอย่างรวดเร็ว หรือเปิดตัวเลือกละเอียดเมื่อต้องกำหนดเวลาและผู้รับมอบหมาย</p>
    <QuickMissionForm spaceId={spaceId} stampCards={catalog.stampCards}
      mode={space.kind === 'couple' ? 'couple' : space.kind === 'family' ? 'family' : 'personal'} />
    <details className="room-create" style={{ marginTop: 20 }}>
      <summary>ตั้งค่าภารกิจขั้นสูงและกิจกรรมแนะนำ</summary>
    <CreateMissionForm spaceId={spaceId} timezone={space.timezone}
      campaigns={catalog.campaigns} stampCards={catalog.stampCards}
      mode={space.kind === 'couple' ? 'couple' : space.kind === 'family' ? 'family' : 'personal'} />
    </details>
  </>
}
