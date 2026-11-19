import type { ReactNode } from 'react'
import Link from 'next/link'
import { getSpaceContext, canManage } from '@/features/spaces/data'

export default async function SpaceLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ spaceId: string }>
}) {
  const { spaceId } = await params
  const { space, member } = await getSpaceContext(spaceId)
  return (
    <>
      <div className="space-header">
        <div>
          <span className="eyebrow">{space.kind === 'personal' ? 'ส่วนตัว' : space.kind === 'couple' ? 'คนรัก' : 'ครอบครัว'}</span>
          <h1 className="page-title">{space.name}</h1>
        </div>
        <Link href="/spaces" className="button button--secondary">เปลี่ยนพื้นที่</Link>
      </div>
      <nav aria-label="เมนูพื้นที่" className="space-tabs">
        <Link href={'/s/' + spaceId}>ภาพรวม</Link>
        <Link href={'/s/' + spaceId + '/missions'}>ภารกิจ</Link>
        <Link href={'/s/' + spaceId + '/daily'}>กิจกรรมวันนี้</Link>
        <Link href={'/s/' + spaceId + '/shared'}>กิจกรรมร่วมกัน</Link>
        <Link href={'/s/' + spaceId + '/progress'}>ความคืบหน้า</Link>
        <Link href={'/s/' + spaceId + '/reviews'}>รอตรวจ</Link>
        {canManage(member.role) && <Link href={'/s/'+spaceId+'/campaigns'}>ชุดภารกิจ</Link>}
        {space.kind === 'family' && <Link href={'/s/' + spaceId + '/children'}>เด็กในครอบครัว</Link>}
        {space.kind !== 'personal' && <Link href={'/s/' + spaceId + '/members'}>สมาชิก</Link>}
        <Link href={'/s/' + spaceId + '/settings'}>ตั้งค่า</Link>
      </nav>
      {children}
    </>
  )
}
