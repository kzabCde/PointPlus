import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {canManage,getSpaceContext,getSpaceParticipants} from '@/features/spaces/data'
import {CreateLivingBookForm} from '@/features/living-books/forms'

export const metadata:Metadata={title:'สร้างสมุดความทรงจำ'}
export default async function NewLivingBookPage({params}:{
  params:Promise<{spaceId:string}>
}){
  const {spaceId}=await params
  const [context,participants]=await Promise.all([
    getSpaceContext(spaceId),getSpaceParticipants(spaceId),
  ])
  const {member,user,space}=context
  if(space.kind!=='couple'&&!canManage(member.role))notFound()
  return <section className="stamp-book-page">
    <Link className="text-link" href={'/s/'+spaceId+'/stamp-books'}>
      ← กลับไปสมุดความทรงจำ
    </Link>
    <h2 className="page-title">สร้างสมุดความทรงจำ</h2>
    <CreateLivingBookForm spaceId={spaceId} userId={user.id}
      kind={space.kind} participants={participants}/>
  </section>
}
