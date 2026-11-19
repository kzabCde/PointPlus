import Link from 'next/link'
import { getSpaceContext, getSpaceMembers, getSpaceParticipants } from '@/features/spaces/data'

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ member }, members, participants] = await Promise.all([
    getSpaceContext(spaceId), getSpaceMembers(spaceId), getSpaceParticipants(spaceId),
  ])
  return (
    <div className="card">
      <h2>ภาพรวมพื้นที่</h2>
      <p className="muted">บทบาทของคุณ: {member.role}</p>
      <p>สมาชิกบัญชี: {members.length} คน · ผู้เข้าร่วมที่มองเห็นได้: {participants.length} คน</p>
      <p className="muted">ข้อมูลจำนวนนี้มาจากพื้นที่ที่คุณมีสิทธิ์เข้าถึง ไม่ใช่ตัวเลขจำลอง</p>
      <Link href={'/s/' + spaceId + '/missions'} className="button button--primary">ดูภารกิจ</Link>
    </div>
  )
}
