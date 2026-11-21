import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canManage, getSpaceContext, getSpaceParticipants } from '@/features/spaces/data'
import { CollectionCreationChoice } from '@/features/living-books/forms'

export const metadata:Metadata={title:'สร้างการ์ดหรือสมุดสะสม'}
export default async function NewStampBookPage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 const [{member,user,space},participants]=await Promise.all([
  getSpaceContext(spaceId),getSpaceParticipants(spaceId)
 ])
 if(space.kind!=='couple'&&!canManage(member.role))notFound()
 return <section className="stamp-book-page">
  <Link href={'/s/'+spaceId+'/stamp-books'} className="text-link">← กลับไปการสะสม</Link>
  <header><h2 className="page-title">สร้างการสะสมใหม่</h2></header>
  <CollectionCreationChoice spaceId={spaceId} userId={user.id}
    kind={space.kind} participants={participants}/>
 </section>
}
