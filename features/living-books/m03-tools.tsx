'use client'

import Image from 'next/image'
import {useEffect,useRef,useState,type ChangeEvent,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import {giveLivingStamp,reviewLivingStamp,cancelLivingStampRequest,
  transformLivingStamp,peelLivingStamp,uploadLivingPhoto} from './m03-actions'
import {stampArtwork,type LivingStampMark,type LivingStampRequest} from './stamp-model'
import type {Point,LivingEditorPage} from './editor-model'

type Context={spaceId:string;bookId:string;pageId:string}
type OverlayProps={marks:LivingStampMark[];pending:LivingStampRequest[];
  selectedId:string|null;onSelect:(id:string)=>void;selectable:boolean}
const stampSize=(scale:number)=>12*scale
export function LivingStampOverlay({marks,pending,selectedId,onSelect,selectable}:OverlayProps){
  return <>
    {marks.map(mark=>{
      const artwork=stampArtwork.get(mark.asset_id)
      const peeled=mark.state==='peeled'
      const used=mark.state==='redeemed'
      const reserved=mark.state==='reserved'
      return <button type="button" key={mark.id} data-living-stamp-id={mark.id}
        className="living-real-stamp" data-peeled={peeled}
        data-used={used} data-reserved={reserved}
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
  spaceId,bookId,pageId,placement,mark,marks,pending,
  pages,canGive,canEdit,canReview,userId,onComplete,onCancelPlacement,
}:Context&{
  placement:Point|null;mark:LivingStampMark|null;marks:LivingStampMark[];
  pending:LivingStampRequest[];pages:LivingEditorPage[];
  canGive:boolean;canEdit:boolean;canReview:boolean;userId:string;
  onComplete:()=>void;onCancelPlacement:()=>void;
}){
  const router=useRouter()
  const [art,setArt]=useState(pointPlusStamps[0].id)
  const [note,setNote]=useState('')
  const [key,setKey]=useState('')
  const [x,setX]=useState(.5),[y,setY]=useState(.5)
  const [angle,setAngle]=useState(0),[scale,setScale]=useState(1)
  const [targetPage,setTargetPage]=useState(pageId)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [confirmPeel,setConfirmPeel]=useState(false)
  useEffect(()=>{
    setKey(crypto.randomUUID())
  },[placement?.x,placement?.y,pageId])
  useEffect(()=>{
    if(mark){
      setX(mark.position_x);setY(mark.position_y)
      setAngle(mark.rotation_deg);setScale(mark.scale_factor)
      setTargetPage(mark.page_id);setConfirmPeel(false)
    }
    else if(placement){setX(placement.x);setY(placement.y);setTargetPage(pageId)}
    setMessage('')
  },[mark?.id,mark?.version,mark?.position_x,mark?.position_y,
    mark?.rotation_deg,mark?.scale_factor,placement?.x,placement?.y,pageId])
  async function give(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy||!canGive||!placement||!key)return
    setBusy(true);setMessage('')
    try{
      const result=await giveLivingStamp({
        spaceId,bookId,pageId,assetId:art,note,key,x,y,
        rotation:angle,scale,
      })
      setMessage(result.message)
      if(result.ok){setKey(crypto.randomUUID());onCancelPlacement();onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้งโดยไม่เปลี่ยนข้อมูลคำขอ')}
    finally{setBusy(false)}
  }
  async function update(){
    if(!canEdit||!mark||busy)return
    setBusy(true);setMessage('')
    try{
      const result=await transformLivingStamp({
        spaceId,bookId,markId:mark.id,pageId:targetPage,x,y,
        rotation:angle,scale,expectedVersion:mark.version,
      })
      setMessage(result.message)
      if(result.ok){onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ การเปลี่ยนแปลงยังไม่ถูกบันทึก')}
    finally{setBusy(false)}
  }
  async function peel(){
    if(!canEdit||!mark||busy||!confirmPeel)return
    setBusy(true);setMessage('')
    try{
      const result=await peelLivingStamp({
        spaceId,bookId,markId:mark.id,expectedVersion:mark.version,
      })
      setMessage(result.message)
      if(result.ok){setConfirmPeel(false);onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ ไม่สามารถลอกแสตมป์ได้')}
    finally{setBusy(false)}
  }
  async function review(requestId:string,approve:boolean){
    if(busy)return
    setBusy(true);setMessage('')
    try{
      const result=await reviewLivingStamp({spaceId,bookId,requestId,approve})
      setMessage(result.message)
      if(result.ok){onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ กรุณาลองอนุมัติอีกครั้ง')}
    finally{setBusy(false)}
  }
  async function cancel(requestId:string){
    if(busy)return
    setBusy(true);setMessage('')
    try{
      const result=await cancelLivingStampRequest({spaceId,bookId,requestId})
      setMessage(result.message)
      if(result.ok){onComplete();router.refresh()}
    }catch{setMessage('เชื่อมต่อไม่ได้ กรุณาลองใหม่')}
    finally{setBusy(false)}
  }
  const available=marks.filter(m=>m.state==='available').length
  const selectedIsEditable=mark?.state==='available'&&canEdit
  return <section className="living-stamp-toolbox" aria-label="แสตมป์และประวัติการสะสม">
    <header>
      <h3>แสตมป์ของเล่มนี้</h3>
      <p>บนหน้านี้: ใช้ได้ {available} ดวง · จองอยู่ {marks.filter(m=>m.state==='reserved').length} ดวง · แลกแล้ว {marks.filter(m=>m.state==='redeemed').length} ดวง · ลอกแล้ว {marks.filter(m=>m.state==='peeled').length} ดวง
        {pending.length>0?' · รออนุมัติ '+pending.length+' ดวง':''}</p>
    </header>
    {placement&&canGive&&<form onSubmit={give} className="living-stamp-form">
      <h4>เลือกแสตมป์ที่จะแปะลงกระดาษ</h4>
      <label>ลายแสตมป์
        <select className="input" value={art} disabled={busy}
          onChange={e=>setArt(e.target.value)}>
          {pointPlusStamps.map(a=><option key={a.id} value={a.id}>{a.nameTh}</option>)}
        </select>
      </label>
      <label>ข้อความแนบ (ไม่บังคับ)
        <textarea className="input" value={note} maxLength={1000}
          onChange={e=>setNote(e.target.value)} disabled={busy} rows={2}/>
      </label>
      <label>หมุน {angle}°
        <input type="range" min="-180" max="180" value={angle} disabled={busy}
          onChange={e=>setAngle(Number(e.target.value))}/>
      </label>
      <label>ขนาดแสตมป์ {Math.round(scale*100)}%
        <input type="range" min="0.3" max="3" step="0.1" value={scale}
          disabled={busy} onChange={e=>setScale(Number(e.target.value))}/>
      </label>
      <p>ตำแหน่งที่เลือก X {Math.round(x*100)}% · Y {Math.round(y*100)}%</p>
      <div className="living-m03-actions">
        <button className="button button--primary" type="submit" disabled={busy||!key}>
          {busy?'กำลังบันทึก…':'ยืนยันแปะแสตมป์'}
        </button>
        <button type="button" className="button button--secondary" disabled={busy}
          onClick={onCancelPlacement}>ยกเลิก</button>
      </div>
    </form>}
    {mark&&<div className="living-stamp-inspector">
      <h4>แสตมป์ {stampArtwork.get(mark.asset_id)?.nameTh??mark.asset_id}</h4>
      {mark.note&&<p>“{mark.note}”</p>}
      <p>{mark.state==='peeled'?'ลอกแล้ว · ไม่สามารถใช้แลกรางวัล':
        mark.state==='reserved'?'จองไว้สำหรับคำขอแลกรางวัล · ย้ายและลอกไม่ได้':
        mark.state==='redeemed'?'แลกแล้ว · ไม่สามารถนำไปใช้อีก':'ยังใช้ได้'}</p>
      {selectedIsEditable&&<>
        <label>หน้า
          <select className="input" disabled={busy} value={targetPage}
            onChange={e=>setTargetPage(e.target.value)}>
            {pages.map((p,i)=><option value={p.id} key={p.id}>{i+1} · {p.title??'หน้ากระดาษ'}</option>)}
          </select>
        </label>
        <label>ตำแหน่งแนวนอน {Math.round(x*100)}%
          <input type="range" min="0" max="1" step=".01" value={x} disabled={busy}
            onChange={e=>setX(Number(e.target.value))}/>
        </label>
        <label>ตำแหน่งแนวตั้ง {Math.round(y*100)}%
          <input type="range" min="0" max="1" step=".01" value={y} disabled={busy}
            onChange={e=>setY(Number(e.target.value))}/>
        </label>
        <label>หมุน {angle}°
          <input type="range" min="-180" max="180" value={angle} disabled={busy}
            onChange={e=>setAngle(Number(e.target.value))}/>
        </label>
        <label>ขนาด {Math.round(scale*100)}%
          <input type="range" min=".3" max="3" step=".1" value={scale} disabled={busy}
            onChange={e=>setScale(Number(e.target.value))}/>
        </label>
        <div className="living-m03-actions">
          <button type="button" className="button button--primary" disabled={busy}
            onClick={()=>void update()}>บันทึกตำแหน่งแสตมป์</button>
          <label className="living-m03-peel-confirm">
            <input type="checkbox" checked={confirmPeel} disabled={busy}
              onChange={e=>setConfirmPeel(e.target.checked)}/> ยืนยันการลอกแสตมป์ (ไม่คืนยอด)
          </label>
          <button type="button" className="button button--secondary"
            disabled={busy||!confirmPeel} onClick={()=>void peel()}>ลอกแสตมป์</button>
        </div>
      </>}
    </div>}
    {pending.length>0&&<div className="living-stamp-pending">
      <h4>รายการรออนุมัติ</h4>
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
