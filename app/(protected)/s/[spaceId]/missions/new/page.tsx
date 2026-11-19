import type { Metadata } from 'next'
import { getManagerContext, getMissionCatalog } from '@/features/missions/catalog'
import { CreateMissionForm } from '@/features/missions/create-form'
export const metadata:Metadata = {title:'สร้างภารกิจ'}
export default async function NewMissionPage({params}: {params:Promise<{spaceId:string}>}) {
  const {spaceId} = await params
  const [{space},catalog] = await Promise.all([
    getManagerContext(spaceId), getMissionCatalog(spaceId),
  ])
  return <>
    <h2>สร้างภารกิจใหม่</h2>
    <p className="muted">กำหนดกิจกรรมที่อยากทำให้สำเร็จในพื้นที่นี้</p>
    <CreateMissionForm spaceId={spaceId} timezone={space.timezone}
      campaigns={catalog.campaigns} stampCards={catalog.stampCards}
      mode={space.kind === 'couple' ? 'couple' : space.kind === 'family' ? 'family' : 'personal'} />
  </>
}
