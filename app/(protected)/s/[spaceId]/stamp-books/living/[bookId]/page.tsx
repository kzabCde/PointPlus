import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {loadLivingBookDetail,loadLivingEditorData,loadLivingPageMedia} from '@/features/living-books/data'
import {loadLivingReadPage} from '@/features/living-books/reader-data'
import {LivingReadOnlyPage} from '@/features/living-books/read-only-page'
import {LivingReaderRewards} from '@/features/living-books/read-rewards'
import {loadLivingRedemptionOverview} from '@/features/living-books/redemption-data'

export const metadata:Metadata={title:'สมุดความทรงจำ'}

export default async function LivingBookPage({params,searchParams}:{
  params:Promise<{spaceId:string;bookId:string}>
  searchParams:Promise<{page?:string|string[];mode?:string|string[]}>
}){
  const [{spaceId,bookId},{page:requestedPage,mode}]=await Promise.all([params,searchParams])
  const requested=typeof requestedPage==='string'?requestedPage:undefined

  // Reading is default. The full editor code is dynamically imported ONLY
  // when a user deliberately enters ?mode=edit.
  if(mode!=='edit'){
    const [{context,book,people},{page,elements,previous,next,pageNumber,pageCount},
      {balance,pendingCount}]=await Promise.all([
      loadLivingBookDetail(spaceId,bookId),
      loadLivingReadPage(spaceId,bookId,requested),
      loadLivingRedemptionOverview(spaceId,bookId),
    ])
    if(book.space_id!==spaceId)notFound()
    const {marks,requests,imageUrls,canGive}=await loadLivingPageMedia(
      spaceId,bookId,page.id,elements)
    const recipient=people.find(p=>p.id===book.recipient_participant_id)
    const owner=context.user.id===book.owner_user_id
    const canReview=Boolean(recipient?.user_id===context.user.id||
      (!recipient?.user_id&&['owner','admin'].includes(context.member.role)))&&!owner
    const isRecipient=Boolean(recipient?.user_id===context.user.id||
      (!recipient?.user_id&&recipient?.kind==='child'&&
        recipient?.guardian_user_id===context.user.id))&&!owner
    const base='/s/'+spaceId+'/stamp-books/living/'+bookId
    const canUseWorkspace=book.status==='active'&&(owner||canReview||canGive)
    return <section className="stamp-book-page living-book-detail living-reading-page">
      <header className="living-reading-header">
        <Link className="living-reader-back" href={'/s/'+spaceId+'/stamp-books'}
          aria-label="กลับไปหน้ารวมสมุด">←</Link>
        <div className="living-reading-title">
          <small>POINT+ / OUR STORY</small>
          <h1>{book.title}</h1>
          {recipient&&<p>สำหรับ {recipient.display_name}</p>}
        </div>
        {canUseWorkspace&&<Link className="button button--secondary"
          prefetch={false} href={base+'?mode=edit&page='+page.id}>
          {owner&&!book.card?'ตกแต่งสมุด':'จัดการแสตมป์'}
        </Link>}
      </header>
      {book.status!=='active'&&<p className="living-reader-status" role="status">
        {book.status==='paused'?'สมุดพักใช้งานชั่วคราว':'สมุดเก็บเป็นความทรงจำแล้ว'}
      </p>}
      <LivingReaderRewards spaceId={spaceId} bookId={bookId}
        availableStamps={balance.available} pendingRewards={pendingCount}
        canRequest={isRecipient} canFulfill={owner}
        isActive={book.status==='active'} card={book.card}/>
      <LivingReadOnlyPage spaceId={spaceId} bookId={bookId}
        page={page} elements={elements} marks={marks} requests={requests}
        imageUrls={imageUrls} card={book.card??null} previous={previous}
        next={next} pageNumber={pageNumber} pageCount={pageCount}/>
    </section>
  }

  // Preserve the original editor, cards, approval tools, manual paper Save and
  // reward modal, but avoid loading these client bundles in ordinary read mode.
  const [
    {LivingPageManager},{LivingBookStudio},{LivingPaperEditor},
    {LivingCardBoard},{LivingRewardsOnDemand},
  ]=await Promise.all([
    import('@/features/living-books/page-manager'),
    import('@/features/living-books/editor-studio'),
    import('@/features/living-books/paper-editor'),
    import('@/features/living-books/card-board'),
    import('@/features/living-books/rewards-on-demand'),
  ])
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
