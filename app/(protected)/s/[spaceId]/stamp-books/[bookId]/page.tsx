import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { randomUUID } from 'node:crypto'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { loadStampBookDetail, type BookClaim, type BookMark, type StampCycle } from '@/features/stamp-books/data'
import { BookCover, BookProgress, bookStatus } from '@/features/stamp-books/presentation'
import type { Participant } from '@/features/spaces/data'
import { ClaimStampRewardForm, ClaimCoupleMemoryForm, GiveStampDialog, ReviewStampForm, ProcessBookRewardForm } from '@/features/stamp-books/forms'

export const metadata:Metadata={title:'สมุดสะสมแสตมป์'}
const art=(id:string)=>pointPlusStamps.find(s=>s.id===id)
const readable=(when:string)=>new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(when))
const claimLabels={requested:'รอส่งมอบ',fulfilled:'ส่งมอบแล้ว',canceled:'ยกเลิก'} as const

function MarkHistory({ marks, people }: { marks: BookMark[]; people: Participant[] }) {
 return <ul className="stamp-book-mark-history">
  {marks.map(mark => <li key={mark.id}>
   <Image src={art(mark.asset_id)?.png ?? '/point-plus/stamps/couple/heart.png'} alt="" width={38} height={38}/>
   <div>
    <strong>{art(mark.asset_id)?.nameTh ?? 'แสตมป์'}</strong>
    <small>ให้โดย {people.find(person => person.user_id === mark.giver_user_id)?.display_name ?? 'สมาชิกในห้อง'} · <time dateTime={mark.stamped_at}>{readable(mark.stamped_at)}</time></small>
    {mark.note && <p>{mark.note}</p>}
   </div>
  </li>)}
 </ul>
}


