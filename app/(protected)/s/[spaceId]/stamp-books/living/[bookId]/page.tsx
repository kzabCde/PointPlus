import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadLivingBookDetail } from '@/features/living-books/data'
import { AddLivingBookPageForm } from '@/features/living-books/forms'
import { BookCover } from '@/features/stamp-books/presentation'

export const metadata: Metadata = {title:'Living Stampbook — สมุดความทรงจำ'}

export default async function LivingBookPage({params}:{
  params:Promise<{spaceId:string;bookId:string}>
}){
  const {spaceId,bookId}=await params
  const {context,book,summary,lastPage,people}=await loadLivingBookDetail(spaceId,bookId)
  if(book.space_id!==spaceId)notFound()
  const recipient=people.find(p=>p.id===book.recipient_participant_id)
  const owner=context.user.id===book.owner_user_id
  return <section className="stamp-book-page living-book-detail">
    <Link className="text-link" href={'/s/'+spaceId+'/stamp-books'}>← กลับไปการสะสม</Link>
    <header className="stamp-book-detail-head">
      <BookCover assetId={book.cover_asset_id}/>
      <div className="stamp-book-detail-head__text">
        <span className="stamp-collection-type">Living Stampbook</span>
        <h2>{book.title}</h2>
        {book.description && <p>{book.description}</p>}
        {recipient && <p>สำหรับ {recipient.display_name}</p>}
        <p>ไม่มีเป้าหมายจำนวนแสตมป์ · ไม่มีการปิดสมุดอัตโนมัติ</p>
      </div>
    </header>
    <div className="living-book-overview" aria-label="สรุปสมุดความทรงจำ">
      <div><span>จำนวนหน้า</span><strong>{summary.page_count}</strong></div>
      <div><span>หน้าที่เพิ่มล่าสุด</span><strong>{lastPage?.page_order??1}</strong></div>
      <div><span>สถานะ</span><strong>{book.status==='active'?'เปิดใช้งาน':book.status==='paused'?'พักใช้':'เก็บถาวร'}</strong></div>
    </div>
    <section className="living-paper-preview" data-background={lastPage?.background_style??'cream'}
      aria-label="กระดาษหน้าล่าสุด">
      <span className="living-paper-preview__number">หน้า {lastPage?.page_order??1}</span>
      <h3>{lastPage?.title||'หน้ากระดาษแห่งความทรงจำ'}</h3>
      <p>สมุดเล่มนี้พร้อมสำหรับการตกแต่งบนกระดาษใน M02 และแสตมป์อิสระใน M03</p>
    </section>
    {owner && book.status==='active' && <section className="card living-book-owner-tools">
      <h3>เพิ่มหน้ากระดาษ</h3>
      <p className="muted">หน้าใหม่จะไม่เกิดขึ้นเอง เจ้าของสมุดเพิ่มได้ตามต้องการ</p>
      <AddLivingBookPageForm spaceId={spaceId} bookId={bookId}/>
    </section>}
    {!owner && <p className="muted">คุณสามารถเปิดดูสมุดได้ การเพิ่มหน้าเป็นสิทธิ์ของผู้สร้างสมุด</p>}
  </section>
}
