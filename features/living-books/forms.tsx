'use client'

import {useActionState,useEffect,useRef,useState,useTransition,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import type {CreationRecipient} from './creation-data'
import {captureCreationIntent,restoreCreationIntent,intentFormData,creationIntentVersion,
  type CreationFormat,type CreationIntent} from './creation-intent'
import {
  createLivingBookAction,createLivingCardAction,addLivingBookPageAction,type LivingActionState,
} from './actions'

const livingIdle: LivingActionState={status:'idle',message:''}

type CreationProps={
  spaceId:string;userId:string;kind:string;participants:CreationRecipient[]
}
export function CollectionCreationChoice(props:CreationProps){
  const [format,setFormat]=useState<CreationFormat>('living')
  return <div className="living-creator living-fast-creator">
    <fieldset className="stamp-format-picker">
      <legend>เลือกรูปแบบ</legend>
      <div className="stamp-format-options">
        <label className="stamp-format-option" data-selected={format==='living'}>
          <input type="radio" name="top_level_format" value="living"
            checked={format==='living'} onChange={()=>setFormat('living')}/>
          <strong>สมุดความทรงจำ</strong>
          <span>เขียนและติดรูปภาพลงกระดาษ</span>
        </label>
        <label className="stamp-format-option" data-selected={format==='card'}>
          <input type="radio" name="top_level_format" value="card"
            checked={format==='card'} onChange={()=>setFormat('card')}/>
          <strong>การ์ดสะสม</strong>
          <span>สะสมแสตมป์ให้ครบเพื่อแลกรางวัล</span>
        </label>
      </div>
    </fieldset>
    <CreateLivingBookForm key={format} {...props} format={format}/>
  </div>
}

export function CreateLivingBookForm({spaceId,userId,kind,participants,format='living'}:
  CreationProps&{format?:CreationFormat}){
  const router=useRouter()
  const [state,action,pending]=useActionState(format==='card'?createLivingCardAction:createLivingBookAction,livingIdle)
  const [,startTransition]=useTransition()
  const [key,setKey]=useState('')
  const [intent,setIntent]=useState<CreationIntent|null>(null)
  const submitLock=useRef(false)
  const storageKey='pointplus:create:v'+creationIntentVersion+':'+userId+':'+spaceId+':'+format
  const available=participants.filter(p=>kind!=='couple'||
    (p.kind==='adult'&&p.user_id&&p.user_id!==userId))
  const suggestedCover=pointPlusStamps.find(stamp=>stamp.mode===kind)?.id??
    pointPlusStamps[0].id
  const availableArt=pointPlusStamps.filter(stamp=>stamp.mode===kind)
  const covers=availableArt.length?availableArt:pointPlusStamps

  useEffect(()=>{
    try{
      const saved=sessionStorage.getItem(storageKey)
      if(saved){
        const candidate=restoreCreationIntent(saved,format,spaceId)
        if(candidate){setIntent(candidate);setKey(candidate.key);return}
      }
    }catch{/* Private mode: keep in-memory request identity. */}
    setKey(crypto.randomUUID())
  },[storageKey,format,spaceId])

  useEffect(()=>{
    if(state.status==='success'&&state.bookId){
      try{sessionStorage.removeItem(storageKey)}catch{}
      setIntent(null)
      router.replace('/s/'+spaceId+'/stamp-books/living/'+state.bookId)
    }
  },[state.status,state.bookId,router,spaceId,storageKey])

  useEffect(()=>{
    if(!pending)submitLock.current=false
  },[pending,state])

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!key||pending||submitLock.current||state.status==='success')return

    // For retries, never read possibly edited fields from the live form.
    // The original payload (including recipient/target/reward/cover) is frozen.
    const payload=intent?intentFormData(intent):new FormData(event.currentTarget)
    let command=intent
    if(!command){
      payload.set('idempotency_key',key)
      command=captureCreationIntent(format,key,payload)
      try{sessionStorage.setItem(storageKey,JSON.stringify(command))}catch{}
      setIntent(command)
    }
    submitLock.current=true
    startTransition(()=>{action(payload)})
  }

  function abandonAfterChecking(){
    if(pending||!intent)return
    if(!window.confirm('โปรดตรวจสอบหน้ารวมสมุดว่ารายการเดิมไม่ได้ถูกสร้างไว้แล้ว '+
      'การเริ่มคำขอใหม่อาจสร้างสมุดหรือการ์ดซ้ำได้ ยืนยันว่าได้ตรวจสอบแล้วหรือไม่?'))return
    try{sessionStorage.removeItem(storageKey)}catch{}
    setIntent(null);setKey(crypto.randomUUID())
    submitLock.current=false
  }

  if(!available.length)return <div className="card empty-state">
    <h3>ยังไม่มีผู้รับแสตมป์ในห้อง</h3>
    <p>เชิญสมาชิกอีกคนให้เข้าร่วมห้องก่อนสร้างสมุดความทรงจำ</p>
    <a className="button button--secondary" href={'/s/'+spaceId+'/members'}>ดูสมาชิกในห้อง</a>
  </div>

  return <form onSubmit={submit} className="card living-creation-form living-fast-creation-form">
    <h3>{format==='card'?'การ์ดสะสมใบใหม่':'สมุดความทรงจำเล่มใหม่'}</h3>
    {intent?<>
      <div className="living-fast-creation-pending" role="status">
        <strong>กำลังตรวจสอบคำขอเดิม</strong>
        <p>ระบบจะลองส่งข้อมูลเดิมด้วยรหัสเดิม ไม่สร้างคำขอใหม่เพื่อป้องกันสมุดซ้ำ</p>
        <dl>
          <dt>ชื่อ</dt><dd>{intent.fields.title}</dd>
          <dt>ผู้รับ</dt><dd>{available.find(p=>p.id===intent.fields.recipient_id)?.display_name??'ผู้รับเดิม'}</dd>
          {format==='card'&&<>
            <dt>จำนวนช่อง</dt><dd>{intent.fields.target_count}</dd>
            <dt>รางวัล</dt><dd>{intent.fields.reward_title}</dd>
          </>}
        </dl>
      </div>
    </>:<>
      <input type="hidden" name="space_id" value={spaceId}/>
      <input type="hidden" name="idempotency_key" value={key}/>
      <label htmlFor="living-book-title">ชื่อ{format==='card'?'การ์ด':'สมุด'}
        <input className="input" id="living-book-title" name="title" required
          maxLength={160} autoFocus placeholder="เช่น ความสุขเล็ก ๆ ของเรา"/>
      </label>
      {available.length===1&&kind==='couple'?<>
        <input type="hidden" name="recipient_id" value={available[0].id}/>
        <p className="living-fast-recipient">สำหรับ {available[0].display_name}</p>
      </>:<label htmlFor="living-book-recipient">คนที่จะได้รับแสตมป์
        <select className="input" id="living-book-recipient" name="recipient_id" required
          defaultValue={available[0]?.id}>
          {available.map(person=><option value={person.id} key={person.id}>
            {person.display_name}
          </option>)}
        </select>
      </label>}
      {format==='card'&&<>
        <label htmlFor="living-card-target">จำนวนช่อง
          <input id="living-card-target" className="input" type="number" name="target_count"
            min={1} max={100} step={1} defaultValue={6} required/>
        </label>
        <label htmlFor="living-card-reward">รางวัลเมื่อสะสมครบ
          <input id="living-card-reward" className="input" name="reward_title"
            maxLength={160} placeholder="เช่น ไปปิกนิกด้วยกัน" required/>
        </label>
      </>}
      {kind==='couple'&&<input type="hidden" name="approval_policy" value="direct"/>}
      <details className="living-fast-creation-advanced">
        <summary>ตกแต่งเพิ่มเติม (ไม่บังคับ)</summary>
        <div className="living-fast-creation-advanced-content">
          <label htmlFor="living-book-description">คำอธิบาย
            <textarea className="input" id="living-book-description" name="description"
              maxLength={2000} rows={2}/>
          </label>
          <label htmlFor="living-book-cover">ภาพปก
            <select className="input" id="living-book-cover" defaultValue={suggestedCover}
              name="cover_asset_id">
              {covers.map(stamp=><option key={stamp.id} value={stamp.id}>{stamp.nameTh}</option>)}
            </select>
          </label>
          {kind!=='couple'&&<label htmlFor="living-book-approval">การให้แสตมป์
            <select className="input" id="living-book-approval"
              name="approval_policy" defaultValue="direct">
              <option value="direct">ให้ได้ทันที</option>
              <option value="approval_required">ต้องอนุมัติ</option>
            </select>
          </label>}
        </div>
      </details>
    </>}
    {state.status==='error'&&intent&&
      <p role="alert" className="form-field__error">{state.message}</p>}
    <button className="button button--primary" type="submit"
      disabled={!key||pending||state.status==='success'}>
      {pending?'กำลังสร้าง…':intent?'ตรวจสอบคำขอเดิม':
        format==='card'?'สร้างการ์ดสะสม':'สร้างสมุดความทรงจำ'}
    </button>
    {intent&&!pending&&<button type="button" className="button button--secondary"
      onClick={abandonAfterChecking}>
      ตรวจสอบหน้ารวมแล้ว เริ่มรายการใหม่
    </button>}
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
