import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canManage, getSpaceContext, getSpaceMembers, getSpaceParticipants } from '@/features/spaces/data'
import { CreateStampBookForm, CreateCoupleStampBookForm } from '@/features/stamp-books/forms'

export const metadata:Metadata={title:'สร้างการ์ดหรือสมุดสะสม'}
export default async function NewStampBookPage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 const [{member,user,space},participants,members]=await Promise.all([
  getSpaceContext(spaceId),getSpaceParticipants(spaceId),getSpaceMembers(spaceId)
 ])
 if(space.kind!=='couple'&&!canManage(member.role))notFound()
 return <section className="stamp-book-page">
  <Link href={'/s/'+spaceId+'/stamp-books'} className="text-link">← กลับไปการสะสม</Link>
  <header><h2 className="page-title">สร้างการสะสมใหม่</h2></header>
  {space.kind==='couple'
    ? <CreateCoupleStampBookForm spaceId={spaceId} userId={user.id} participants={participants}/>
    : <CreateStampBookForm spaceId={spaceId} userId={user.id} kind={space.kind} participants={participants} members={members}/>}
 </section>
}
