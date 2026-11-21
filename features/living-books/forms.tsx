'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import type { Participant, Membership } from '@/features/spaces/data'
import { BookCover } from '@/features/stamp-books/presentation'
import {
  createLivingBookAction,createLivingCardAction,addLivingBookPageAction, type LivingActionState,
} from './actions'

const livingIdle: LivingActionState={status:'idle',message:''}

type CreationProps = {
  spaceId:string;userId:string;kind:string;participants:Participant[];members:Membership[]
}
export function CollectionCreationChoice(props:CreationProps) {
  const [format,setFormat]=useState<'living'|'card'>('living')
  return <div className="living-creator">
    <fieldset className="stamp-format-picker">
      <legend>เลือกรูปแบบการสะสม</legend>
      <div className="stamp-format-options">
        <label className="stamp-format-option" data-selected={format==='living'}>
          <input type="radio" name="top_level_format" value="living"
            checked={format==='living'} onChange={()=>setFormat('living')}/>
          <strong>สมุดความทรงจำ</strong>
          <span>สมุดเล่มเดียว เพิ่มหน้าเอง รับแสตมป์ไม่จำกัด และแลกบางส่วนได้ในอนาคต</span>
        </label>
        <label className="stamp-format-option" data-selected={format==='card'}>
          <input type="radio" name="top_level_format" value="card"
            checked={format==='card'} onChange={()=>setFormat('card')}/>
          <strong>การ์ดสะสม</strong>
          <span>ช่องหมายเลขแบบเดิม กดเลือกช่องแล้วแปะแสตมป์</span>
        </label>
      </div>
    </fieldset>
    <CreateLivingBookForm key={format} {...props} format={format}/>
  </div>
}

export function CreateLivingBookForm({spaceId,userId,kind,participants,format='living'}:CreationProps&{format?:'living'|'card'}) {
  const router=useRouter()
  const [state,action,pending]=useActionState(format==='card'?createLivingCardAction:createLivingBookAction,livingIdle)
  const [key,setKey]=useState('')
  const [cover,setCover]=useState(pointPlusStamps[0].id)
  useEffect(()=>{setKey(crypto.randomUUID())},[])
  useEffect(()=>{
    if(state.status==='success' && state.bookId)
      router.push('/s/'+spaceId+'/stamp-books/living/'+state.bookId)
  },[state,router,spaceId])
  const available=participants.filter(p=>!p.archived_at &&
    (kind!=='couple'||(p.kind==='adult' && p.user_id && p.user_id!==userId)))
  if(!available.length)return <div className="card empty-state">
    <h3>ยังไม่มีผู้รับแสตมป์ในห้อง</h3>
    <p>เชิญสมาชิกอีกคนให้เข้าร่วมห้องก่อนสร้างสมุดความทรงจำ</p>
    <a className="button button--secondary" href={'/s/'+spaceId+'/members'}>ดูสมาชิกในห้อง</a>
  </div>

  return <form action={action} className="card living-creation-form">
    <input type="hidden" name="space_id" value={spaceId}/>
    <input type="hidden" name="idempotency_key" value={key}/>
    <h3>{format==='card'?'การ์ดสะสมใบใหม่':'สมุดความทรงจำเล่มใหม่'}</h3>
    <p className="muted">{format==='card'?'เลือกจำนวนช่องและรางวัลสำหรับผู้รับ แสตมป์แต่ละดวงจะอยู่ในช่องที่ระบุ':'เริ่มด้วยกระดาษหนึ่งหน้า เพิ่มหน้าด้วยตัวเองได้ ไม่มีจำนวนแสตมป์สูงสุด และไม่ปิดสมุดอัตโนมัติ'}</p>
    <label htmlFor="living-book-title">ชื่อสมุด</label>
    <input className="input" id="living-book-title" name="title" required
      maxLength={160} placeholder="เช่น Our Little Memories"/>
    <label htmlFor="living-book-description">คำอธิบาย (ไม่บังคับ)</label>
    <textarea className="input" id="living-book-description" name="description"
      maxLength={2000} rows={3}/>
    <label htmlFor="living-book-recipient">คนที่จะได้รับแสตมป์</label>
    <select className="input" id="living-book-recipient" name="recipient_id" required>
      {available.map(person=><option value={person.id} key={person.id}>{person.display_name}</option>)}
    </select>
    <label htmlFor="living-book-cover">ภาพปก</label>
    <select className="input" id="living-book-cover" value={cover} name="cover_asset_id"
      onChange={event=>setCover(event.target.value)}>
      {pointPlusStamps.map(stamp=><option key={stamp.id} value={stamp.id}>{stamp.nameTh}</option>)}
    </select>
    <BookCover assetId={cover}/>
    {format==='card'&&<>
      <label htmlFor="living-card-target">จำนวนช่องบนการ์ด (1–100)</label>
      <input id="living-card-target" className="input" type="number" name="target_count"
        min={1} max={100} step={1} defaultValue={6} required/>
      <label htmlFor="living-card-reward">รางวัลเมื่อสะสมครบ</label>
      <input id="living-card-reward" className="input" name="reward_title"
        maxLength={160} placeholder="เช่น ไปปิกนิกด้วยกัน" required/>
    </>}
    {kind==='couple'
      ? <input type="hidden" name="approval_policy" value="direct"/>
      : <label htmlFor="living-book-approval">การให้แสตมป์ในอนาคต
          <select className="input" id="living-book-approval" name="approval_policy" defaultValue="direct">
            <option value="direct">ให้ได้ทันที</option>
            <option value="approval_required">ต้องอนุมัติ</option>
          </select>
        </label>}
    {state.status==='error' && <p role="alert" className="form-field__error">{state.message}</p>}
    <button className="button button--primary" disabled={!key||pending||state.status==='success'} type="submit">
      {pending?'กำลังสร้าง…':format==='card'?'สร้างการ์ดสะสม':'สร้างสมุดความทรงจำ'}
    </button>
  </form>
}

