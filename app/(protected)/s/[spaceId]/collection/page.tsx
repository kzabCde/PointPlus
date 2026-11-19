import type { Metadata } from 'next'
import Image from 'next/image'
import { getSpaceContext, getSpaceParticipants, canManage } from '@/features/spaces/data'
import { pointPlusBadges, pointPlusStamps, type PointPlusMode } from '@/lib/point-plus/assets'

export const metadata: Metadata = { title: 'สมุดสะสม' }

export default async function CollectionPage({ params, searchParams }: {
  params: Promise<{ spaceId: string }>
  searchParams: Promise<{ participant?: string }>
}) {
  const { spaceId } = await params
  const { participant: requested } = await searchParams
  const [{ space, user, member, supabase }, all] = await Promise.all([
    getSpaceContext(spaceId), getSpaceParticipants(spaceId),
  ])
  // Member/guardian-specific view: never use a client-chosen participant without
  // checking actual Room membership and guardian eligibility first.
  const eligible = all.filter(p =>
    canManage(member.role) || p.user_id === user.id ||
    (p.kind === 'child' && p.guardian_user_id === user.id))
  const selected = eligible.find(p => p.id === requested)
    ?? eligible.find(p => p.user_id === user.id)
    ?? eligible[0] ?? null
  const mode: PointPlusMode = space.kind === 'couple' ? 'couple' :
    space.kind === 'family' ? 'family' : 'personal'
  const stamps = pointPlusStamps.filter(item => item.mode === mode)
  const badges = pointPlusBadges.filter(item => item.mode === mode)
  const [cardResult, badgeResult, cycleResult, earnedResult] = await Promise.all([
    supabase.from('stamp_cards').select('id,image_key,title,target_count')
      .eq('space_id', spaceId),
    supabase.from('badge_definitions').select('id,image_key,title')
      .in('image_key', badges.map(b => b.id)),
    selected ? supabase.from('stamp_cycles')
      .select('stamp_card_id,cycle_no,progress_count,completed_at')
      .eq('space_id', spaceId).eq('participant_id', selected.id) :
      Promise.resolve({ data: [], error: null }),
    selected ? supabase.from('participant_badges')
      .select('badge_id').eq('space_id',spaceId).eq('participant_id', selected.id) :
      Promise.resolve({ data: [], error: null }),
  ])
  if (cardResult.error || badgeResult.error || cycleResult.error || earnedResult.error)
    throw new Error('Cannot load authorized stamp and badge collection')
  const cards = cardResult.data ?? []
  const rules = badgeResult.data ?? []
  const cycles = cycleResult.data ?? []
  const earnedIds = new Set((earnedResult.data ?? []).map(row => row.badge_id))
  return <section className="social-stack">
    <div><span className="eyebrow">POINT+ COLLECTION</span>
      <h2 className="page-title">สมุดสะสมของเรา</h2>
      <p className="muted">แสตมป์และตราความสำเร็จจากกิจกรรมจริงในห้องนี้</p>
    </div>
    {eligible.length > 1 && <form method="get" className="card social-form">
      <label htmlFor="collection-person">ดูสมุดสะสมของ</label>
      <select id="collection-person" name="participant" className="input" defaultValue={selected?.id ?? ''}>
        {eligible.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
      <button className="button button--secondary" type="submit">ดูสมุดสะสม</button>
    </form>}
    {!selected && <div className="card" role="status">ไม่พบผู้เข้าร่วมที่มีสิทธิ์ดูสมุดสะสม</div>}
    <h3>แสตมป์</h3>
    <div className="collection-grid">
      {stamps.map(item => {
        const card = cards.find(c => c.image_key === item.id)
        const history = card ? cycles.filter(c => c.stamp_card_id === card.id) : []
        const completed = history.filter(c => c.completed_at !== null).length
        const latest = history.reduce<typeof history[number] | undefined>(
          (acc, c) => !acc || c.cycle_no > acc.cycle_no ? c : acc, undefined)
        return <article className="card collection-item" key={item.id}>
          <Image src={item.png} alt="" width={80} height={80} />
          <strong>{item.nameTh}</strong>
          <small className="muted">{!card ? 'ยังไม่ตั้งค่าบัตรสำหรับแสตมป์นี้' :
            completed > 0 ? 'บัตรที่สำเร็จ ' + completed + ' รอบ' :
              'สะสม ' + (latest?.progress_count ?? 0) + ' / ' + card.target_count}</small>
        </article>
      })}
    </div>
    <h3>ตราความสำเร็จ</h3>
    <div className="collection-grid">
      {badges.map(item => {
        const rule = rules.find(r => r.image_key === item.id)
        const earned = !!rule && earnedIds.has(rule.id)
        return <article className="card collection-item" key={item.id}>
          <Image src={item.png} alt="" width={80} height={80}
            style={{ filter: earned ? 'none' : 'grayscale(1)', opacity: earned ? 1 : .55 }} />
          <strong>{item.nameTh}</strong>
          <small className="muted">{!rule ? 'ยังไม่ตั้งเงื่อนไขรับตรา' : earned ? 'ปลดล็อกแล้ว' : 'ยังไม่ปลดล็อก'}</small>
          <small className="muted">{item.rarity.toUpperCase()}</small>
        </article>
      })}
    </div>
    <p className="muted">สถานะที่เห็นมาจากข้อมูล Supabase ตามสิทธิ์ของผู้เข้าร่วม ไม่ใช่ข้อมูลตัวอย่าง
      รายการที่ยังไม่ผูกกับนิยามฐานข้อมูลจะไม่ถูกแสดงว่าได้รับแล้ว</p>
  </section>
}
