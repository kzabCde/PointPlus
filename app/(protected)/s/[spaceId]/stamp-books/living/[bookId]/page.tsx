import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadLivingBookDetail, loadLivingEditorData } from '@/features/living-books/data'
import { LivingPageManager } from '@/features/living-books/page-manager'
import { LivingPaperEditor } from '@/features/living-books/paper-editor'
import { BookCover } from '@/features/stamp-books/presentation'

export const metadata: Metadata = {title:'Living Stampbook — สมุดความทรงจำ'}

export default async function LivingBookPage({params,searchParams}:{
  params:Promise<{spaceId:string;bookId:string}>
  searchParams:Promise<{page?:string|string[]}>
}){
  const [{spaceId,bookId},{page:requestedPage}]=await Promise.all([params,searchParams])
  const [{context,book,summary,lastPage,people},{pages,page,elements}]=await Promise.all([
    loadLivingBookDetail(spaceId,bookId),
    loadLivingEditorData(spaceId,bookId,typeof requestedPage==='string'?requestedPage:undefined),
  ])
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
    <div className="living-workspace">
      <LivingPageManager spaceId={spaceId} bookId={bookId} pages={pages}
        page={page} editable={owner && book.status==='active'}/>
      <LivingPaperEditor key={page.id} spaceId={spaceId} bookId={bookId}
        page={page} initialElements={elements} editable={owner && book.status==='active'}/>
    </div>
    {!owner && <p className="muted">คุณสามารถดูความทรงจำได้ เจ้าของสมุดเท่านั้นที่เพิ่มหน้าและแก้ไขกระดาษได้</p>}
  </section>
}
