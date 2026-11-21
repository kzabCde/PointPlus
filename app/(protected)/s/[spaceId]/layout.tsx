import './stamp-books/stamp-books.css'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Navigation } from '../../navigation'
import { roomKindLabels } from '@/features/rooms/presentation'
import { RememberRoom } from '@/features/rooms/room-usage'
import { getSpaceContext } from '@/features/spaces/data'

export default async function SpaceLayout({children,params}:{
 children:ReactNode;params:Promise<{spaceId:string}>
}){
 const {spaceId}=await params
 const {space,user}=await getSpaceContext(spaceId)
 const base='/s/'+spaceId
 return <>
  <RememberRoom accountId={user.id} spaceId={spaceId}/>
  <div className="space-header">
   <div><span className="room-meta">{roomKindLabels[space.kind]}</span>
    <h1 className="page-title">{space.name}</h1></div>
   <Link className="button button--secondary" href="/rooms">เปลี่ยนห้อง</Link>
  </div>
  <Navigation label="เมนูภายในห้อง" className="space-tabs" destinations={[
   {href: base, label: 'หน้าห้อง'},
   {href: base + '/stamp-books', label: 'สมุดสะสม', nested: true},
   ...(space.kind !== 'personal' ? [{href: base + '/members', label: 'สมาชิก'}] : []),
   {href: base + '/settings', label: 'ตั้งค่า'},
  ]}/>
  {children}
 </>
}
