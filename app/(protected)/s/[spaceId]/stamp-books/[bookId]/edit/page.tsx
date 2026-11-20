import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadStampBookDetail } from '@/features/stamp-books/data'
import { EditStampBookForm,AddStampRewardForm } from '@/features/stamp-books/forms'

export const metadata:Metadata={title:'จัดการสมุดสะสม'}
export default async function EditStampBookPage({params}:{params:Promise<{spaceId:string;bookId:string}>}){
 const {spaceId,bookId}=await params
 const {book,manager,rewards}=await loadStampBookDetail(spaceId,bookId)
 if(!manager)notFound()
 const base='/s/'+spaceId+'/stamp-books/'+bookId
 return <section className="stamp-book-page">
  <Link className="text-link" href={base}>← กลับไปสมุดสะสม</Link>
  <h2 className="page-title">จัดการสมุด {book.title}</h2>
  <p className="muted">แก้ชื่อหรือพักสมุดได้ โดยไม่ลบประวัติสะสมที่มีอยู่</p>
  <EditStampBookForm spaceId={spaceId} book={book}/>
  <h3>ตัวเลือกรางวัลในสมุด</h3>
  {rewards.map(r=><article className="card" key={r.id}>
   <strong>{r.title}</strong><p className="muted">{r.description||'รางวัลส่วนตัว'}</p>
   <small className="muted">{r.active?'พร้อมให้เลือก':'ปิดใช้งาน'} · {r.stock_remaining===null?'ไม่จำกัดจำนวน':r.stock_remaining+' สิทธิ์'}</small>
  </article>)}
  {book.status!=='archived'&&<AddStampRewardForm spaceId={spaceId} bookId={bookId}/>}
 </section>
}
