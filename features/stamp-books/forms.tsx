'use client'

import Image from 'next/image'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SegmentedField } from '@/components/ui/segmented-field'
import { pointPlusStamps } from '@/lib/point-plus/assets'
import type { Participant, Membership } from '@/features/spaces/data'
import type { BookReward, StampBook } from './data'
import {
 createStampBookAction,giveStampAction,reviewStampAction,
 claimStampRewardAction,claimCoupleMemoryAction,processStampClaimAction,updateStampBookAction,
 addStampRewardAction,type StampBookState,
} from './actions'

const idle:StampBookState={status:'idle',message:''}
function Result({ state }: { state: StampBookState }) {
 const [dismissed, setDismissed] = useState<StampBookState | null>(null)
 useEffect(() => {
  if (state.status !== 'success' || state.outcome === 'rejected') return
  const timer = window.setTimeout(() => setDismissed(state), 6500)
  return () => window.clearTimeout(timer)
 }, [state])

 if (!state.message || state === dismissed) return null
 const error = state.status === 'error' || state.outcome === 'rejected'
 const tone = error ? 'error' : state.outcome === 'pending' ? 'warning' : 'success'
 return <p role={error ? 'alert' : 'status'} className={'status status--' + tone}>{state.message}</p>
}

export function CreateStampBookForm({spaceId,userId,kind,participants,members}:{
 spaceId:string;userId:string;kind:string;participants:Participant[];members:Membership[]
}){
 const router = useRouter()
 const [state, action, pending] = useActionState(createStampBookAction, idle)
 const [step, setStep] = useState(0)
 const [issue, setIssue] = useState('')
 const [cover, setCover] = useState(pointPlusStamps[0].id)
 const [title, setTitle] = useState('')
 const [target, setTarget] = useState('6')
 const [review, setReview] = useState<FormData | null>(null)
 const heading = useRef<HTMLHeadingElement>(null)
 const submitting = useRef(false)
 const names = ['สมุดของคุณ', 'ผู้สะสมและแสตมป์', 'รางวัลและตรวจสอบ']
 const recipients = participants.filter(p => kind !== 'couple' || (p.kind==='adult'&&p.user_id!==userId))
 const coverArt = pointPlusStamps.find(stamp => stamp.id === cover)!
 const selectedArt = pointPlusStamps.filter(stamp => review?.getAll('asset_id').includes(stamp.id))

 useEffect(() => {
  if (state.status === 'success' && state.bookId) router.push('/s/' + spaceId + '/stamp-books/' + state.bookId)
  if (state.status === 'error') submitting.current = false
 }, [state, router, spaceId])

 function move(next: number) {
  setIssue('')
  setStep(next)
  requestAnimationFrame(() => heading.current?.focus())
 }

 function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (submitting.current) return
  const form = event.currentTarget
  const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
   '[data-wizard-step="' + step + '"] :is(input, textarea, select)'
  )
  for (const field of fields) {
   if (!field.reportValidity()) return
  }
  const payload = new FormData(form)
  if (step === 0 && !title.trim()) {
   form.querySelector<HTMLInputElement>('#stamp-book-title')?.focus()
   return setIssue('กรุณากรอกชื่อสมุด')
  }
  if (step === 1) {
   const count = payload.getAll('recipient_id').length
   const giverCount = payload.getAll('giver_id').length
   if (count < 1 || count > (kind === 'couple' ? 1 : 30)) return setIssue('กรุณาเลือกจำนวนผู้สะสมให้ตรงกับประเภทห้อง')
   if (giverCount < 1 || giverCount > 30) return setIssue('กรุณาเลือกผู้ให้แสตมป์ 1–30 คน')
  }
  if (step < 2) {
   setReview(payload)
   move(step + 1)
   return
  }
  const rewards = String(payload.get('rewards')).split('\n').map(line => line.trim()).filter(Boolean)
  if (!rewards.length || rewards.length > 20 || rewards.some(line => line.length > 160)) {
   return setIssue('กรุณาใส่รางวัล 1–20 รายการ แต่ละรายการยาวไม่เกิน 160 ตัวอักษร')
  }
  // The creation RPC uses the first style as the cover.
  const styles = payload.getAll('asset_id').filter(asset => asset !== cover)
  payload.delete('asset_id')
  for (const asset of [cover, ...styles]) payload.append('asset_id', asset)
  setIssue('')
  submitting.current = true
  startTransition(() => action(payload))
 }

 return <form onSubmit={submit} noValidate className="card stamp-book-form">
  <input type="hidden" name="space_id" value={spaceId}/>
  <ol className="wizard-steps" aria-label="ขั้นตอนการสร้างสมุด">
   {names.map((name, index) => <li key={name} aria-current={index === step ? 'step' : undefined}>
    <span>{index + 1}</span>{name}
   </li>)}
  </ol>
  <h3 ref={heading} tabIndex={-1}>{names[step]}</h3>
  <div className="wizard-panel" hidden={step !== 0} data-wizard-step="0">
   <label htmlFor="stamp-book-title">ชื่อสมุด</label>
   <input className="input" id="stamp-book-title" name="title" maxLength={160} required value={title} onChange={e => setTitle(e.target.value)}/>
   <label htmlFor="stamp-book-desc">คำอธิบาย (ไม่บังคับ)</label>
   <textarea className="input" id="stamp-book-desc" name="description" maxLength={2000} rows={3}/>
   <div className="wizard-cover">
    <Image src={coverArt.png} width={76} height={76} alt=""/>
    <div className="form-field">
     <label htmlFor="stamp-book-cover">ลายบนปก</label>
     <select className="input" id="stamp-book-cover" value={cover} onChange={e => setCover(e.target.value)}>
      {pointPlusStamps.map(stamp => <option key={stamp.id} value={stamp.id}>{stamp.nameTh}</option>)}
     </select>
    </div>
   </div>
   <label htmlFor="stamp-book-target">จำนวนแสตมป์ต่อรอบ</label>
   <input className="input" id="stamp-book-target" type="number" name="target_count" min={1} max={100} required value={target} onChange={e => setTarget(e.target.value)}/>
   {kind !== 'couple' && <SegmentedField label="จำนวนรอบ" name="repeatable" defaultValue="on" options={[
    { value: 'off', label: 'รอบเดียว' },
    { value: 'on', label: 'สะสมซ้ำได้' },
   ]}/>}
  </div>
  <div className="wizard-panel" hidden={step !== 1} data-wizard-step="1">
   <fieldset className="stamp-picker-set">
    <legend>ผู้สะสม</legend>
    {!recipients.length && <p>ยังไม่มีผู้สะสมที่เลือกได้ <a className="text-link" href={'/s/' + spaceId + '/members'}>ดูสมาชิกในห้อง</a></p>}
    {recipients.map(person => <label className="stamp-check" key={person.id}>
     <input type="checkbox" name="recipient_id" value={person.id} defaultChecked={kind === 'personal' || person.user_id !== userId}/>
     {person.display_name}{person.kind === 'child' ? ' (เด็ก)' : ''}
    </label>)}
   </fieldset>
   {kind === 'couple' ? <>
    <input type="hidden" name="giver_id" value={userId}/>
    <input type="hidden" name="approval_policy" value="direct"/>
    <p className="muted">คุณให้แสตมป์คู่ของคุณได้ทันที</p>
   </> : <>
    <fieldset className="stamp-picker-set"><legend>ผู้ให้แสตมป์</legend>
     {members.map(member => <label className="stamp-check" key={member.user_id}>
      <input type="checkbox" name="giver_id" value={member.user_id} defaultChecked/>
      {participants.find(person => person.user_id === member.user_id)?.display_name ?? 'สมาชิก'}
     </label>)}
    </fieldset>
    <SegmentedField label="วิธีให้แสตมป์" name="approval_policy" defaultValue="direct" options={[
     { value: 'direct', label: 'ให้ได้ทันที' },
     { value: 'approval_required', label: 'ต้องอนุมัติ' },
    ]}/>
    {kind === 'personal' && <label className="stamp-check"><input name="allow_self_stamp" type="checkbox"/> ให้แสตมป์ตัวเองได้</label>}
   </>}
   <fieldset className="stamp-picker-set"><legend>ลายแสตมป์</legend>
    <div className="stamp-art-grid">
     {pointPlusStamps.map(stamp => <label className="stamp-art-option" key={stamp.id}>
      <input type="checkbox" name="asset_id" value={stamp.id} defaultChecked disabled={stamp.id === cover}/>
      <Image src={stamp.png} width={56} height={56} alt=""/>
      <span>{stamp.nameTh}{stamp.id === cover && ' · ปก'}</span>
     </label>)}
    </div>
   </fieldset>
  </div>
  <div className="wizard-panel" hidden={step !== 2} data-wizard-step="2">
   <div className="wizard-preview">
    <Image src={coverArt.png} alt="" width={76} height={76}/>
    <div><strong>{title}</strong><div>{target} ดวงต่อรอบ · {review?.get('repeatable') === 'on' ? 'สะสมได้หลายรอบ' : 'สะสมรอบเดียว'}</div>
     <div>ผู้สะสม: {recipients.filter(person => review?.getAll('recipient_id').includes(person.id)).map(person => person.display_name).join(' · ')}</div>
     <div>ผู้ให้แสตมป์: {kind === 'couple' ? 'คุณ' : members.filter(member => review?.getAll('giver_id').includes(member.user_id)).map(member => participants.find(person => person.user_id === member.user_id)?.display_name ?? 'สมาชิก').join(' · ')}</div>
     <div>{review?.get('approval_policy') === 'approval_required' ? 'ต้องอนุมัติแสตมป์' : 'ให้แสตมป์ได้ทันที'}</div>
    </div>
   </div>
   <ul className="wizard-preview__art" aria-label="ลายแสตมป์ที่เลือก">
    {[coverArt, ...selectedArt].map(stamp => <li key={stamp.id}><Image src={stamp.png} width={32} height={32} alt={stamp.nameTh}/></li>)}
   </ul>
   {kind === 'couple' ? <>
    <input type="hidden" name="rewards" value="ข้อความรางวัลที่คนสะสมจะเขียนเมื่อครบเล่ม"/>
    <p>เมื่อครบเล่ม ผู้สะสมเขียนข้อความรางวัลและเก็บสมุดเป็นความทรงจำ</p>
   </> : <>
    <label htmlFor="stamp-book-rewards">ตัวเลือกรางวัล</label>
    <textarea id="stamp-book-rewards" name="rewards" className="input" rows={4} required
     placeholder="เช่น เลือกหนังดูด้วยกัน"
     aria-describedby="stamp-book-rewards-hint"/>
    <p className="form-field__hint" id="stamp-book-rewards-hint">หนึ่งบรรทัดต่อหนึ่งรางวัล ผู้สะสมเลือกได้หนึ่งรายการต่อรอบ</p>
   </>}
  </div>
  {issue && <p className="form-field__error" role="alert">{issue}</p>}
  {step === 2 && <Result state={state}/>}
  <div className="wizard-actions">
   {step > 0 && <button disabled={pending || state.status === 'success'} type="button" className="button button--secondary" onClick={() => move(step - 1)}>ย้อนกลับ</button>}
   <button disabled={pending || state.status === 'success'} type="submit" className="button button--primary">
    {step < 2 ? 'ถัดไป' : pending ? 'กำลังสร้าง…' : 'ยืนยันสร้างสมุด'}
   </button>
  </div>
 </form>
}

