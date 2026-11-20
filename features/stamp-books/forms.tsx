'use client'

import Image from 'next/image'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import type { Participant, Membership } from '@/features/spaces/data'
import type { BookReward, StampBook } from './data'
import {
 createStampBookAction,giveStampAction,reviewStampAction,
 claimStampRewardAction,processStampClaimAction,updateStampBookAction,
 addStampRewardAction,type StampBookState,
} from './actions'

const idle:StampBookState={status:'idle',message:''}
const Result=({state}:{state:StampBookState})=>state.message
 ? <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>
 : null

export function CreateStampBookForm({spaceId,userId,kind,participants,members}:{
 spaceId:string;userId:string;kind:string;participants:Participant[];members:Membership[]
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(createStampBookAction,idle)
 useEffect(()=>{if(state.status==='success'&&state.bookId)router.push('/s/'+spaceId+'/stamp-books/'+state.bookId)},[state.status,state.bookId,router,spaceId])
 return <form action={action} className="card stamp-book-form">
  <input type="hidden" name="space_id" value={spaceId}/>
  <div className="form-field">
   <label className="form-field__label" htmlFor="stamp-book-title">ชื่อสมุด</label>
   <input className="input" id="stamp-book-title" name="title" placeholder="เช่น สมุดความสุขของเรา" maxLength={160} required/>
  </div>
  <div className="form-field">
   <label className="form-field__label" htmlFor="stamp-book-desc">คำอธิบาย</label>
   <textarea className="input" id="stamp-book-desc" name="description" maxLength={2000} rows={3} placeholder="มาสะสมช่วงเวลาดี ๆ ด้วยกัน"/>
  </div>
  <div className="form-field">
   <label className="form-field__label" htmlFor="stamp-book-target">สะสมให้ครบกี่ดวง</label>
   <input id="stamp-book-target" className="input" type="number" name="target_count" min={1} max={100} defaultValue={6} step={1} required/>
   <span className="form-field__hint">แนะนำ 5, 6, 8, 10 หรือ 12 ดวง</span>
  </div>
  <fieldset className="stamp-picker-set">
   <legend className="form-field__label">ใครเป็นเจ้าของสมุดนี้บ้าง</legend>
   <p className="muted">แต่ละคนจะมีหน้าและความคืบหน้าของตัวเอง ในห้องร่วมกันผู้ให้แสตมป์ไม่สามารถให้ตัวเองได้</p>
   {participants.map(p=><label className="stamp-check" key={p.id}>
    <input type="checkbox" name="recipient_id" value={p.id} defaultChecked={kind==='personal'||p.user_id!==userId} />
    <span>{p.display_name}{p.kind==='child'?' (เด็ก)':''}</span>
   </label>)}
  </fieldset>
  <fieldset className="stamp-picker-set">
   <legend className="form-field__label">ใครบ้างที่ให้แสตมป์ได้</legend>
   {members.map(m=><label className="stamp-check" key={m.user_id}>
    <input type="checkbox" name="giver_id" value={m.user_id} defaultChecked/>
    <span>{participants.find(p=>p.user_id===m.user_id)?.display_name??'สมาชิก'} ({m.role})</span>
   </label>)}
  </fieldset>
  <fieldset className="stamp-picker-set">
   <legend className="form-field__label">เลือกแสตมป์ที่ใช้ในสมุด</legend>
   <p className="muted">เลือกได้ทุกลาย ไม่จำกัดประเภทห้อง และเปลี่ยนลายได้ทุกครั้งที่ให้แสตมป์</p>
   <div className="stamp-art-grid">
    {pointPlusStamps.map(s=><label className="stamp-art-option" key={s.id}>
     <input type="checkbox" name="asset_id" value={s.id} defaultChecked/>
     <Image src={s.png} width={60} height={60} alt=""/>
     <span>{s.nameTh}</span>
    </label>)}
   </div>
  </fieldset>
  <div className="form-field">
   <label className="form-field__label" htmlFor="stamp-book-rewards">ตัวเลือกรางวัลเมื่อสะสมครบ</label>
   <textarea id="stamp-book-rewards" className="input" name="rewards" rows={5}
    defaultValue={'เลือกหนังดูด้วยกัน\nทำอาหารมื้อพิเศษ\nเลือกกิจกรรมวันหยุด'}
    required placeholder="หนึ่งบรรทัดต่อหนึ่งรางวัล"/>
   <span className="form-field__hint">ผู้สะสมเลือกได้ 1 รายการต่อสมุดที่ครบหนึ่งรอบ ไม่หักแต้ม</span>
  </div>
  <div className="form-field">
   <label className="form-field__label" htmlFor="stamp-book-approval">วิธีให้แสตมป์</label>
   <select id="stamp-book-approval" name="approval_policy" className="input" defaultValue="direct">
    <option value="direct">ผู้มีสิทธิ์ให้แสตมป์ได้ทันที</option>
    <option value="approval_required">ต้องให้ผู้ดูแลคนอื่นอนุมัติ (ต้องมีผู้ตรวจที่ไม่ใช่ผู้ให้)</option>
   </select>
  </div>
  <label className="stamp-check"><input name="repeatable" type="checkbox" defaultChecked/> เริ่มสะสมรอบใหม่ได้เมื่อครบ</label>
  {kind==='personal'&&<label className="stamp-check"><input name="allow_self_stamp" type="checkbox"/> ให้แสตมป์ตัวเองได้ (พื้นที่ส่วนตัวเท่านั้น)</label>}
  <Result state={state}/>
  <button disabled={pending} type="submit" className="button button--primary">{pending?'กำลังสร้าง…':'สร้างสมุดสะสม'}</button>
 </form>
}

export function GiveStampDialog({spaceId,bookId,recipients,styleIds,canGive,stampKey}:{
 spaceId:string;bookId:string;recipients:Participant[];styleIds:string[];canGive:boolean;stampKey:string
}){
 const router=useRouter()
 const dialog=useRef<HTMLDialogElement>(null)
 const [state,action,pending]=useActionState(giveStampAction,idle)
 const styles=pointPlusStamps.filter(s=>styleIds.includes(s.id))
 const [art,setArt]=useState(styles[0]?.id??'')
 useEffect(()=>{
  if(state.status==='success'){dialog.current?.close();router.refresh()}
 },[state.status,router])
 if(!canGive||!recipients.length||!styles.length)return null
 return <div>
  <button type="button" className="button button--primary" onClick={()=>dialog.current?.showModal()}>+ ให้แสตมป์</button>
  <dialog className="dialog stamp-dialog" ref={dialog} aria-labelledby="give-stamp-title">
   <form action={action} className="social-form">
    <h2 id="give-stamp-title">เลือกดวงแสตมป์</h2>
    <p className="muted">การให้แสตมป์ที่สำเร็จจะเพิ่ม 1 ดวงในสมุดของผู้รับ</p>
    <input type="hidden" name="space_id" value={spaceId}/>
    <input type="hidden" name="book_id" value={bookId}/>
    <input type="hidden" name="idempotency_key" value={stampKey}/>
    <div className="form-field">
     <label htmlFor="stamp-give-to">ให้ใคร</label>
     <select className="input" name="recipient_id" id="stamp-give-to" required>
      {recipients.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
     </select>
    </div>
    <fieldset className="stamp-picker-set"><legend className="form-field__label">ลายของดวงนี้</legend>
     <div className="stamp-art-grid">
      {styles.map(s=><label key={s.id} className={'stamp-art-option'+(art===s.id?' stamp-art-option--selected':'')}>
       <input type="radio" name="asset_id" value={s.id} required checked={art===s.id} onChange={()=>setArt(s.id)}/>
       <Image src={s.png} alt="" width={58} height={58}/><span>{s.nameTh}</span>
      </label>)}
     </div>
    </fieldset>
    <div className="form-field"><label htmlFor="stamp-give-note">ข้อความสั้น ๆ (ไม่บังคับ)</label>
     <textarea id="stamp-give-note" name="note" className="input" maxLength={1000} rows={2}/>
    </div>
    <Result state={state}/>
    <div className="hero__actions">
     <button className="button button--primary" type="submit" disabled={pending}>{pending?'กำลังบันทึก…':'ยืนยันให้ 1 ดวง'}</button>
     <button type="button" className="button button--secondary" onClick={()=>dialog.current?.close()}>ปิด</button>
    </div>
   </form>
  </dialog>
  <Result state={state}/>
 </div>
}

export function ClaimStampRewardForm({spaceId,bookId,cycleId,rewards,keyId}:{
 spaceId:string;bookId:string;cycleId:string;rewards:BookReward[];keyId:string
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(claimStampRewardAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[router,state.status])
 const available=rewards.filter(r=>r.active&&r.stock_remaining!==0)
 if(!available.length)return <p className="muted">ยังไม่มีรางวัลที่พร้อมให้เลือก</p>
 return <form action={action} className="stamp-reward-choice">
  <input type="hidden" name="space_id" value={spaceId}/>
  <input type="hidden" name="book_id" value={bookId}/>
  <input type="hidden" name="cycle_id" value={cycleId}/>
  <input type="hidden" name="idempotency_key" value={keyId}/>
  <label className="form-field__label" htmlFor={'book-reward-'+cycleId}>สมุดครบแล้ว! เลือกรางวัลหนึ่งอย่าง</label>
  <select className="input" id={'book-reward-'+cycleId} name="reward_id" required>
   {available.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
  </select>
  <button className="button button--primary" type="submit" disabled={pending||state.status==='success'}>{pending?'กำลังเลือก…':'เลือกรางวัลนี้'}</button>
  <Result state={state}/>
 </form>
}

export function ReviewStampForm({spaceId,bookId,requestId}:{
 spaceId:string;bookId:string;requestId:string
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(reviewStampAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[state.status,router])
 return <form action={action} className="hero__actions">
  <input type="hidden" name="space_id" value={spaceId}/><input type="hidden" name="book_id" value={bookId}/>
  <input type="hidden" name="request_id" value={requestId}/>
  <button disabled={pending||state.status==='success'} name="decision" value="approve" className="button button--primary">อนุมัติ</button>
  <button disabled={pending||state.status==='success'} name="decision" value="reject" className="button button--secondary">ปฏิเสธ</button>
  <Result state={state}/>
 </form>
}

export function ProcessBookRewardForm({spaceId,bookId,claimId}:{
 spaceId:string;bookId:string;claimId:string
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(processStampClaimAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[state.status,router])
 return <form action={action} className="hero__actions">
  <input type="hidden" name="space_id" value={spaceId}/><input type="hidden" name="book_id" value={bookId}/>
  <input type="hidden" name="claim_id" value={claimId}/>
  <button className="button button--primary" name="decision" value="fulfilled" disabled={pending||state.status==='success'}>ส่งมอบแล้ว</button>
  <button className="button button--secondary" name="decision" value="canceled" disabled={pending||state.status==='success'}>ยกเลิก</button>
  <Result state={state}/>
 </form>
}

export function EditStampBookForm({spaceId,book}:{
 spaceId:string;book:StampBook
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(updateStampBookAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[state.status,router])
 return <form action={action} className="card social-form">
  <input type="hidden" name="space_id" value={spaceId}/><input type="hidden" name="book_id" value={book.id}/>
  <label htmlFor="edit-book-title">ชื่อสมุด</label><input className="input" id="edit-book-title" name="title" required defaultValue={book.title} maxLength={160}/>
  <label htmlFor="edit-book-desc">รายละเอียด</label><textarea className="input" id="edit-book-desc" name="description" maxLength={2000} defaultValue={book.description??''}/>
  <label htmlFor="edit-book-target">จำนวนดวง (แก้ได้ก่อนให้ดวงแรก)</label><input className="input" type="number" id="edit-book-target" name="target_count" min={1} max={100} defaultValue={book.target_count}/>
  <label htmlFor="edit-book-status">สถานะ</label>
  <select className="input" name="status" id="edit-book-status" defaultValue={book.status}>
   <option value="active">ใช้งาน</option><option value="paused">พักสมุดชั่วคราว</option><option value="archived">เก็บเข้าคลังถาวร</option>
  </select>
  <button className="button button--primary" type="submit" disabled={pending}>บันทึกสมุด</button><Result state={state}/>
 </form>
}

export function AddStampRewardForm({spaceId,bookId}:{
 spaceId:string;bookId:string
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(addStampRewardAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[state.status,router])
 return <form action={action} className="card social-form">
  <h3>เพิ่มตัวเลือกรางวัล</h3>
  <input type="hidden" name="space_id" value={spaceId}/><input type="hidden" name="book_id" value={bookId}/>
  <label htmlFor="add-book-reward-title">ชื่อรางวัล</label>
  <input id="add-book-reward-title" className="input" name="title" required maxLength={160}/>
  <label htmlFor="add-book-reward-description">รายละเอียด</label>
  <textarea id="add-book-reward-description" className="input" name="description" maxLength={2000}/>
  <label htmlFor="add-book-reward-stock">จำนวนสิทธิ์ (ไม่กรอก = ไม่จำกัด)</label>
  <input id="add-book-reward-stock" className="input" type="number" min={0} step={1} name="stock"/>
  <button className="button button--primary" type="submit" disabled={pending}>เพิ่มรางวัล</button><Result state={state}/>
 </form>
}
