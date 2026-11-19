import type {Metadata} from 'next'
import Link from 'next/link'
import { loadProgress } from '@/features/social/data'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'ความคืบหน้า'}
export default async function ProgressPage({params,searchParams}:{
  params:Promise<{spaceId:string}>
  searchParams:Promise<{page?:string}>
}) {
  const {spaceId}=await params
  const {page}=await searchParams
  const numeric=Number(page??'1')
  const current=Number.isSafeInteger(numeric)?Math.max(1,Math.min(numeric,501)):1
  const progress=await loadProgress(spaceId,(current-1)*20)
  const approved=progress.activity.filter(a=>a.status==='approved').length
  const pending=progress.activity.filter(a=>a.status==='submitted').length
  const rejected=progress.activity.filter(a=>a.status==='rejected').length
  const date=(value:string)=>new Intl.DateTimeFormat('th-TH',{
    dateStyle:'medium',timeStyle:'short',timeZone:progress.space.timezone,
  }).format(new Date(value))
  return <section className="social-stack">
    <h2 className="page-title">ความคืบหน้าและประวัติ</h2>
    <p className="muted">ประวัติตามสิทธิ์การเข้าถึงของคุณ นับจำนวนบนหน้านี้ ไม่ใช่สถิติสะสมทั้งหมด</p>
    <div className="dashboard-stats">
      <div><strong>{approved}</strong><span>อนุมัติ (หน้านี้)</span></div>
      <div><strong>{pending}</strong><span>รอตรวจ (หน้านี้)</span></div>
      <div><strong>{rejected}</strong><span>ไม่อนุมัติ (หน้านี้)</span></div>
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
      {current>1 && <Link className="button button--secondary" href={'/s/'+spaceId+'/progress?page='+(current-1)}>ก่อนหน้า</Link>}
      <span>หน้า {current}</span>
      {progress.offset+20<progress.count &&
        <Link className="button button--secondary" href={'/s/'+spaceId+'/progress?page='+(current+1)}>ถัดไป</Link>}
    </nav>
  </section>
}