export default async function StampBookDetailPage({params}:{params:Promise<{spaceId:string;bookId:string}>}){
 const {spaceId,bookId}=await params
 const {book,context,manager,assigned,giverRecipients,people,givers,styles,rewards,cycles,marks,claims,requests,ownReviews}=await loadStampBookDetail(spaceId,bookId)
 const isGiver=(givers.includes(context.user.id)||(context.space.kind==='couple'&&book.created_by===context.user.id))&&book.status==='active'
 const lookup=(id:string)=>people.find(p=>p.id===id)?.display_name??'ผู้สะสม'
 const bookPath='/s/'+spaceId+'/stamp-books'
 return <section className="stamp-book-page">
  <Link href={bookPath} className="text-link">← สมุดสะสมทั้งหมด</Link>
  <header className="stamp-book-detail-head">
   <BookCover assetId={book.cover_asset_id} eager/>
   <div>
    <span className="book-status" data-status={book.status}>{bookStatus[book.status]}</span>
    <h2 className="page-title">{book.title}</h2>
    {book.description && <p>{book.description}</p>}
    <p className="muted">{book.target_count} ดวงต่อรอบ · {book.repeatable ? 'สะสมได้หลายรอบ' : 'สะสมรอบเดียว'}</p>
   </div>
   <div className="hero__actions">
    <GiveStampDialog spaceId={spaceId} bookId={bookId} recipients={giverRecipients} styleIds={styles} canGive={isGiver} stampKey={randomUUID()}/>
    {manager&&book.status!=='archived'&&<Link href={bookPath+'/'+bookId+'/edit'} className="button button--secondary">จัดการสมุด</Link>}
   </div>
  </header>
  {!assigned.length&&<div className="card empty-state">ยังไม่มีผู้สะสมที่คุณมีสิทธิ์ดูในสมุดเล่มนี้</div>}
  {assigned.map(person=>{
   const mine=cycles.filter(c=>c.participant_id===person.id).sort((a,b)=>b.cycle_no-a.cycle_no)
   const latest=mine[0]
   if(!latest)return null
   const completed=mine.filter(c=>c.completed_at)
   const current=context.space.kind==='couple'
    ? (mine.find(c=>c.completed_at&&!claims.some(cl=>cl.cycle_id===c.id))
      ??mine.find(c=>c.completed_at)??latest)
    : (mine.find(c=>!c.completed_at)??latest)
   const myMarks=marks.filter(m=>m.cycle_id===current.id)
   const claimed=claims.find(c=>c.cycle_id===current.id)
   const canChoose=!person.archived_at&&(person.user_id===context.user.id||(person.kind==='child'&&person.guardian_user_id===context.user.id))
   return <article className="stamp-physical-book" key={person.id}>
    <div className="stamp-physical-book__heading">
     <h3>{person.display_name}</h3>
     <p>รอบที่ {current.cycle_no} · {current.completed_at ? 'สะสมครบ' : bookStatus[book.status]}</p>
     <BookProgress label={person.display_name} cycle={current} showLabel={false}/>
    </div>
    <div className="stamp-book-slots">
     {Array.from({length:current.target_snapshot},(_,i)=>{
      const mark=myMarks[i]
      const picture=mark ? art(mark.asset_id) : undefined
      return <div className={'stamp-book-slot'+(mark?' stamp-book-slot--earned':'')} key={i}>
       {picture ? <Image src={picture.png} width={74} height={74} alt={picture.nameTh}/>
         : <span role="img" aria-label={mark ? 'ได้รับแสตมป์' : i < current.progress_count ? 'ได้รับแล้ว รายละเอียดไม่พร้อมแสดง' : 'ช่องว่างที่ '+(i+1)}>
          {mark || i < current.progress_count ? '✓' : i + 1}
         </span>}
      </div>
     })}
    </div>
    {!!myMarks.length && <details className="stamp-book-history">
     <summary>รายละเอียดแสตมป์ ({myMarks.length})</summary>
     <MarkHistory marks={myMarks} people={people}/>
    </details>}
    {current.completed_at&&<div className="stamp-book-finish">
     <strong>{book.status==='archived'?'ความทรงจำที่เก็บไว้ด้วยกัน':'สมุดสะสมครบแล้ว!'}</strong><p>สะสมครบเมื่อ {readable(current.completed_at)}</p>
     {claimed?<p>รางวัล: {claimed.reward_title_snapshot} · {claimLabels[claimed.status]}</p>:
      canChoose&&book.status==='active' ? (context.space.kind==='couple'
       ? <ClaimCoupleMemoryForm spaceId={spaceId} bookId={bookId} cycleId={current.id} keyId={randomUUID()}/>
       : <ClaimStampRewardForm spaceId={spaceId} bookId={bookId} cycleId={current.id} rewards={rewards} keyId={randomUUID()}/>):
      <p className="muted">{book.status === 'active' && !person.archived_at ? 'รอให้ผู้สะสมเลือกหนึ่งรางวัล' : 'ยังไม่มีคำขอรางวัลในรอบนี้'}</p>}
    </div>}
    {!!completed.filter(c=>c.id!==current.id).length&&<details className="stamp-book-history">
     <summary>สมุดที่สะสมครบแล้ว ({completed.length})</summary>
     {completed.filter(c=>c.id!==current.id).map((c:StampCycle)=>{
      const past=marks.filter(m=>m.cycle_id===c.id),pastClaim=claims.find(x=>x.cycle_id===c.id)
      return <div key={c.id} className="stamp-book-history__cycle">
       <h4>รอบที่ {c.cycle_no} · {readable(c.completed_at!)}</h4>
       <p>{c.progress_count} / {c.target_snapshot} ดวง</p>
       {past.length > 0 && <details className="stamp-book-history">
        <summary>รายละเอียดแสตมป์ ({past.length})</summary>
        <MarkHistory marks={past} people={people}/>
       </details>}
       {pastClaim?<p>{pastClaim.reward_title_snapshot} · {claimLabels[pastClaim.status]}</p>:
        canChoose&&book.status==='active' ? (context.space.kind==='couple'
         ? <ClaimCoupleMemoryForm spaceId={spaceId} bookId={bookId} cycleId={c.id} keyId={randomUUID()}/>
         : <ClaimStampRewardForm spaceId={spaceId} bookId={bookId} cycleId={c.id} rewards={rewards} keyId={randomUUID()}/>):
        <p className="muted">ยังไม่ได้เลือกรางวัล</p>}
      </div>
     })}
    </details>}
   </article>
  })}
  {(requests.length > 0 || ownReviews.length > 0) && <section className="stamp-book-claims">
   <h3>คำขอแสตมป์</h3>
   {requests.map(request => <article className="card" key={request.id}>
    <span className="status status--warning">รออนุมัติ</span>
    <p><strong>{lookup(request.participant_id)} · {art(request.asset_id)?.nameTh ?? 'แสตมป์'}</strong></p>
    <p className="muted">{readable(request.created_at)}</p>
    {request.note && <p>{request.note}</p>}
    {manager && request.giver_user_id !== context.user.id &&
     <ReviewStampForm spaceId={spaceId} bookId={bookId} requestId={request.id}/>}
   </article>)}
   {ownReviews.length > 0 && <details className="stamp-book-history">
    <summary>คำขอที่ถูกปฏิเสธล่าสุด</summary>
    <ul>{ownReviews.map(request => <li key={request.id}>
     {lookup(request.participant_id)} · {art(request.asset_id)?.nameTh ?? 'แสตมป์'} · {readable(request.created_at)}
    </li>)}</ul>
   </details>}
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
