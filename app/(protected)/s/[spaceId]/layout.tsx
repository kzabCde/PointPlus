import type { ReactNode } from 'react'
import Link from 'next/link'
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
   <div><span className="eyebrow">{space.kind==='personal'?'พื้นที่ส่วนตัว':space.kind==='couple'?'ห้องคู่รัก':space.kind==='family'?'ห้องครอบครัว':'ห้องทั่วไป'}</span>
    <h1 className="page-title">{space.name}</h1></div>
   <Link className="button button--secondary" href="/rooms">เปลี่ยนห้อง</Link>
  </div>
  <nav className="space-tabs" aria-label="เมนูภายในห้อง">
   <Link href={base}>หน้าห้อง</Link>
   <Link href={base+'/stamp-books'}>สมุดสะสม</Link>
   {space.kind!=='personal'&&<Link href={base+'/members'}>สมาชิก</Link>}
   <Link href={base+'/settings'}>ตั้งค่า</Link>
  </nav>
  {children}
 </>
}
