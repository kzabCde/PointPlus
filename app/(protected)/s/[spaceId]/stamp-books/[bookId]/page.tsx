import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { randomUUID } from 'node:crypto'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { loadStampBookDetail, type BookClaim, type StampCycle } from '@/features/stamp-books/data'
import { ClaimStampRewardForm, GiveStampDialog, ReviewStampForm, ProcessBookRewardForm } from '@/features/stamp-books/forms'

export const metadata:Metadata={title:'สมุดสะสมแสตมป์'}
const art=(id:string)=>pointPlusStamps.find(s=>s.id===id)
const readable=(when:string)=>new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(when))
const claimLabels={requested:'รอส่งมอบ',fulfilled:'ส่งมอบแล้ว',canceled:'ยกเลิก'} as const

export default async function StampBookDetailPage({params}:{params:Promise<{spaceId:string;bookId:string}>}){
 const {spaceId,bookId}=await params
 const {book,context,manager,assigned,people,givers,styles,rewards,cycles,marks,claims,requests}=await loadStampBookDetail(spaceId,bookId)
 const isGiver=givers.includes(context.user.id)&&book.status==='active'
 const lookup=(id:string)=>people.find(p=>p.id===id)?.display_name??'ผู้สะสม'
 const bookPath='/s/'+spaceId+'/stamp-books'
 const [totalCompleted,waiting]=[
  cycles.filter(c=>c.completed_at!==null).length,
  claims.filter(c=>c.status==='requested').length,
 ]
 return <section className="stamp-book-page">
  <Link href={bookPath} className="text-link">← สมุดสะสมทั้งหมด</Link>
  <header className="stamp-book-detail-head">
   <div><span className="eyebrow">POINT+ · STAMP BOOK</span><h2 className="page-title">{book.title}</h2>
    <p className="muted">{book.description||'ค่อย ๆ เติมความทรงจำทีละดวง'}</p>
    <p className="muted">{book.target_count} ดวงต่อรอบ · {book.repeatable?'เริ่มรอบใหม่ได้':'ครบแล้วจบเล่ม'} · {book.status==='active'?'เปิดสะสม':book.status==='paused'?'พักสะสม':'เก็บถาวร'}</p></div>
   <div className="hero__actions">
    <GiveStampDialog spaceId={spaceId} bookId={bookId} recipients={
      people.filter(p=>(
       p.kind==='adult'||manager||p.guardian_user_id===context.user.id
      )&&assigned.some(a=>a.id===p.id) || (
       isGiver&&p.kind==='adult'
       &&p.space_id===spaceId
      ))
    } styleIds={styles} canGive={isGiver} stampKey={randomUUID()}/>
    {manager&&book.status!=='archived'&&<Link href={bookPath+'/'+bookId+'/edit'} className="button button--secondary">จัดการสมุด</Link>}
   </div>
  </header>
  <div className="stamp-book-facts">
   <span><strong>{totalCompleted}</strong> รอบที่สะสมครบ</span>
   <span><strong>{rewards.length}</strong> ตัวเลือกรางวัล</span>
   <span><strong>{waiting}</strong> รางวัลรอส่งมอบ</span>
  </div>
  {!assigned.length&&<div className="card empty-state">ยังไม่มีผู้สะสมที่คุณมีสิทธิ์ดูในสมุดเล่มนี้</div>}
  {assigned.map(person=>{
   const mine=cycles.filter(c=>c.participant_id===person.id).sort((a,b)=>b.cycle_no-a.cycle_no)
   const latest=mine[0]
   if(!latest)return null
   const completed=mine.filter(c=>c.completed_at)
   const current=mine.find(c=>!c.completed_at)??latest
   const myMarks=marks.filter(m=>m.cycle_id===current.id)
   const claimed=claims.find(c=>c.cycle_id===current.id)
   const canChoose=person.user_id===context.user.id||(person.kind==='child'&&person.guardian_user_id===context.user.id)
   return <article className="stamp-physical-book" key={person.id}>
    <div className="stamp-physical-book__heading"><span className="eyebrow">THE STAMP BOOK · {person.display_name}</span>
      <h3>{book.title}</h3><p>รอบที่ {current.cycle_no} · {current.progress_count} / {current.target_snapshot} ดวง</p>
      <progress value={current.progress_count} max={current.target_snapshot} aria-label={'จำนวนดวงสะสมของ '+person.display_name}/>
    </div>
    <div className="stamp-book-slots">
     {Array.from({length:current.target_snapshot},(_,i)=>{
      const mark=myMarks[i]
      const picture=mark?art(mark.asset_id):undefined
      return <div className={'stamp-book-slot'+(picture?' stamp-book-slot--earned':'')} key={i}
       title={mark?('รับเมื่อ '+readable(mark.stamped_at)):'ช่องที่ '+(i+1)}>
       {picture?<><Image src={picture.png} width={74} height={74} alt={picture.nameTh}/><small>{readable(mark!.stamped_at)}</small></>:
       <span aria-label={'ยังว่าง ดวงที่ '+(i+1)}>{String(i+1).padStart(2,'0')}</span>}
      </div>
     })}
    </div>
    {current.completed_at&&<div className="stamp-book-finish">
     <strong>สมุดสะสมครบแล้ว!</strong><p>สำเร็จเมื่อ {readable(current.completed_at)}</p>
     {claimed?<p>รางวัล: {claimed.reward_title_snapshot} · {claimLabels[claimed.status]}</p>:
      canChoose?<ClaimStampRewardForm spaceId={spaceId} bookId={bookId} cycleId={current.id} rewards={rewards} keyId={randomUUID()}/>:
      <p className="muted">รอให้ผู้สะสมเลือกหนึ่งรางวัล</p>}
    </div>}
    {!!completed.filter(c=>c.id!==current.id).length&&<details className="stamp-book-history">
     <summary>สมุดที่สะสมครบแล้ว ({completed.length})</summary>
     {completed.filter(c=>c.id!==current.id).map((c:StampCycle)=>{
      const past=marks.filter(m=>m.cycle_id===c.id),pastClaim=claims.find(x=>x.cycle_id===c.id)
      return <div key={c.id} className="stamp-book-history__cycle">
       <h4>รอบที่ {c.cycle_no} · {readable(c.completed_at!)}</h4>
       <div className="stamp-history-art">{past.map(mark=><Image key={mark.id}
        src={art(mark.asset_id)?.png??'/point-plus/stamps/couple/heart.png'} alt={art(mark.asset_id)?.nameTh??'แสตมป์'} width={42} height={42}/>)}</div>
       {pastClaim?<p>{pastClaim.reward_title_snapshot} · {claimLabels[pastClaim.status]}</p>:
        canChoose?<ClaimStampRewardForm spaceId={spaceId} bookId={bookId} cycleId={c.id} rewards={rewards} keyId={randomUUID()}/>:
        <p className="muted">ยังไม่ได้เลือกรางวัล</p>}
      </div>
     })}
    </details>}
   </article>
  })}
  {manager&&requests.length>0&&<section>
   <h3>คำขอแสตมป์รออนุมัติ</h3>
   {requests.filter(r=>r.giver_user_id!==context.user.id).map(r=><article className="card" key={r.id}>
    <strong>{lookup(r.participant_id)} · {art(r.asset_id)?.nameTh??'แสตมป์'}</strong>
    <p className="muted">{r.note??'ไม่มีข้อความ'} · {readable(r.created_at)}</p>
    <ReviewStampForm spaceId={spaceId} bookId={bookId} requestId={r.id}/>
   </article>)}
   {requests.every(r=>r.giver_user_id===context.user.id)&&<p className="muted">คำขอของคุณต้องให้ผู้ดูแลคนอื่นอนุมัติ</p>}
  </section>}
  {!!claims.filter(c=>c.status==='requested').length&&manager&&<section className="stamp-book-claims">
   <h3>รางวัลที่รอส่งมอบ</h3>
   {claims.filter(c=>c.status==='requested').map((c:BookClaim)=><article className="card" key={c.id}>
    <strong>{c.reward_title_snapshot}</strong>
    <p className="muted">{lookup(c.participant_id)} · ขอเมื่อ {readable(c.claimed_at)}</p>
    <ProcessBookRewardForm spaceId={spaceId} bookId={bookId} claimId={c.id}/>
   </article>)}
  </section>}
 </section>
}
