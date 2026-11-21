'use client'

import Image from 'next/image'
import {useEffect,useState,type FormEvent} from 'react'
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
  const [asset,setAsset]=useState(pointPlusStamps[0].id)
  const [note,setNote]=useState('')
  const [key,setKey]=useState('')
  const [attempted,setAttempted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [feedback,setFeedback]=useState('')
  useEffect(()=>setKey(crypto.randomUUID()),[])
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
  const occupied=marksBySlot.size+Array.from(pendingBySlot.keys()).filter(slot=>!marksBySlot.has(slot)).length

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!active||!canGive||!selected||busy||!key)return
    if(marksBySlot.has(selected)||pendingBySlot.has(selected))return
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
    } finally {setBusy(false)}
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

  return <section className="card" aria-label="การ์ดสะสมช่องหมายเลข">
    <header>
      <h3>การ์ดสะสม {occupied} / {target} ช่อง</h3>
      <p>รางวัลเมื่อครบ: <strong>{reward}</strong></p>
      <p className="muted">เลือกช่องว่างเพื่อให้แสตมป์จริง ช่องที่รออนุมัติจะถูกจองไว้</p>
    </header>
    <div role="group" aria-label="ช่องแสตมป์"
      style={{display:'grid',gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap:10}}>
      {Array.from({length:target},(_,index)=>{
        const slot=index+1
        const mark=marksBySlot.get(slot)
        const pending=pendingBySlot.get(slot)
        const art=mark&&pointPlusStamps.find(a=>a.id===mark.asset_id)
        const label=mark?`ช่อง ${slot}: ${mark.state==='peeled'?'ลอกแล้ว':mark.state==='redeemed'?'แลกแล้ว':'ได้รับแสตมป์'}`:
          pending?`ช่อง ${slot}: รออนุมัติ`:`ช่อง ${slot}: ว่าง`
        return <button type="button" key={slot}
          className="button button--secondary" aria-label={label}
          aria-pressed={selected===slot}
          disabled={!canGive||!active||!!mark||!!pending||attempted||busy}
          onClick={()=>{setSelected(slot);setFeedback('')}}
          style={{minHeight:90,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5}}>
          <span aria-hidden="true">{slot}</span>
          {art?<Image src={art.png} alt="" width={44} height={44}/>:
            <span aria-hidden="true">{pending?'⌛':selected===slot?'✿':'○'}</span>}
          {mark&&<small>{mark.state==='available'?'สะสมแล้ว':mark.state==='peeled'?'ลอกแล้ว':'ใช้แล้ว'}</small>}
        </button>
      })}
    </div>
    {selected&&canGive&&active&&<form onSubmit={event=>void submit(event)}
      style={{display:'grid',gap:10,marginTop:16}}>
      <h4>แปะแสตมป์ช่อง {selected}</h4>
      <label htmlFor="living-card-art">ลายแสตมป์</label>
      <select id="living-card-art" className="input" value={asset} disabled={attempted||busy}
        onChange={event=>setAsset(event.target.value)}>
        {pointPlusStamps.map(a=><option key={a.id} value={a.id}>{a.nameTh}</option>)}
      </select>
      <label htmlFor="living-card-note">ข้อความสั้น ๆ (ไม่บังคับ)</label>
      <textarea id="living-card-note" className="input" rows={2} maxLength={1000}
        value={note} disabled={attempted||busy}
        onChange={event=>setNote(event.target.value)}/>
      <button className="button button--primary" type="submit" disabled={busy||!key}>
        {busy?'กำลังบันทึก…':attempted?'ตรวจสอบและยืนยันคำขอเดิม':'ยืนยันให้แสตมป์'}
      </button>
      <p className="muted">{attempted
        ?'หากผลไม่ชัดเจน ให้ตรวจสอบสถานะช่องก่อนเริ่มรายการใหม่ เพื่อป้องกันแสตมป์ซ้ำ'
        :'แสตมป์จริงจะถูกบันทึกในประวัติหลังยืนยันเท่านั้น'}</p>
    </form>}
    {requests.length>0&&<section aria-label="คำขอแสตมป์รออนุมัติ">
      <h4>คำขอที่รออนุมัติ</h4>
      {requests.map(request=><div key={request.id}>
        <p>ช่อง {slotNumber(Number(request.position_x),Number(request.position_y),target)??'?'} · {pointPlusStamps.find(a=>a.id===request.asset_id)?.nameTh??'แสตมป์'}</p>
        {canReview&&<><button className="button button--primary" type="button" disabled={busy}
          onClick={()=>void review(request.id,true)}>อนุมัติ</button>
          <button className="button button--secondary" type="button" disabled={busy}
          onClick={()=>void review(request.id,false)}>ปฏิเสธ</button></>}
        {request.giver_user_id===userId&&<button className="button button--secondary" type="button"
          disabled={busy} onClick={()=>void cancel(request.id)}>ยกเลิกคำขอ</button>}
      </div>)}
    </section>}
    {feedback&&<p role="status">{feedback}</p>}
  </section>
}
