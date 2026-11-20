import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { randomUUID } from 'node:crypto'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import { loadStampBookDetail } from '@/features/stamp-books/data'
import { ClaimStampRewardForm, ClaimCoupleMemoryForm, ReviewStampForm, ProcessBookRewardForm, GiveStampDialog } from '@/features/stamp-books/forms'
import { StampBookJournal } from '@/features/stamp-books/journal'
import { activityKey, type JournalCycle } from '@/features/stamp-books/journal-model'
import { BookMotionProvider } from '@/features/stamp-books/motion'
import { BookSoundControls, BookSoundProvider } from '@/features/stamp-books/sound'
import { BookCover, bookStatus } from '@/features/stamp-books/presentation'

export const metadata: Metadata = { title: 'สมุดสะสมแสตมป์' }
const artName = (id: string) => pointPlusStamps.find(stamp => stamp.id === id)?.nameTh ?? 'แสตมป์'

export default async function StampBookDetailPage({ params }: { params: Promise<{ spaceId: string; bookId: string }> }) {
  const { spaceId, bookId } = await params
  const {
    book, context, manager, assigned, giverRecipients, people, givers, styles, rewards, cycles, marks, claims, requests, ownReviews,
  } = await loadStampBookDetail(spaceId, bookId)
  const isCouple = context.space.kind === 'couple'
  const isGiver = (givers.includes(context.user.id) || (isCouple && book.created_by === context.user.id)) &&
    book.status === 'active'
  const names = new Map(people.map(person => [person.id, person.display_name]))
  const giverNames = new Map(people.filter(person => person.user_id).map(person => [person.user_id, person.display_name]))
  const bookPath = '/s/' + spaceId + '/stamp-books'
  const timeZone = 'Asia/Bangkok'
  const formatter = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone })
  const readable = (date: string) => formatter.format(new Date(date))

  const cyclesByPerson = Map.groupBy(cycles, cycle => cycle.participant_id)
  const marksByCycle = Map.groupBy(marks, mark => mark.cycle_id)
  const claimsByCycle = new Map(claims.map(claim => [claim.cycle_id, claim]))
  const confirmed: string[] = []

  const journals = assigned.flatMap(person => {
    const personCycles = (cyclesByPerson.get(person.id) ?? []).sort((a, b) => b.cycle_no - a.cycle_no)
    if (!personCycles.length) return []
    const initial = isCouple
      ? personCycles.find(cycle => cycle.completed_at && !claimsByCycle.has(cycle.id)) ??
        personCycles.find(cycle => cycle.completed_at) ?? personCycles[0]
      : personCycles.find(cycle => !cycle.completed_at) ?? personCycles[0]
    const canChoose = !person.archived_at && (person.user_id === context.user.id ||
      (person.kind === 'child' && person.guardian_user_id === context.user.id))
    const rewardContent: Record<string, ReactNode> = {}

    const journalCycles: JournalCycle[] = personCycles.map(cycle => {
      const claim = claimsByCycle.get(cycle.id)
      const storedMarks = (marksByCycle.get(cycle.id) ?? []).map(mark => {
        if (mark.request_id) confirmed.push(activityKey({ kind: 'stamp', id: mark.request_id }))
        return {
          id: mark.id, request_id: mark.request_id, asset_id: mark.asset_id, stamped_at: mark.stamped_at, note: mark.note,
          page_index: mark.page_index, position_x: mark.position_x, position_y: mark.position_y, rotation_deg: mark.rotation_deg, scale_factor: mark.scale_factor,
          giver: giverNames.get(mark.giver_user_id) ?? 'สมาชิกในห้อง', date: readable(mark.stamped_at),
        }
      })

      if (claim) {
        // A retry may return an existing claim, including one already fulfilled or canceled.
        confirmed.push(activityKey({ kind: 'requested', id: cycle.id }))
        if (claim.status === 'fulfilled') confirmed.push(activityKey({ kind: 'fulfilled', id: claim.id }))
      } else if (cycle.completed_at) {
        rewardContent[cycle.id] = canChoose && book.status === 'active'
          ? isCouple
            ? <ClaimCoupleMemoryForm spaceId={spaceId} bookId={bookId} cycleId={cycle.id} keyId={randomUUID()}/>
            : <ClaimStampRewardForm spaceId={spaceId} bookId={bookId} cycleId={cycle.id} rewards={rewards} keyId={randomUUID()}/>
          : <p className="muted">{book.status === 'active' && !person.archived_at
            ? 'รอให้ผู้สะสมเลือกรางวัล' : 'ยังไม่มีคำขอรางวัลในรอบนี้'}</p>
      }

      return {
        id: cycle.id, cycle_no: cycle.cycle_no, target_snapshot: cycle.target_snapshot,
        progress_count: cycle.progress_count, completed_at: cycle.completed_at,
        completedDate: cycle.completed_at ? readable(cycle.completed_at) : undefined,
        marks: storedMarks,
        claim: claim ? { id: claim.id, status: claim.status, reward_title_snapshot: claim.reward_title_snapshot } : undefined,
      }
    })

    return [{ person, journalCycles, initialCycleId: initial.id, rewardContent }]
  })
  const pendingClaims = manager ? claims.filter(claim => claim.status === 'requested') : []

  return <BookSoundProvider><BookMotionProvider key={bookId} confirmed={confirmed}>
    <section className="stamp-book-page">
      <header className="stamp-book-detail-head">
        <BookCover assetId={book.cover_asset_id} eager/>
        <div className="stamp-book-detail-head__text">
          <span className="book-status" data-status={book.status}>{bookStatus[book.status]}</span>
          <span className="stamp-collection-type">{book.layout_mode === 'stamp_card' ? 'การ์ดสะสม' : 'สมุดแสตมป์'}</span>
          <h2 className="page-title">{book.title}</h2>
          {book.description && <p>{book.description}</p>}
          <p className="muted">{book.target_count} ดวงต่อรอบ · {book.repeatable ? 'สะสมได้หลายรอบ' : 'สะสมรอบเดียว'}</p>
        </div>
        <div className="hero__actions">
          <BookSoundControls/>
          {book.layout_mode === 'stamp_card' && <GiveStampDialog
            spaceId={spaceId} bookId={bookId} recipients={giverRecipients}
            styleIds={styles} canGive={isGiver} stampKey={randomUUID()}
            requiresApproval={book.approval_policy === 'approval_required'}/>}
          {book.status === 'archived' && <Link href={bookPath + '?view=archive'}
            className="button button--secondary">กลับไปสมุดเก็บถาวร</Link>}
          
          {manager && book.status !== 'archived' && <Link href={bookPath + '/' + bookId + '/edit'}
            className="button button--secondary">จัดการสมุด</Link>}
        </div>
      </header>

      {journals.length === 0 && <div className="card empty-state">ยังไม่มีหน้าสะสมที่คุณเปิดดูได้</div>}
      {journals.map(({ person, journalCycles, initialCycleId, rewardContent }, index) =>
        <StampBookJournal key={person.id} label={person.display_name} status={bookStatus[book.status]} cycles={journalCycles}
          initialCycleId={initialCycleId} rewardContent={rewardContent} openOnMount={index === 0}
          spaceId={spaceId} bookId={bookId} participantId={person.id} styleIds={styles}
          pendingRequests={requests.filter(request => request.participant_id === person.id)}
          layoutMode={book.layout_mode} canGive={isGiver && giverRecipients.some(recipient => recipient.id === person.id)}/>)}

      {(requests.length > 0 || ownReviews.length > 0) && <section className="stamp-book-claims">
        <h3>คำขอแสตมป์</h3>
        {requests.map(request => <article className="card" key={request.id}>
          <span className="status status--warning">รออนุมัติ</span>
          <p><strong>{names.get(request.participant_id) ?? 'ผู้สะสม'} · {artName(request.asset_id)}</strong></p>
          <p className="muted">{readable(request.created_at)}</p>
          {request.note && <p>{request.note}</p>}
          {manager && request.giver_user_id !== context.user.id &&
            <ReviewStampForm spaceId={spaceId} bookId={bookId} requestId={request.id}/>}
        </article>)}
        {ownReviews.length > 0 && <details className="stamp-book-history">
          <summary>คำขอที่ถูกปฏิเสธล่าสุด</summary>
          <ul>{ownReviews.map(request => <li key={request.id}>
            {names.get(request.participant_id) ?? 'ผู้สะสม'} · {artName(request.asset_id)} · {readable(request.created_at)}
          </li>)}</ul>
        </details>}
      </section>}

      {pendingClaims.length > 0 && <section className="stamp-book-claims">
        <h3>รางวัลที่รอส่งมอบ</h3>
        {pendingClaims.map(claim => <article className="card" key={claim.id}>
          <strong>{claim.reward_title_snapshot}</strong>
          <p className="muted">{names.get(claim.participant_id) ?? 'ผู้สะสม'} · ขอเมื่อ {readable(claim.claimed_at)}</p>
          <ProcessBookRewardForm spaceId={spaceId} bookId={bookId} claimId={claim.id}/>
        </article>)}
      </section>}
    </section>
  </BookMotionProvider></BookSoundProvider>
}
