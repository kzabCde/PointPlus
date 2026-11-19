import type {Metadata} from 'next'
import Link from 'next/link'
import { loadMissionBoard } from '@/features/missions/data'
import { getSpaceContext,getSpaceParticipants } from '@/features/spaces/data'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'กิจกรรมร่วมกัน'}
export default async function SharedActivitiesPage({params}:{
  params:Promise<{spaceId:string}>
}) {
  const {spaceId}=await params
  const [board,context,participants]=await Promise.all([
    loadMissionBoard(spaceId,{status:'active'}),getSpaceContext(spaceId),getSpaceParticipants(spaceId),
  ])
  const missions=board.missions.filter(m=>m.status==='active')
  const missionIds=missions.map(m=>m.id)
  const [assignments,completions]=await Promise.all([
    missionIds.length?context.supabase.from('mission_assignments').select('mission_id,participant_id')
      .eq('space_id',spaceId).in('mission_id',missionIds):Promise.resolve({data:[],error:null}),
    missionIds.length?context.supabase.from('mission_submissions')
      .select('mission_id,participant_id,status').eq('space_id',spaceId)
      .eq('status','approved').in('mission_id',missionIds).limit(1000)
      :Promise.resolve({data:[],error:null}),
  ])
  if(assignments.error || completions.error) throw new Error('Cannot load shared activity')
  // RLS may hide child participation. Only aggregate participants actually visible.
  const visible=new Set(participants.map(p=>p.id))
  const assignedByMission=new Map<string,string[]>()
  for(const a of assignments.data??[]) {
    if(!visible.has(a.participant_id)) continue
    assignedByMission.set(a.mission_id,[...(assignedByMission.get(a.mission_id)??[]),a.participant_id])
  }
  const approvedByMission=new Map<string,Set<string>>()
  for(const c of completions.data??[]) {
    if(!visible.has(c.participant_id)) continue
    const set=approvedByMission.get(c.mission_id)??new Set<string>()
    set.add(c.participant_id);approvedByMission.set(c.mission_id,set)
  }
  return <section className="social-stack">
    <h2 className="page-title">กิจกรรมร่วมกัน</h2>
    <p className="muted">แต่ละคนส่งและได้รับแต้มจากภารกิจของตนเอง การแสดงผลไม่ใช่รางวัลร่วมของทั้งกลุ่ม</p>
    <RefreshControl/>
    {!missions.length? <div className="card" role="status">ยังไม่มีกิจกรรมที่มองเห็นได้</div>:
      <div className="feature-grid">{missions.map(m=>{
        const assigned=m.assignment_mode==='assigned'
          ?assignedByMission.get(m.id)??[]:participants.map(p=>p.id)
        const approved=approvedByMission.get(m.id)??new Set<string>()
        return <article className="feature-card" key={m.id}>
          <h3>{m.title}</h3>
          <p>{m.description??'กิจกรรมร่วมกันในพื้นที่ส่วนตัว'}</p>
          <p className="muted">{m.assignment_mode==='assigned'?'มอบหมายเฉพาะคน':'เปิดให้คนในพื้นที่'}</p>
          <ul>{participants.filter(p=>assigned.includes(p.id)).map(p=>
            <li key={p.id}>{p.display_name}: {approved.has(p.id)?'เคยสำเร็จแล้ว':'ยังไม่มีรายการที่อนุมัติ'}</li>)}</ul>
          <Link className="button button--secondary" href={'/s/'+spaceId+'/missions/'+m.id+
            (board.selected?'?participant='+board.selected.id:'')}>เปิดภารกิจ</Link>
        </article>
      })}</div>}
    <p className="muted">ข้อมูลสำเร็จแสดงเพียงว่ามีรายการที่ผ่านอนุมัติอย่างน้อยหนึ่งครั้ง ไม่ใช่เปอร์เซ็นต์ความคืบหน้าของรอบปัจจุบัน</p>
  </section>
}