export function AddLivingBookPageForm({spaceId,bookId}:{
  spaceId:string;bookId:string
}) {
  const router=useRouter()
  const [state,action,pending]=useActionState(addLivingBookPageAction,livingIdle)
  const [key,setKey]=useState('')
  useEffect(()=>setKey(crypto.randomUUID()),[])
  useEffect(()=>{
    if(state.status==='success' && state.pageId) {
      setKey(crypto.randomUUID())
      router.refresh()
    }
  },[state.pageId,state.status,router])
  return <form action={action} className="living-add-page">
    <input type="hidden" name="space_id" value={spaceId}/>
    <input type="hidden" name="book_id" value={bookId}/>
    <input type="hidden" name="idempotency_key" value={key}/>
    <label htmlFor="living-new-page-title">ชื่อหน้าใหม่ (ไม่บังคับ)
      <input id="living-new-page-title" className="input" maxLength={160}
        name="title" placeholder="เช่น วันพิเศษของเรา"/>
    </label>
    <label htmlFor="living-new-page-background">พื้นหลังกระดาษ
      <select id="living-new-page-background" className="input" name="background_style" defaultValue="cream">
        <option value="cream">กระดาษครีม</option>
        <option value="white">กระดาษขาว</option>
        <option value="lined">กระดาษมีเส้น</option>
        <option value="grid">กระดาษตาราง</option>
        <option value="kraft">กระดาษคราฟต์</option>
      </select>
    </label>
    <button type="submit" className="button button--primary" disabled={!key||pending}>
      {pending?'กำลังเพิ่มหน้า…':'+ เพิ่มหน้ากระดาษ'}
    </button>
    {state.status==='error' && <p role="alert" className="form-field__error">{state.message}</p>}
    {state.status==='success' && <p role="status" className="status status--success">{state.message}</p>}
  </form>
}