export function GiveStampDialog({spaceId,bookId,recipients,styleIds,canGive,stampKey}:{
 spaceId:string;bookId:string;recipients:Participant[];styleIds:string[];canGive:boolean;stampKey:string
}){
 const router=useRouter()
 const dialog=useRef<HTMLDialogElement>(null)
 const [state,action,pending]=useActionState(giveStampAction,idle)
 const styles=pointPlusStamps.filter(s=>styleIds.includes(s.id))
 const [selectedArt, setArt] = useState('')
 const art = styles.some(style => style.id === selectedArt) ? selectedArt : styles[0]?.id
 const [completedKey, setCompletedKey] = useState<string | null>(null)
 const [note, setNote] = useState('')
 const [recipient, setRecipient] = useState(recipients[0]?.id ?? '')
 useEffect(()=>{
  if (state.status === 'success') {
   dialog.current?.close()
   setNote('')
   router.refresh()
  }
 }, [state, router])
 if (!canGive || !recipients.length || !styles.length) {
  return state.status === 'success' ? <Result state={state}/> : null
 }
 return <div>
  <button type="button" className="button button--primary" onClick={()=>dialog.current?.showModal()}>+ ให้แสตมป์</button>
  <dialog className="dialog stamp-dialog" ref={dialog} aria-labelledby="give-stamp-title"
   onCancel={event => { if (pending) event.preventDefault() }}>
   <form action={action} onSubmit={() => setCompletedKey(stampKey)} className="social-form">
    <h2 id="give-stamp-title">เลือกดวงแสตมป์</h2>

    <input type="hidden" name="space_id" value={spaceId}/>
    <input type="hidden" name="book_id" value={bookId}/>
    <input type="hidden" name="idempotency_key" value={stampKey}/>
    <div className="form-field">
     <label htmlFor="stamp-give-to">ให้ใคร</label>
     <select className="input" name="recipient_id" id="stamp-give-to" required
      value={recipients.some(person => person.id === recipient) ? recipient : recipients[0].id}
      onChange={event => setRecipient(event.target.value)}>
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
     <textarea id="stamp-give-note" name="note" className="input" maxLength={1000} rows={2} value={note} onChange={event => setNote(event.target.value)}/>
    </div>
    {state.status === 'error' && <Result state={state}/>}
    <div className="hero__actions">
     <button className="button button--primary" type="submit" disabled={pending || (state.status === 'success' && completedKey === stampKey)}>{pending?'กำลังบันทึก…':'ยืนยันให้ 1 ดวง'}</button>
     <button type="button" className="button button--secondary" disabled={pending} onClick={()=>dialog.current?.close()}>ปิด</button>
    </div>
   </form>
  </dialog>
  {state.status !== 'error' && <Result state={state}/>}
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
  <fieldset className="stamp-picker-set reward-options">
   <legend>เลือกรางวัลสำหรับรอบนี้</legend>
   {available.map(reward => <label className="reward-option" key={reward.id}>
    <input type="radio" name="reward_id" value={reward.id} required/>
    <span><strong>{reward.title}</strong>{reward.description && <small>{reward.description}</small>}</span>
   </label>)}
  </fieldset>
  <button className="button button--primary" type="submit" disabled={pending || state.status === 'success'}>
   {pending ? 'กำลังส่งคำขอ…' : 'ยืนยันขอรางวัล'}
  </button>
  <Result state={state}/>
 </form>
}


