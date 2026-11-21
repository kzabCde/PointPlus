import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadLivingBookDetail, loadLivingEditorData,loadLivingPageMedia } from '@/features/living-books/data'
import { LivingPageManager } from '@/features/living-books/page-manager'
import {LivingBookStudio} from '@/features/living-books/editor-studio'
import { LivingPaperEditor } from '@/features/living-books/paper-editor'
import { LivingCardBoard } from '@/features/living-books/card-board'
import {loadLivingRedemptionData} from '@/features/living-books/redemption-data'
import {LivingRedemptionPanel} from '@/features/living-books/redemption-panel'
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
  const {marks,requests,imageUrls,canGive}=await loadLivingPageMedia(spaceId,bookId,page.id)
  const {balance,history,candidates,associations,knownStamps}=
    await loadLivingRedemptionData(spaceId,bookId)
  const recipient=people.find(p=>p.id===book.recipient_participant_id)
  const canReview=Boolean(recipient?.user_id===context.user.id||
    (!recipient?.user_id&&['owner','admin'].includes(context.member.role)))&&
    context.user.id!==book.owner_user_id
  const owner=context.user.id===book.owner_user_id
  const isRecipient=Boolean(recipient?.user_id===context.user.id||
    (!recipient?.user_id&&recipient?.kind==='child'&&
      recipient?.guardian_user_id===context.user.id))&&!owner
  return <section className="stamp-book-page living-book-detail">
    <Link className="text-link" href={'/s/'+spaceId+'/stamp-books'}>← กลับไปการสะสม</Link>
    <header className="stamp-book-detail-head">
      <BookCover assetId={book.cover_asset_id}/>
      <div className="stamp-book-detail-head__text">
        <span className="stamp-collection-type">{book.card?'การ์ดสะสม V3':'Living Stampbook'}</span>
        <h2>{book.title}</h2>
        {book.description && <p>{book.description}</p>}
        {recipient && <p>สำหรับ {recipient.display_name}</p>}
        <p>{book.card?`เป้าหมาย ${book.card.target_count} ช่อง · รางวัล: ${book.card.reward_title}`:'ไม่มีเป้าหมายจำนวนแสตมป์ · ไม่มีการปิดสมุดอัตโนมัติ'}</p>
      </div>
    </header>
    <div className="living-book-overview" aria-label="สรุปสมุดความทรงจำ">
      <div><span>จำนวนหน้า</span><strong>{summary.page_count}</strong></div>
      <div><span>หน้าที่เพิ่มล่าสุด</span><strong>{lastPage?.page_order??1}</strong></div>
      <div><span>สถานะ</span><strong>{book.status==='active'?'เปิดใช้งาน':book.status==='paused'?'พักใช้':'เก็บถาวร'}</strong></div>
    </div>
    {book.card
      ? <LivingCardBoard spaceId={spaceId} bookId={bookId} pageId={page.id}
          target={book.card.target_count} reward={book.card.reward_title}
          marks={marks} requests={requests} canGive={canGive}
          canReview={canReview} userId={context.user.id}
          active={book.status==='active'}/>
      : <LivingBookStudio>
      <LivingPageManager spaceId={spaceId} bookId={bookId} pages={pages}
        page={page} editable={owner && book.status==='active'}/>
      <LivingPaperEditor key={page.id} spaceId={spaceId} bookId={bookId}
        page={page} initialElements={elements} editable={owner && book.status==='active'}
        initialMarks={marks} initialRequests={requests} imageUrls={imageUrls}
        canGive={canGive&&book.status==='active'} canReview={canReview&&book.status==='active'}
        userId={context.user.id} pages={pages}/>
    </LivingBookStudio>}
    <LivingRedemptionPanel spaceId={spaceId} bookId={bookId}
      balance={balance} history={history} candidates={candidates}
      associations={associations} knownStamps={knownStamps}
      canRequest={isRecipient} canFulfill={owner}
      isActive={book.status==='active'} card={book.card??undefined}/>
    {!owner && <p className="muted">คุณสามารถดูความทรงจำได้ เจ้าของสมุดเท่านั้นที่เพิ่มหน้าและแก้ไขกระดาษได้</p>}
  </section>
}
