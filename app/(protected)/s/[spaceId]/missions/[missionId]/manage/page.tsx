import Link from 'next/link'
import type { Metadata } from 'next'
import { getManagedMission, getMissionAssignments } from '@/features/missions/management'
import { getMissionCatalog } from '@/features/missions/catalog'
import { getSpaceParticipants } from '@/features/spaces/data'
import { MissionEditor } from '@/features/missions/mission-editor'
import { AssignmentControls } from '@/features/missions/assignment-controls'
import { StatusControls } from '@/features/missions/status-controls'

export const metadata:Metadata={title:'จัดการภารกิจ'}
export default async function ManageMissionPage({params}:{
  params:Promise<{spaceId:string;missionId:string}>
}) {
  const {spaceId,missionId}=await params
  const [{space,mission},catalog,assignments,participants]=await Promise.all([
    getManagedMission(spaceId,missionId),getMissionCatalog(spaceId),
    getMissionAssignments(spaceId,missionId),getSpaceParticipants(spaceId),
  ])
  return <>
    <div className="space-header"><h2>จัดการ: {mission.title}</h2>
      <Link className="button button--secondary" href={'/s/'+spaceId+'/missions/'+missionId}>ดูรายละเอียด</Link></div>
    {mission.status!=='archived' &&
      <MissionEditor mission={mission} spaceId={spaceId} timezone={space.timezone}
        campaigns={catalog.campaigns} stampCards={catalog.stampCards}/>}
    <div className="feature-rows">
      <AssignmentControls spaceId={spaceId} missionId={missionId}
        participants={participants} assignments={assignments} readonly={mission.status==='archived'}/>
      <StatusControls mission={mission} spaceId={spaceId}/>
    </div>
    <p className="muted">การแก้ไขผู้รับมอบหมายจะไม่ลบผลการส่งงานหรือเปลี่ยนประวัติการอนุมัติเดิม</p>
  </>
}