export function ClaimCoupleMemoryForm({spaceId,bookId,cycleId,keyId}:{
 spaceId:string;bookId:string;cycleId:string;keyId:string
}){
 const router=useRouter()
 const [state,action,pending]=useActionState(claimCoupleMemoryAction,idle)
 useEffect(()=>{if(state.status==='success')router.refresh()},[router,state.status])
 return <form action={action} className="stamp-reward-choice">
  <input type="hidden" name="space_id" value={spaceId}/>
  <input type="hidden" name="book_id" value={bookId}/>
  <input type="hidden" name="cycle_id" value={cycleId}/>
  <input type="hidden" name="idempotency_key" value={keyId}/>
  <label className="form-field__label" htmlFor={'couple-memory-'+cycleId}>สมุดเต็มแล้ว! อยากแลกเป็นรางวัลอะไร?</label>
  <textarea id={'couple-memory-'+cycleId} name="reward_message" className="input" rows={3}
   minLength={1} maxLength={1000} placeholder="เช่น อยากไปดูพระอาทิตย์ตกด้วยกันที่ทะเล"
   required/>
  <p className="form-field__hint">เมื่อยืนยัน สมุดนี้จะปิดและเก็บไว้ในความทรงจำ พร้อมแสตมป์และข้อความของคุณ</p>
  <button type="submit" className="button button--primary" disabled={pending||state.status==='success'}>
   {pending?'กำลังแลกรางวัล…':'แลกรางวัลและเก็บสมุด'}
  </button>
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
