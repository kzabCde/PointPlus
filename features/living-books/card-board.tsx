'use client'

import Image from 'next/image'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import {giveLivingStamp,reviewLivingStamp,cancelLivingStampRequest} from './m03-actions'
import type {LivingStampMark,LivingStampRequest} from './stamp-model'

export function cardGrid(target:number){
  const columns=Math.min(5,Math.ceil(Math.sqrt(target)))
  const rows=Math.ceil(target/columns)
  return {columns,rows}
}

function slotNumber(x:number,y:number,target:number){
  const {columns,rows}=cardGrid(target)
  const column=Math.floor(x*columns),row=Math.floor(y*rows)
  const slot=row*columns+column+1
  return slot>=1&&slot<=target?slot:null
}

export function LivingCardBoard({spaceId,bookId,pageId,target,reward,marks,requests,
  canGive,canReview,userId,active}:{
  spaceId:string;bookId:string;pageId:string;target:number;reward:string
  marks:LivingStampMark[];requests:LivingStampRequest[]
  canGive:boolean;canReview:boolean;userId:string;active:boolean
}){
  const router=useRouter()
  const {columns,rows}=cardGrid(target)
  const [selected,setSelected]=useState<number|null>(null)
  const sheetRef=useRef<HTMLElement|null>(null)
  const submitLock=useRef(false)
  const [asset,setAsset]=useState(pointPlusStamps[0].id)
  const [note,setNote]=useState('')
  const [key,setKey]=useState('')
  const [attempted,setAttempted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [feedback,setFeedback]=useState('')
  useEffect(()=>setKey(crypto.randomUUID()),[])
  useEffect(()=>{
    if(selected===null)return
    const previouslyFocused=document.activeElement as HTMLElement|null
    const beforeOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    sheetRef.current?.focus()
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault()
        if(!attempted&&!submitLock.current)setSelected(null)
      } else if(event.key==='Tab'){
        const sheet=sheetRef.current
        if(!sheet)return
        const focusable=Array.from(sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),'+
          'select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )).filter(node=>node.getClientRects().length>0)
        if(focusable.length===0){event.preventDefault();sheet.focus();return}
        const first=focusable[0],last=focusable[focusable.length-1]
        if(!sheet.contains(document.activeElement)){
          event.preventDefault();(event.shiftKey?last:first).focus()
        }else if(event.shiftKey&&document.activeElement===first){
          event.preventDefault();last.focus()
        }else if(!event.shiftKey&&document.activeElement===last){
          event.preventDefault();first.focus()
        }
      }
    }
    document.addEventListener('keydown',onKey,true)
    return ()=>{
      document.removeEventListener('keydown',onKey,true)
      document.body.style.overflow=beforeOverflow
      if(previouslyFocused?.isConnected)previouslyFocused.focus()
    }
  },[selected,attempted])
  const marksBySlot=new Map<number,LivingStampMark>()
  for(const mark of marks){
    const slot=slotNumber(Number(mark.position_x),Number(mark.position_y),target)
    if(slot)marksBySlot.set(slot,mark)
  }
  const pendingBySlot=new Map<number,LivingStampRequest>()
  for(const request of requests){
    const slot=slotNumber(Number(request.position_x),Number(request.position_y),target)
    if(slot)pendingBySlot.set(slot,request)
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!active||!canGive||!selected||busy||!key||submitLock.current)return
    if(marksBySlot.has(selected)||pendingBySlot.has(selected))return
    submitLock.current=true
    setBusy(true);setAttempted(true);setFeedback('')
    const index=selected-1
    const x=Number(((index%columns+0.5)/columns).toFixed(4))
    const y=Number(((Math.floor(index/columns)+0.5)/rows).toFixed(4))
    try {
      const result=await giveLivingStamp({
        spaceId,bookId,pageId,assetId:asset,note,key,x,y,rotation:0,scale:0.7,
      })
      setFeedback(result.message)
      if(result.ok){
        setSelected(null);setAttempted(false);setNote('')
        setKey(crypto.randomUUID())
        router.refresh()
      }else if(result.conflict){router.refresh()}
    } catch {
      setFeedback('ยังไม่ทราบผลการส่งคำขอ กรุณาตรวจสอบสมุดแล้วลองซ้ำด้วยข้อมูลเดิม')
    } finally {submitLock.current=false;setBusy(false)}
  }
  async function review(requestId:string,approve:boolean){
    if(busy||!canReview)return
    setBusy(true);setFeedback('')
    try{
      const result=await reviewLivingStamp({spaceId,bookId,requestId,approve})
      setFeedback(result.message)
      if(result.ok||result.conflict)router.refresh()
    }catch{setFeedback('ตรวจคำขอไม่สำเร็จ โปรดลองอีกครั้ง')}
    finally{setBusy(false)}
  }
  async function cancel(requestId:string){
    if(busy)return
    setBusy(true);setFeedback('')
    try{
      const result=await cancelLivingStampRequest({spaceId,bookId,requestId})
      setFeedback(result.message)
      if(result.ok)router.refresh()
    }catch{setFeedback('ไม่สามารถยกเลิกคำขอได้ในขณะนี้')}
    finally{setBusy(false)}
  }

  return <section className="living-card-sheet" aria-label="การ์ดสะสมแบบแตะช่อง">
    <header className="living-card-heading">
      <p className="living-card-progress" role="status">
        <strong>{marksBySlot.size}</strong> / {target} ดวง
      </p>
      <p className="living-card-reward">ครบแล้วแลก: <strong>{reward}</strong></p>
      {canGive&&active&&<p className="living-card-hint">แตะช่องว่างเพื่อเลือกแสตมป์</p>}
    </header>

    <div className="living-card-slots" role="group" aria-label="ช่องสะสมแสตมป์"
      style={{gridTemplateColumns:'repeat('+columns+',minmax(0,1fr))'}}>
      {Array.from({length:target},(_,index)=>{
        const slot=index+1
        const mark=marksBySlot.get(slot)
        const pending=pendingBySlot.get(slot)
        const art=mark&&pointPlusStamps.find(a=>a.id===mark.asset_id)
        const label=mark?'ช่อง '+slot+': '+(mark.state==='peeled'?'ลอกแล้ว':
          mark.state==='redeemed'?'แลกแล้ว':mark.state==='reserved'?'จองแลกแล้ว':'ได้รับแสตมป์'):
          pending?'ช่อง '+slot+': รออนุมัติ':'ช่อง '+slot+': ว่าง'
        const disabled=!canGive||!active||!!mark||!!pending||busy||attempted
        return <button type="button" key={slot}
          className="living-card-slot" data-state={mark?.state??(pending?'pending':'empty')}
          aria-label={label} aria-pressed={selected===slot}
          disabled={disabled}
          onClick={()=>{setSelected(slot);setAsset(pointPlusStamps[0].id);setFeedback('')}}>
          <span className="living-card-slot-number" aria-hidden="true">{slot}</span>
          {art?<Image src={art.png} alt="" width={62} height={62}/>:
            <span className="living-card-empty-glyph" aria-hidden="true">{pending?'⌛':'✳'}</span>}
          {mark&&mark.state!=='available'&&
            <small className="living-card-slot-state">{mark.state==='peeled'?'ลอกแล้ว':'ใช้แล้ว'}</small>}
          {pending&&<small className="living-card-slot-state">รออนุมัติ</small>}
        </button>
      })}
    </div>

    {requests.length>0&&<details className="living-card-requests">
      <summary>คำขอแสตมป์ที่รออนุมัติ ({requests.length})</summary>
      {requests.map(request=><div className="living-card-request" key={request.id}>
        <p>ช่อง {slotNumber(Number(request.position_x),Number(request.position_y),target)??'?'}
          {' · '}{pointPlusStamps.find(a=>a.id===request.asset_id)?.nameTh??'แสตมป์'}</p>
        {canReview&&<div className="living-card-request-actions">
          <button className="button button--primary" type="button" disabled={busy}
            onClick={()=>void review(request.id,true)}>อนุมัติ</button>
          <button className="button button--secondary" type="button" disabled={busy}
            onClick={()=>void review(request.id,false)}>ปฏิเสธ</button>
        </div>}
        {request.giver_user_id===userId&&<button className="button button--secondary"
          type="button" disabled={busy} onClick={()=>void cancel(request.id)}>
          ยกเลิกคำขอ
        </button>}
      </div>)}
    </details>}

    {feedback&&<p className="living-card-feedback" role="status">{feedback}</p>}
    {selected!==null&&canGive&&active&&<div className="living-card-overlay">
      <button type="button" className="living-card-backdrop" tabIndex={-1}
        aria-label="ปิดถาดเลือกแสตมป์"
        disabled={busy||attempted} onClick={()=>setSelected(null)}/>
      <section ref={sheetRef} role="dialog" aria-modal="true" tabIndex={-1}
        aria-labelledby="living-card-dialog-heading" className="living-card-tray">
        <header className="living-card-tray-title">
          <div>
            <small>STAMP / {selected.toString().padStart(2,'0')}</small>
            <h3 id="living-card-dialog-heading">แสตมป์ช่อง {selected}</h3>
          </div>
          <button type="button" className="living-reader-close"
            aria-label="ปิดถาดเลือกแสตมป์"
            disabled={busy||attempted} onClick={()=>setSelected(null)}>✕</button>
        </header>
        <form onSubmit={event=>void submit(event)} className="living-card-stamp-form">
          <fieldset disabled={busy||attempted}>
            <legend>เลือกลายแสตมป์</legend>
            <div className="living-card-art-tray">
              {pointPlusStamps.map(art=><button type="button" key={art.id}
                className="living-card-art-choice" aria-label={art.nameTh}
                aria-pressed={asset===art.id} onClick={()=>setAsset(art.id)}>
                <Image src={art.png} alt="" width={64} height={64}/>
                <span>{art.nameTh}</span>
              </button>)}
            </div>
            <label className="living-card-note">ข้อความสั้น ๆ (ไม่บังคับ)
              <textarea className="input" rows={2} maxLength={1000}
                value={note} onChange={event=>setNote(event.target.value)}/>
            </label>
          </fieldset>
          {attempted&&<p role="status" className="living-card-retry-note">
            คำขอนี้อาจถึงระบบแล้ว ลองยืนยันซ้ำด้วยรหัสเดิม หรือตรวจสอบสถานะก่อนเริ่มใหม่
          </p>}
          {feedback&&<p role="status" className="living-card-feedback">{feedback}</p>}
          <div className="living-card-tray-actions">
            {!attempted&&<button type="button" className="button button--secondary"
              disabled={busy} onClick={()=>setSelected(null)}>กลับไปที่การ์ด</button>}
            <button className="button button--primary" type="submit" disabled={busy||!key}>
              {busy?'กำลังประทับ…':attempted?'ลองยืนยันคำขอเดิม':'ยืนยันให้แสตมป์'}
            </button>
            {attempted&&<button type="button" className="button button--secondary"
              disabled={busy} onClick={()=>{
                if(!window.confirm('ตรวจสอบสถานะช่องและประวัติแล้วใช่ไหม? คำขอใหม่อาจทำรายการซ้ำได้'))return
                setKey(crypto.randomUUID());setAttempted(false);setNote('');setSelected(null)
                router.refresh()
              }}>ตรวจสอบแล้ว ปิดคำขอนี้</button>}
          </div>
        </form>
      </section>
    </div>}
  </section>
}
