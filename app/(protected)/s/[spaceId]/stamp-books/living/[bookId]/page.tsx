import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadLivingBookDetail, loadLivingEditorData,loadLivingPageMedia } from '@/features/living-books/data'
import { LivingPageManager } from '@/features/living-books/page-manager'
import {LivingBookStudio} from '@/features/living-books/editor-studio'
import { LivingPaperEditor } from '@/features/living-books/paper-editor'
import { LivingCardBoard } from '@/features/living-books/card-board'
import {loadLivingRedemptionOverview} from '@/features/living-books/redemption-data'
import {LivingRewardsOnDemand} from '@/features/living-books/rewards-on-demand'

export const metadata: Metadata = {title:'สมุดความทรงจำ'}

export default async function LivingBookPage({params,searchParams}:{
  params:Promise<{spaceId:string;bookId:string}>
  searchParams:Promise<{page?:string|string[]}>
}){
  const [{spaceId,bookId},{page:requestedPage}]=await Promise.all([params,searchParams])
  const [{context,book,people},{pages,page,elements}]=await Promise.all([
    loadLivingBookDetail(spaceId,bookId),
    loadLivingEditorData(spaceId,bookId,typeof requestedPage==='string'?requestedPage:undefined),
  ])
  if(book.space_id!==spaceId)notFound()
  // The ledger and lightweight header balance are independent. Do not fetch
  // reward history or stamp preview artwork until the rewards drawer opens.
  const [{marks,requests,imageUrls,canGive},{balance,pendingCount}]=await Promise.all([
    loadLivingPageMedia(spaceId,bookId,page.id,elements),
    loadLivingRedemptionOverview(spaceId,bookId),
  ])
  const recipient=people.find(p=>p.id===book.recipient_participant_id)
  const canReview=Boolean(recipient?.user_id===context.user.id||
    (!recipient?.user_id&&['owner','admin'].includes(context.member.role)))&&
    context.user.id!==book.owner_user_id
  const owner=context.user.id===book.owner_user_id
  const isRecipient=Boolean(recipient?.user_id===context.user.id||
    (!recipient?.user_id&&recipient?.kind==='child'&&
      recipient?.guardian_user_id===context.user.id))&&!owner
  return <section className="stamp-book-page living-book-detail living-book-detail--paper-first">
    <LivingBookStudio title={book.title} backHref={'/s/'+spaceId+'/stamp-books'}
      description={book.description} recipientName={recipient?.display_name}
      status={book.status} availableStamps={balance.available}
      pendingRewards={owner?pendingCount:0}
      rewardPanel={<LivingRewardsOnDemand spaceId={spaceId} bookId={bookId}
        availableStamps={balance.available} pendingRewards={pendingCount}
        canRequest={isRecipient} canFulfill={owner}
        isActive={book.status==='active'} card={book.card??undefined}/>}>
      {book.card ? <LivingCardBoard spaceId={spaceId} bookId={bookId} pageId={page.id}
          target={book.card.target_count} reward={book.card.reward_title}
          marks={marks} requests={requests} canGive={canGive}
          canReview={canReview} userId={context.user.id}
          active={book.status==='active'}/> : <>
      <LivingPageManager spaceId={spaceId} bookId={bookId} pages={pages}
        page={page} editable={owner && book.status==='active'}/>
      <LivingPaperEditor key={page.id} spaceId={spaceId} bookId={bookId}
        page={page} initialElements={elements} editable={owner && book.status==='active'}
        initialMarks={marks} initialRequests={requests} imageUrls={imageUrls}
        canGive={canGive&&book.status==='active'} canReview={canReview&&book.status==='active'}
        userId={context.user.id} pages={pages}/>
      </>}
      {!owner&&<p className="living-reader-readonly-note">
        คุณสามารถดูความทรงจำได้ เจ้าของสมุดเท่านั้นที่เพิ่มหน้าและแก้ไขกระดาษได้
      </p>}
    </LivingBookStudio>
  </section>
}
