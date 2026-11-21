'use client'

import Image from 'next/image'
import {useEffect,useRef,useState,type ChangeEvent,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import {giveLivingStamp,reviewLivingStamp,cancelLivingStampRequest,
  transformLivingStamp,peelLivingStamp,uploadLivingPhoto} from './m03-actions'
import {stampArtwork,type LivingStampMark,type LivingStampRequest} from './stamp-model'
import {emitPaperCue} from './paper-sound'
import type {Point,LivingEditorPage} from './editor-model'
import {stampDraftValid,type StampDraft} from './stamp-gesture'

type Context={spaceId:string;bookId:string;pageId:string}
type OverlayProps={marks:LivingStampMark[];pending:LivingStampRequest[];
  selectedId:string|null;onSelect:(id:string)=>void;selectable:boolean
  freshMarkId?:string|null}
const stampSize=(scale:number)=>12*scale
export function LivingStampOverlay({marks,pending,selectedId,onSelect,selectable,
  freshMarkId}:OverlayProps){
  return <>
    {marks.map(mark=>{
      const artwork=stampArtwork.get(mark.asset_id)
      const peeled=mark.state==='peeled'
      const used=mark.state==='redeemed'
      const reserved=mark.state==='reserved'
      return <button type="button" key={mark.id} data-living-stamp-id={mark.id}
        className="living-real-stamp" data-peeled={peeled}
        data-used={used} data-reserved={reserved} data-stamp-fresh={freshMarkId===mark.id}
        aria-pressed={mark.id===selectedId} disabled={!selectable}
        aria-label={peeled?'รอยแสตมป์ที่ลอกแล้ว':
          used?'แสตมป์แลกแล้ว ใช้ซ้ำไม่ได้':reserved?'แสตมป์จองไว้รอส่งมอบ':
          (artwork?.nameTh??'แสตมป์')+' · ยังใช้ได้ · เลือกเพื่อดูรายละเอียด'}
        title={mark.note??artwork?.nameTh??'แสตมป์'}
        style={{left:mark.position_x*100+'%',top:mark.position_y*100+'%',
          width:stampSize(mark.scale_factor)+'%',
          transform:'translate(-50%,-50%) rotate('+mark.rotation_deg+'deg)'}}
        onClick={()=>onSelect(mark.id)}>
        {artwork&&<Image src={artwork.png} alt="" width={128} height={128}
          className="living-real-stamp__image" draggable={false}/>}
        {peeled&&<span className="living-real-stamp__trace">ลอกแล้ว</span>}
        {used&&<span className="living-real-stamp__used">แลกแล้ว</span>}
        {reserved&&<span className="living-real-stamp__reserved">จองไว้</span>}
      </button>
    })}
    {pending.map(request=>{
      const artwork=stampArtwork.get(request.asset_id)
      return <div key={request.id} className="living-real-stamp living-real-stamp--pending"
        aria-label="แสตมป์รออนุมัติ ไม่เพิ่มยอดสะสม"
        style={{left:request.position_x*100+'%',top:request.position_y*100+'%',
          width:stampSize(request.scale_factor)+'%',
          transform:'translate(-50%,-50%) rotate('+request.rotation_deg+'deg)'}}>
        {artwork&&<Image src={artwork.png} alt="" width={128} height={128} draggable={false}/>}
        <span>รออนุมัติ</span>
      </div>
    })}
  </>
}

export function LivingStampTools({
  spaceId,bookId,pageId,placement,preview,onPreviewChange,
  selectedArtwork,onSelectArtwork,onBeginPlacement,onPlacementAttempt,
  mark,marks,pending,pages,canGive,canEdit,canReview,userId,onComplete,onCancelPlacement,
}:Context&{
  placement:Point|null;preview:StampDraft|null
  onPreviewChange:(next:StampDraft)=>void;selectedArtwork:string
  onSelectArtwork:(id:string)=>void;onBeginPlacement:()=>void
  onPlacementAttempt:()=>void
  mark:LivingStampMark|null;marks:LivingStampMark[]
  pending:LivingStampRequest[];pages:LivingEditorPage[]
  canGive:boolean;canEdit:boolean;canReview:boolean;userId:string
  onComplete:()=>void;onCancelPlacement:()=>void
}){
  const router=useRouter()
  const [note,setNote]=useState('')
  const [key,setKey]=useState('')
  const previouslyPlacing=useRef(false)
  const inFlight=useRef(false)
  const [attempted,setAttempted]=useState(false)
  const [x,setX]=useState(.5),[y,setY]=useState(.5)
  const [angle,setAngle]=useState(0),[scale,setScale]=useState(1)
  const [targetPage,setTargetPage]=useState(pageId)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [confirmPeel,setConfirmPeel]=useState(false)
  const [advancedOpen,setAdvancedOpen]=useState(false)
  useEffect(()=>{
    if(preview&&!previouslyPlacing.current){
      setKey(crypto.randomUUID());setAttempted(false);setNote('');setMessage('')
    }
    previouslyPlacing.current=!!preview
  },[!!preview,pageId])
  useEffect(()=>{
    if(mark){
      setX(mark.position_x);setY(mark.position_y)
      setAngle(mark.rotation_deg);setScale(mark.scale_factor)
      setTargetPage(mark.page_id);setConfirmPeel(false);setAdvancedOpen(false)
    }else if(placement){setTargetPage(pageId)}
    setMessage('')
  },[mark?.id,mark?.version,mark?.position_x,mark?.position_y,
    mark?.rotation_deg,mark?.scale_factor,pageId])
  async function give(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(inFlight.current||!canGive||!preview||!key||!stampDraftValid(preview))return
    inFlight.current=true;setBusy(true);setMessage('')
    setAttempted(true);onPlacementAttempt()
    try{
      const result=await giveLivingStamp({
        spaceId,bookId,pageId,assetId:preview.artId,note,key,
        x:preview.x,y:preview.y,rotation:preview.rotation,scale:preview.scale,
      })
      setMessage(result.message)
      if(result.ok){
        emitPaperCue('stamp')
        // A new key is created for the NEXT intentional issuance only.
        setKey(crypto.randomUUID());setAttempted(false)
        onCancelPlacement();onComplete();router.refresh()
      }
    }catch{
      // In an ambiguous network failure, retry with the SAME idempotency key.
      setMessage('เชื่อมต่อไม่ได้ ลองส่งคำขอเดิมอีกครั้งโดยไม่เปลี่ยนข้อมูล หรือยกเลิกเพื่อเริ่มใหม่')
    }finally{inFlight.current=false;setBusy(false)}
  }
  async function update(){
    if(!canEdit||!mark||mark.state!=='available'||inFlight.current)return
    inFlight.current=true;setBusy(true);setMessage('')
    try{
      const result=await transformLivingStamp({
        spaceId,bookId,markId:mark.id,pageId:targetPage,x,y,
        rotation:angle,scale,expectedVersion:mark.version,
      })
      setMessage(result.message)
      if(result.ok){onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ การเปลี่ยนแปลงยังไม่ถูกบันทึก')}
    finally{inFlight.current=false;setBusy(false)}
  }
  async function peel(){
    if(!canEdit||!mark||mark.state!=='available'||inFlight.current||!confirmPeel)return
    inFlight.current=true;setBusy(true);setMessage('')
    try{
      const result=await peelLivingStamp({
        spaceId,bookId,markId:mark.id,expectedVersion:mark.version,
      })
      setMessage(result.message)
      if(result.ok){
        emitPaperCue('peel');setConfirmPeel(false)
        onComplete();router.refresh()
      }
    }catch{setMessage('เชื่อมต่อไม่ได้ ไม่สามารถลอกแสตมป์ได้')}
    finally{inFlight.current=false;setBusy(false)}
  }
  async function review(requestId:string,approve:boolean){
    if(inFlight.current||!canReview)return
    inFlight.current=true;setBusy(true);setMessage('')
    try{
      const result=await reviewLivingStamp({spaceId,bookId,requestId,approve})
      setMessage(result.message)
      if(result.ok){if(approve)emitPaperCue('stamp');onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ กรุณาลองอนุมัติอีกครั้ง')}
    finally{inFlight.current=false;setBusy(false)}
  }
  async function cancel(requestId:string){
    if(inFlight.current)return
    inFlight.current=true;setBusy(true);setMessage('')
    try{
      const result=await cancelLivingStampRequest({spaceId,bookId,requestId})
      setMessage(result.message)
      if(result.ok){onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ กรุณาลองใหม่')}
    finally{inFlight.current=false;setBusy(false)}
  }
  const available=marks.filter(m=>m.state==='available').length
  const selectedIsEditable=mark?.state==='available'&&canEdit
  return <section className="living-stamp-toolbox living-stamp-tray" aria-label="ถาดแสตมป์และคำขอ">
    {canGive&&!mark&&<div className="living-stamp-tray-catalog">
      <div className="living-stamp-tray-heading">
        <h3>เลือกแสตมป์</h3>
        <small>เลือกลาย แล้วแตะบนกระดาษเพื่อวางตัวอย่าง</small>
      </div>
      <div className="living-stamp-art-grid" role="group" aria-label="เลือกลายแสตมป์">
        {pointPlusStamps.map(art=><button key={art.id} type="button"
          className="living-stamp-art-choice" data-chosen={selectedArtwork===art.id}
          aria-pressed={selectedArtwork===art.id} disabled={busy||attempted}
          onClick={()=>{
            onSelectArtwork(art.id);onBeginPlacement();setMessage('')
          }}>
          <Image src={art.png} alt="" width={70} height={70} draggable={false}/>
          <span>{art.nameTh}</span>
        </button>)}
      </div>
      {!preview&&<p className="living-stamp-tray-help">
        {selectedArtwork?'แตะหน้ากระดาษเพื่อวางแสตมป์ที่เลือก':'เลือกลายแสตมป์ก่อนวาง'}
      </p>}
    </div>}
    {placement&&preview&&canGive&&<form onSubmit={give}
      className="living-stamp-form living-stamp-preview-settings" aria-label="ยืนยันประทับแสตมป์">
      <h4>ตัวอย่างบนกระดาษ <span className="living-stamp-unissued">ยังไม่ประทับจริง</span></h4>
      <p>ลากแสตมป์ตัวอย่างบนกระดาษเพื่อย้ายตำแหน่ง หรือใช้ปุ่มหมุนและขนาดข้างตัวอย่าง</p>
      <label>ข้อความแนบ (ไม่บังคับ)
        <textarea className="input" value={note} maxLength={1000}
          onChange={e=>setNote(e.target.value)} disabled={busy||attempted} rows={2}/>
      </label>
      <details className="living-stamp-precision">
        <summary>ปรับตำแหน่งแบบละเอียด</summary>
        <label>หมุน {preview.rotation}°
          <input type="range" min="-180" max="180" value={preview.rotation}
            disabled={busy||attempted}
            onChange={e=>onPreviewChange({...preview,rotation:Number(e.target.value)})}/>
        </label>
        <label>ขนาด {Math.round(preview.scale*100)}%
          <input type="range" min=".3" max="3" step=".1" value={preview.scale}
            disabled={busy||attempted}
            onChange={e=>onPreviewChange({...preview,scale:Number(e.target.value)})}/>
        </label>
        <p>ตำแหน่ง X {Math.round(preview.x*100)}% · Y {Math.round(preview.y*100)}%</p>
      </details>
      {attempted&&<p role="status">
        คำขอนี้ส่งไปแล้วหรืออาจได้รับการบันทึก กรุณาลองยืนยันซ้ำด้วยรหัสเดิม
        หากต้องเปลี่ยนตำแหน่ง ให้ยกเลิกและเริ่มคำขอใหม่หลังตรวจสอบยอด
      </p>}
      <div className="living-m03-actions">
        <button className="button button--primary" type="submit"
          disabled={busy||!key||!stampDraftValid(preview)}>
          {busy?'กำลังบันทึก…':attempted?'ลองยืนยันคำขอเดิม':'ยืนยันประทับแสตมป์'}
        </button>
        <button type="button" className="button button--secondary" disabled={busy}
          onClick={()=>{
            setAttempted(false);setKey('')
            onCancelPlacement()
          }}>ยกเลิกตัวอย่าง</button>
      </div>
    </form>}
    {mark&&<div className="living-stamp-inspector living-stamp-context">
      <h4>แสตมป์ {stampArtwork.get(mark.asset_id)?.nameTh??mark.asset_id}</h4>
      {mark.note&&<p>“{mark.note}”</p>}
      <p>{mark.state==='peeled'?'ลอกแล้ว · ไม่สามารถใช้แลกรางวัล':
        mark.state==='reserved'?'จองไว้สำหรับคำขอแลกรางวัล · ย้ายและลอกไม่ได้':
        mark.state==='redeemed'?'แลกแล้ว · ไม่สามารถนำไปใช้อีก':'ยังใช้ได้'}</p>
      {selectedIsEditable&&<>
        <div className="living-m03-actions">
          <button type="button" className="button button--secondary"
            aria-expanded={advancedOpen} disabled={busy}
            onClick={()=>setAdvancedOpen(value=>!value)}>จัดตำแหน่ง / ย้ายหน้า</button>
          <button type="button" className="button button--secondary"
            aria-expanded={confirmPeel} disabled={busy}
            onClick={()=>setConfirmPeel(value=>!value)}>ลอกแสตมป์</button>
        </div>
        {advancedOpen&&<div className="living-stamp-precision">
          <label>หน้า
            <select className="input" disabled={busy} value={targetPage}
              onChange={e=>setTargetPage(e.target.value)}>
              {pages.map((p,i)=><option value={p.id} key={p.id}>
                {i+1} · {p.title??'หน้ากระดาษ'}
              </option>)}
            </select>
          </label>
          <label>ตำแหน่งแนวนอน {Math.round(x*100)}%
            <input type="range" min="0" max="1" step=".01" value={x}
              disabled={busy} onChange={e=>setX(Number(e.target.value))}/>
          </label>
          <label>ตำแหน่งแนวตั้ง {Math.round(y*100)}%
            <input type="range" min="0" max="1" step=".01" value={y}
              disabled={busy} onChange={e=>setY(Number(e.target.value))}/>
          </label>
          <label>หมุน {angle}°
            <input type="range" min="-180" max="180" value={angle} disabled={busy}
              onChange={e=>setAngle(Number(e.target.value))}/>
          </label>
          <label>ขนาด {Math.round(scale*100)}%
            <input type="range" min=".3" max="3" step=".1" value={scale}
              disabled={busy} onChange={e=>setScale(Number(e.target.value))}/>
          </label>
          <button type="button" className="button button--primary"
            disabled={busy} onClick={()=>void update()}>บันทึกการจัดวาง</button>
        </div>}
        {confirmPeel&&<div className="living-stamp-peel-confirm" role="group"
          aria-label="ยืนยันการลอกแสตมป์">
          <strong>ต้องการลอกแสตมป์ดวงนี้ใช่ไหม?</strong>
          <p>แสตมป์จะใช้แลกรางวัลไม่ได้อีก ร่องรอยและประวัติการลอกจะคงอยู่ตลอด</p>
          <label className="living-m03-peel-confirm">
            <input type="checkbox" checked={confirmPeel} disabled={busy}
              onChange={e=>setConfirmPeel(e.target.checked)}/>
            ฉันเข้าใจว่าจะไม่คืนยอดแสตมป์
          </label>
          <div className="living-m03-actions">
            <button type="button" className="button button--secondary"
              disabled={busy} onClick={()=>setConfirmPeel(false)}>ไม่ลอก</button>
            <button type="button" className="button button--primary"
              disabled={busy||!confirmPeel} onClick={()=>void peel()}>
              ยืนยันลอกแสตมป์
            </button>
          </div>
        </div>}
      </>}
    </div>}
    {pending.length>0&&<div className="living-stamp-pending">
      <h4>รายการรออนุมัติ ({pending.length})</h4>
      {pending.map(r=><div key={r.id} className="living-stamp-pending__item">
        <span>{stampArtwork.get(r.asset_id)?.nameTh??r.asset_id}
          {r.note?' — '+r.note:''}</span>
        {canReview&&r.giver_user_id!==userId&&<div>
          <button type="button" className="button button--secondary" disabled={busy}
            onClick={()=>void review(r.id,true)}>อนุมัติ</button>
          <button type="button" className="button button--secondary" disabled={busy}
            onClick={()=>void review(r.id,false)}>ปฏิเสธ</button>
        </div>}
        {r.giver_user_id===userId&&<button type="button"
          className="button button--secondary" disabled={busy}
          onClick={()=>void cancel(r.id)}>ยกเลิกคำขอ</button>}
      </div>)}
    </div>}
    {message&&<p role="status" className="living-m03-feedback">{message}</p>}
    <small className="living-stamp-ledger-note">หน้านี้: ใช้ได้ {available} ดวง ·
      จองอยู่ {marks.filter(m=>m.state==='reserved').length} ·
      แลกแล้ว {marks.filter(m=>m.state==='redeemed').length} ·
      ลอกแล้ว {marks.filter(m=>m.state==='peeled').length}
    </small>
  </section>
}

/** Browser optimization: resize overly large images before upload, preserving alpha. */
export async function preparePhotoForUpload(file:File):Promise<File>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))
    throw new Error('รองรับเฉพาะรูป JPEG, PNG และ WebP')
  if(file.size>30*1024*1024)
    throw new Error('ไฟล์รูปภาพต้นฉบับใหญ่เกิน 30 MB')
  try{
    const bitmap=await createImageBitmap(file)
    const maxSide=Math.max(bitmap.width,bitmap.height)
    if(maxSide<=2048&&file.size<=6*1024*1024){bitmap.close();return file}
    const ratio=Math.min(1,2048/maxSide)
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio))
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio))
    const ctx=canvas.getContext('2d')
    if(!ctx){bitmap.close();return file}
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
    bitmap.close()
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.86))
    if(blob&&blob.size<=6*1024*1024)
      return new File([blob],'memory.webp',{type:'image/webp'})
  }catch{/* Original image remains subject to server-side binary validation. */}
  if(file.size>6*1024*1024)
    throw new Error('รูปภาพเกิน 6 MB หลังปรับขนาด')
  return file
}
export function LivingPhotoUpload({spaceId,bookId,pageId,onDone,disabled}:Context&{
  onDone:()=>void;disabled:boolean
}){
  const router=useRouter()
  const input=useRef<HTMLInputElement>(null)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  async function handle(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file||disabled||busy)return
    setBusy(true);setMessage('')
    try {
      const prepared=await preparePhotoForUpload(file)
      const data=new FormData()
      data.set('space_id',spaceId);data.set('book_id',bookId);data.set('page_id',pageId)
      data.set('photo',prepared)
      const result=await uploadLivingPhoto(data)
      setMessage(result.message)
      if(result.ok){onDone();router.refresh()}
    }catch(e){setMessage(e instanceof Error?e.message:'ไม่สามารถเพิ่มรูปภาพได้')}
    finally{setBusy(false);if(input.current)input.current.value=''}
  }
  return <div className="living-m03-upload">
    <label className="button button--secondary" aria-disabled={disabled||busy}>
      {busy?'กำลังอัปโหลด…':'＋ ติดรูปภาพ'}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp"
        disabled={disabled||busy} onChange={handle} className="living-m03-upload__input"/>
    </label>
    {message&&<p role="status">{message}</p>}
  </div>
}
