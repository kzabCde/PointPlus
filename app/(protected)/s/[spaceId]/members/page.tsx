import type { Metadata } from 'next'
import { getSpaceContext, getSpaceMembers, getSpaceParticipants, canManage } from '@/features/spaces/data'
import { SectionHeader } from '@/components/ui/section-header'
import { roomRoleLabels } from '@/features/rooms/presentation'
import { InviteForm } from '@/features/invitations/invite-form'

export const metadata: Metadata = { title: 'สมาชิกพื้นที่' }
export default async function MembersPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ member, space }, members, participants] = await Promise.all([
    getSpaceContext(spaceId), getSpaceMembers(spaceId), getSpaceParticipants(spaceId),
  ])
  const names = new Map(participants.filter((p) => p.kind === 'adult').map((p) => [p.user_id, p.display_name]))
  return (
    <section className="stationery-stack">
      <SectionHeader title="สมาชิกของพื้นที่"/>
      <ul className="card member-list">
        {members.map(person => {
          const name = names.get(person.user_id) ?? 'สมาชิก'
          return <li className="member-row" key={person.user_id}>
            <span className="member-avatar" aria-hidden="true"><strong>{Array.from(name)[0]}</strong></span>
            <div><strong>{name}</strong><div className="room-meta">{roomRoleLabels[person.role]}</div></div>
          </li>
        })}
      </ul>
      {space.kind !== 'personal' && canManage(member.role) &&
        <InviteForm spaceId={space.id} isOwner={member.role === 'owner'}/>}
      {!canManage(member.role) && <p className="muted">ผู้ดูแลพื้นที่เป็นผู้สร้างคำเชิญสมาชิก</p>}
    </section>
  )
}
