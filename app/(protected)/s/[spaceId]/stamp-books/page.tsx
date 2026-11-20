import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import './stamp-books.css'

export const metadata:Metadata={title:'สมุดสะสมแสตมป์'}

export default async function StampBooksPage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 const {context,books,cycles,eligible}=await loadStampBookBoard(spaceId)
 const manager=context.space.kind==='couple'||canManage(context.member.role)
 const active=books.filter(b=>b.status!=='archived')
 const archived=books.filter(b=>b.status==='archived')
 const url='/s/'+spaceId+'/stamp-books'
 const cover=(id:string|null)=>pointPlusStamps.find(s=>s.id===id)?.png??'/point-plus/stamps/couple/heart.png'
 const progress=(id:string)=>{
  const currentByRecipient=eligible.flatMap(person=>{
   const latest=cycles.filter(c=>c.book_id===id&&c.participant_id===person.id)
     .sort((a,b)=>b.cycle_no-a.cycle_no)[0]
   return latest?[person.display_name+' '+latest.progress_count+'/'+latest.target_snapshot]:[]
  })
  return currentByRecipient.join(' · ') || 'ยังไม่มีการสะสม'
 }
 return <section className="stamp-book-page">
  <header className="stamp-book-hero">
   <span className="eyebrow">POINT+ · STAMP BOOKS</span>
   <h2>สมุดสะสมของเรา</h2>
   <p>เติมแสตมป์ทีละดวง เก็บความทรงจำ และเลือกรางวัลที่ตกลงกันเมื่อครบเล่ม</p>
   <div className="hero__actions">
    {manager&&<Link href={url+'/new'} className="button button--primary">+ สร้างสมุดใหม่</Link>}
    <Link href={'/s/'+spaceId+'/members'} className="button button--secondary">สมาชิกในห้อง</Link>
   </div>
  </header>
  <div className="stamp-book-section-head"><h3>สมุดที่กำลังสะสม</h3><span>{active.length} เล่ม</span></div>
  {!active.length&&<div className="card empty-state">
   <h3>ยังไม่มีสมุดสะสม</h3>
   <p>ตั้งชื่อสมุด เลือกผู้รับและลายแสตมป์ทั้ง 18 แบบ แล้วเพิ่มรางวัลที่อยากให้กัน</p>
   {manager&&<Link className="button button--primary" href={url+'/new'}>สร้างสมุดเล่มแรก</Link>}
  </div>}
  <div className="stamp-book-library">
   {active.map(b=><Link href={url+'/'+b.id} className="stamp-book-cover" key={b.id}>
    <div className="stamp-book-cover__header"><Image src={cover(b.cover_asset_id)} width={68} height={68} alt=""/><span>{b.status==='paused'?'พักสะสม':'กำลังสะสม'}</span></div>
    <h3>{b.title}</h3><p>{b.description||'เรื่องดี ๆ ที่สะสมร่วมกัน'}</p>
    <div className="stamp-book-cover__footer"><strong>{progress(b.id)}</strong><span>ความคืบหน้า</span></div>
   </Link>)}
  </div>
  {!!archived.length&&<details className="stamp-book-archive">
   <summary>สมุดเก็บถาวร ({archived.length})</summary>
   <div className="stamp-book-library">{archived.map(b=><Link className="stamp-book-cover stamp-book-cover--archive" href={url+'/'+b.id} key={b.id}>
    <Image src={cover(b.cover_asset_id)} width={54} height={54} alt=""/><h3>{b.title}</h3><p>ดูประวัติสะสมและรางวัล</p>
   </Link>)}</div>
  </details>}
  {!!eligible.length&&<p className="muted">{context.space.kind==='couple'?'คู่รักทั้งสองคนดูความคืบหน้าของกันและกันได้': 'ความคืบหน้าจะแสดงเฉพาะผู้สะสมที่บัญชีของคุณได้รับอนุญาตให้ดู'}</p>}
 </section>
}
