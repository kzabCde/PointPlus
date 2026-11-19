import type {Metadata} from 'next'
import Link from 'next/link'
import { loadReviewQueue } from '@/features/social/data'
import { ReviewForm } from '@/features/social/review-form'
import { PrivateEvidence } from '@/features/social/private-evidence'
import { RefreshControl } from '@/features/social/refresh-control'
export const metadata:Metadata={title:'ตรวจภารกิจ'}
export default async function ReviewsPage({params}:{
  params:Promise<{spaceId:string}>
}) {
  const {spaceId}=await params
  const {queue,space}=await loadReviewQueue(spaceId)
  const date=(value:string)=>new Intl.DateTimeFormat('th-TH',{
    dateStyle:'medium',timeStyle:'short',timeZone:space.timezone,
  }).format(new Date(value))
  return <section className="social-stack">
    <h2 className="page-title">ภารกิจรอตรวจ</h2>
    <p className="muted">เฉพาะรายการที่บัญชีของคุณมีสิทธิ์ตรวจตามกติกาพื้นที่</p>
    <RefreshControl/>
    {queue.length===0 ? <div className="card" role="status">ยังไม่มีภารกิจรอตรวจสอบ</div> :
      queue.map(({submission,participant,mission})=><article key={submission.id} className="card">
        <h3>{mission?.title??'ภารกิจ'}</h3>
        <p>ผู้ส่ง: {participant.display_name} · ส่งเมื่อ {date(submission.submitted_at)}</p>
        <p className="muted">แต้มตามรายการที่ส่ง: {submission.points_snapshot}</p>
        {submission.proof_text && <p className="social-proof">{submission.proof_text}</p>}
        {submission.proof_path && <PrivateEvidence path={submission.proof_path}/>}
        <ReviewForm spaceId={spaceId} submissionId={submission.id}/>
      </article>)}
    <Link className="text-link" href={'/s/'+spaceId+'/progress'}>ดูประวัติการทำภารกิจ</Link>
  </section>
}
