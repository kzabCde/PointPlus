import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canManage, getSpaceContext, getSpaceMembers, getSpaceParticipants } from '@/features/spaces/data'
import { CreateStampBookForm } from '@/features/stamp-books/forms'

export const metadata:Metadata={title:'สร้างสมุดสะสม'}
export default async function NewStampBookPage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 const [{member,user,space},participants,members]=await Promise.all([
  getSpaceContext(spaceId),getSpaceParticipants(spaceId),getSpaceMembers(spaceId)
 ])
 if(space.kind!=='couple'&&!canManage(member.role))notFound()
 return <section className="stamp-book-page">
  <Link href={'/s/'+spaceId+'/stamp-books'} className="text-link">← กลับไปสมุดสะสม</Link>
  <header><span className="eyebrow">CREATE STAMP BOOK</span><h2 className="page-title">สร้างสมุดเล่มใหม่</h2>
  <p className="muted">{space.kind==='couple'?'สร้างสมุดให้คู่ของคุณ คุณจะเป็นผู้ให้แสตมป์ของสมุดนี้เสมอ และคู่ของคุณเลือกรางวัลเมื่อครบเล่ม':'เลือกคนสะสม ตั้งจำนวนดวง เลือกลายที่ชอบ และตั้งตัวเลือกรางวัลที่มอบให้กัน'}</p></header>
  <CreateStampBookForm spaceId={spaceId} userId={user.id} kind={space.kind} participants={participants} members={members}/>
 </section>
}
