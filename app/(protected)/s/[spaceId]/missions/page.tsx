import type { Metadata } from 'next'
import { loadMissionBoard, frequencyLabels, type BoardFilters } from '@/features/missions/data'
import { MissionCard } from '@/features/missions/mission-card'
export const metadata: Metadata = { title: 'ภารกิจ' }
export default async function MissionsPage({ params, searchParams }: {
  params: Promise<{ spaceId: string }>; searchParams: Promise<BoardFilters>
}) {
  const { spaceId } = await params
  const filters = await searchParams
  const board = await loadMissionBoard(spaceId, filters)
  return <>
    <h2>ภารกิจในพื้นที่</h2>
    <p className="muted">รายการจริงจาก Supabase ตามพื้นที่และผู้เข้าร่วมที่คุณมีสิทธิ์เข้าถึง</p>
    <form action={'/s/' + spaceId + '/missions'} method="get" className="card mission-filters">
      <div className="form-field"><label htmlFor="board-participant">ผู้เข้าร่วม</label>
        <select id="board-participant" name="participant" className="input" defaultValue={board.selected?.id ?? ''}>
          {board.participants.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select></div>
      <div className="form-field"><label htmlFor="board-search">ค้นหาชื่อภารกิจ</label>
        <input id="board-search" name="search" className="input" maxLength={160} defaultValue={filters.search ?? ''} /></div>
      <div className="form-field"><label htmlFor="board-frequency">ความถี่</label>
        <select id="board-frequency" name="frequency" className="input" defaultValue={filters.frequency ?? ''}>
          <option value="">ทั้งหมด</option>
          {Object.entries(frequencyLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>
      <div className="form-field"><label htmlFor="board-mode">การมอบหมาย</label>
        <select id="board-mode" name="mode" className="input" defaultValue={filters.mode ?? ''}>
          <option value="">ทั้งหมด</option><option value="open">ทุกคน</option><option value="assigned">เฉพาะผู้ได้รับมอบหมาย</option>
        </select></div>
      {board.manager && <div className="form-field"><label htmlFor="board-status">สถานะ</label>
        <select id="board-status" name="status" className="input" defaultValue={filters.status ?? 'active'}>
          <option value="active">เปิดใช้งาน</option><option value="draft">ร่าง</option><option value="archived">เก็บถาวร</option>
        </select></div>}
      <button className="button button--primary" type="submit">ใช้ตัวกรอง</button>
    </form>
    {!board.selected && <div role="alert" className="card">ไม่พบผู้เข้าร่วมที่คุณมีสิทธิ์ดูภารกิจ</div>}
    {board.selected && (board.missions.length
      ? <div className="feature-grid">{board.missions.map((m) =>
          <MissionCard key={m.id} mission={m} spaceId={spaceId} participantId={board.selected!.id} />)}
        </div>
      : <div role="status" className="card"><h3>ไม่พบภารกิจที่ตรงกับตัวกรอง</h3>
          <p className="muted">อาจยังไม่มีภารกิจ หรือผู้เข้าร่วมที่เลือกไม่ได้รับมอบหมาย</p>
        </div>)}
  </>
}
