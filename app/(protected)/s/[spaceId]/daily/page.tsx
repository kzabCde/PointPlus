import type {Metadata} from 'next'
import Link from 'next/link'
import { loadMissionBoard } from '@/features/missions/data'
import { missionAvailability, availabilityLabels, type Submission } from '@/features/social/data'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'กิจกรรมวันนี้'}
export default async function DailyPage({params}:{
  params:Promise<{spaceId:string}>
}) {
  const {spaceId}=await params
  const board=await loadMissionBoard(spaceId,{status:'active',frequency:'daily'})
  const missions=board.missions.filter(m=>m.frequency==='daily')
  const ids=missions.map(m=>m.id)
  const { supabase }=await import('@/features/spaces/data').then(m=>m.getSpaceContext(spaceId))
  const {data,error}=ids.length && board.selected
    ? await supabase.from('mission_submissions')
      .select('id,space_id,mission_id,participant_id,occurrence_key,proof_text,proof_path,status,points_snapshot,created_by,reviewed_by,review_note,submitted_at,reviewed_at')
      .eq('space_id',spaceId).eq('participant_id',board.selected.id)
      .in('mission_id',ids).order('submitted_at',{ascending:false}).limit(500)
    : {data:[],error:null}
  if(error) throw new Error('Cannot load daily activity')
  const submissions=(data??[]) as Submission[]
  return <section className="social-stack">
    <h2 className="page-title">ช่วงเวลาดี ๆ วันนี้</h2>
    <p className="muted">กิจกรรมที่ตั้งความถี่รายวันไว้จริงในพื้นที่ {board.space.name} · ใช้เขตเวลา {board.space.timezone}</p>
    <RefreshControl/>
    {!board.selected || missions.length===0 ? <div className="card" role="status">ยังไม่มีกิจกรรมรายวันสำหรับผู้เข้าร่วมนี้</div> :
      <div className="feature-grid">{missions.map(m=>{
        const current=missionAvailability(m,submissions.filter(s=>s.mission_id===m.id),board.space.timezone)
        return <article key={m.id} className="feature-card">
          <h3>{m.title}</h3>
          <p>{m.description??'กิจกรรมที่ทำด้วยความตั้งใจ'}</p>
          <p className="muted">{availabilityLabels[current]}</p>
          <Link href={'/s/'+spaceId+'/missions/'+m.id+'?participant='+board.selected!.id}
            className="button button--secondary">ดูและส่งภารกิจ</Link>
        </article>
      })}</div>}
    <p className="muted">ไม่มีการให้แต้มสำหรับการเข้าแอปหรือการกดเช็กอินเฉย ๆ</p>
  </section>
}
