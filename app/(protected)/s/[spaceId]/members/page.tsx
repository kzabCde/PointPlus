import type { Metadata } from 'next'
import { getSpaceContext, getSpaceMembers, getSpaceParticipants, canManage } from '@/features/spaces/data'
import { InviteForm } from '@/features/invitations/invite-form'

export const metadata: Metadata = { title: 'สมาชิกพื้นที่' }
export default async function MembersPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const [{ member, space }, members, participants] = await Promise.all([
    getSpaceContext(spaceId), getSpaceMembers(spaceId), getSpaceParticipants(spaceId),
  ])
  const names = new Map(participants.filter((p) => p.kind === 'adult').map((p) => [p.user_id, p.display_name]))
  return (
    <>
      <h2>สมาชิกของพื้นที่</h2>
      <div className="card">
        {members.map((person) => <p key={person.user_id}>
          <strong>{names.get(person.user_id) ?? 'สมาชิก'}</strong> · {person.role}
        </p>)}
      </div>
      {space.kind !== 'personal' && canManage(member.role) && <div style={{ marginTop: 20 }}>
        <InviteForm spaceId={space.id} isOwner={member.role === 'owner'} />
      </div>}
      {!canManage(member.role) && <p className="muted">ผู้ดูแลพื้นที่เป็นผู้สร้างคำเชิญสมาชิก</p>}
    </>
  )
}
