import type {Metadata} from 'next'
import Link from 'next/link'
import { loadProgress } from '@/features/social/data'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'ความคืบหน้า'}
export default async function ProgressPage({params,searchParams}:{
  params:Promise<{spaceId:string}>
  searchParams:Promise<{page?:string; participant?:string}>
}) {
  const {spaceId}=await params
  const {page,participant}=await searchParams
  const numeric=Number(page??'1')
  const current=Number.isSafeInteger(numeric)?Math.max(1,Math.min(numeric,501)):1
  const progress=await loadProgress(spaceId,(current-1)*20,participant)
  const {approved,pending,rejected}=progress.counts
  const pageHref=(next:number)=>'/s/'+spaceId+'/progress?page='+next+
    (progress.selectedParticipant?'&participant='+encodeURIComponent(progress.selectedParticipant):'')
  const date=(value:string)=>new Intl.DateTimeFormat('th-TH',{
    dateStyle:'medium',timeStyle:'short',timeZone:progress.space.timezone,
  }).format(new Date(value))
  return <section className="social-stack">
    <h2 className="page-title">ความคืบหน้าและประวัติ</h2>
    <p className="muted">ประวัติจากฐานข้อมูลตามสิทธิ์การเข้าถึงของคุณ พร้อมยอดรวมของตัวกรองปัจจุบัน</p>
    <form action={'/s/'+spaceId+'/progress'} method="get" className="card social-form">
      <label htmlFor="progress-participant">เลือกผู้เข้าร่วม</label>
      <select className="input" id="progress-participant" name="participant" defaultValue={progress.selectedParticipant??''}>
        <option value="">ทุกคนที่มีสิทธิ์ดู</option>
        {progress.participants.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
      <button className="button button--secondary" type="submit">ดูข้อมูล</button>
    </form>
    <div className="dashboard-stats">
      <div><strong>{approved}</strong><span>อนุมัติแล้ว</span></div>
      <div><strong>{pending}</strong><span>รอตรวจ</span></div>
      <div><strong>{rejected}</strong><span>ไม่อนุมัติ</span></div>
    </div>
    <RefreshControl/>
    {progress.activity.length===0 ? <div className="card" role="status">ยังไม่มีบันทึกกิจกรรมที่คุณดูได้</div> :
      <ol className="social-timeline">
        {progress.activity.map(a=><li key={a.id} className="card">
          <strong>{a.missionTitle}</strong>
          <p>{a.participantName} · {a.status==='approved'?'อนุมัติแล้ว':a.status==='rejected'?'ไม่อนุมัติ':'รอตรวจ'}</p>
          <p className="muted">{date(a.submitted_at)} · แต้มตามรายการ: {a.points_snapshot}</p>
          {a.review_note && <p>ความเห็นผู้ตรวจ: {a.review_note}</p>}
        </li>)}
      </ol>}
    <nav aria-label="หน้าประวัติ" className="hero__actions">
      {current>1 && <Link className="button button--secondary" href={pageHref(current-1)}>ก่อนหน้า</Link>}
      <span>หน้า {current}</span>
      {progress.offset+20<progress.count &&
        <Link className="button button--secondary" href={pageHref(current+1)}>ถัดไป</Link>}
    </nav>
  </section>
}
