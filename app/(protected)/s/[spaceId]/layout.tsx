import type { ReactNode } from 'react'
import Link from 'next/link'
import { RememberRoom } from '@/features/rooms/room-usage'
import { getSpaceContext } from '@/features/spaces/data'

export default async function SpaceLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ spaceId: string }>
}) {
  const { spaceId } = await params
  const { space, user } = await getSpaceContext(spaceId)
  return <>
    <RememberRoom accountId={user.id} spaceId={spaceId} />
    <div className="space-header">
      <div>
        <span className="eyebrow">{space.kind === 'personal' ? 'พื้นที่ส่วนตัว' : space.kind === 'couple' ? 'ห้องคู่รัก' : space.kind === 'family' ? 'ห้องครอบครัว' : 'ห้องทั่วไป'}</span>
        <h1 className="page-title">{space.name}</h1>
      </div>
      <Link href="/rooms" className="button button--secondary">เปลี่ยนห้อง</Link>
    </div>
    <nav aria-label="เมนูภายในห้อง" className="space-tabs">
      <Link href={'/s/' + spaceId}>หน้าห้อง</Link>
      <Link href={'/s/' + spaceId + '/missions'}>กิจกรรม</Link>
      <Link href={'/s/' + spaceId + '/collection'}>สมุดสะสม</Link>
      <Link href={'/s/' + spaceId + '/rewards'}>รางวัล</Link>
      {space.kind !== 'personal' && <Link href={'/s/' + spaceId + '/members'}>สมาชิก</Link>}
      <Link href={'/s/' + spaceId + '/settings'}>ตั้งค่า</Link>
    </nav>
    {children}
  </>
}
