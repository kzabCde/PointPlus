'use client'

import {useEffect,useState,type FormEvent} from 'react'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {stampArtwork} from './stamp-model'
import {requestLivingRedemption,fulfillLivingRedemption,
  cancelLivingRedemption} from './redemption-actions'
import type {
  StampBalance,LivingRedemption,RedemptionStamp,RedemptionAssociation,
} from './redemption-data'

type RedemptionProps={
  spaceId:string;bookId:string;balance:StampBalance;
  history:LivingRedemption[];candidates:RedemptionStamp[];
  associations:RedemptionAssociation[];knownStamps:RedemptionStamp[];
  canRequest:boolean;canFulfill:boolean;isActive:boolean
}
const statusLabel:Record<LivingRedemption['status'],string>={
  requested:'รอยืนยัน',fulfilled:'แลกแล้ว',canceled:'ยกเลิกแล้ว',
}
export function LivingRedemptionPanel({
  spaceId,bookId,balance,history,candidates,associations,knownStamps,
  canRequest,canFulfill,isActive,
}:RedemptionProps){
  const router=useRouter()
  const [quantity,setQuantity]=useState(1)
  const [reward,setReward]=useState('')
  const [key,setKey]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [feedback,setFeedback]=useState('')
  const [lastStampIds,setLastStampIds]=useState<string[]>([])
  useEffect(()=>setKey(crypto.randomUUID()),[])
  const max=balance.available
  const count=Math.max(1,Math.min(quantity,Math.max(1,max)))
  const sample=candidates.slice(0,Math.min(count,12))
  const remaining=Math.max(0,count-sample.length)
  const sendable=canRequest&&isActive&&max>0&&quantity>=1&&
    quantity<=max&&Number.isSafeInteger(quantity)&&
    reward.trim().length>0&&reward.trim().length<=2000&&!!key

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy||!sendable)return
    setBusy('request');setFeedback('')
    try{
      const receipt=await requestLivingRedemption({
        spaceId,bookId,quantity,rewardMessage:reward,idempotencyKey:key,
      })
      setFeedback(receipt.message)
      if(receipt.ok){
        setLastStampIds(receipt.data?.mark_ids??[])
        setKey(crypto.randomUUID());setReward('');setQuantity(1)
        router.refresh()
      }else if(receipt.conflict)router.refresh()
    }catch{setFeedback('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้งด้วยข้อมูลเดิม')}
    finally{setBusy(null)}
  }
  async function resolve(id:string,fulfill:boolean){
    if(busy||!canFulfill)return
    setBusy(id);setFeedback('')
    try{
      const result=fulfill
        ?await fulfillLivingRedemption({spaceId,bookId,redemptionId:id})
        :await cancelLivingRedemption({spaceId,bookId,redemptionId:id})
      setFeedback(result.message)
      if(result.ok||result.conflict)router.refresh()
    }catch{setFeedback('เชื่อมต่อไม่ได้ ยังไม่สามารถยืนยันสถานะรายการ')}
    finally{setBusy(null)}
  }

  return <section className="living-redemption-panel" aria-label="การแลกแสตมป์">
    <header className="living-redemption-heading">
      <div>
        <span className="living-redemption-eyebrow">POINT+ / LIVING MEMORIES</span>
        <h3>ใช้แสตมป์แลกความทรงจำ</h3>
        <p>คนรับแสตมป์เลือกจำนวนและเขียนข้อความรางวัลเอง สมุดไม่ปิดเมื่อแลกรางวัล</p>
      </div>
    </header>
    <div className="living-redemption-balances" role="group" aria-label="ยอดแสตมป์ของสมุดทั้งหมด">
      {([
        {name:'ใช้ได้',value:balance.available},
        {name:'จองอยู่',value:balance.reserved},
        {name:'แลกแล้ว',value:balance.redeemed},
        {name:'ลอกแล้ว',value:balance.peeled},
        {name:'ได้รับทั้งหมด',value:balance.total},
      ]).map(item=><div key={item.name} className="living-redemption-balance">
        <strong>{item.value.toLocaleString('th-TH')}</strong>
        <span>{item.name}</span>
      </div>)}
    </div>

    {canRequest&&isActive&&<form className="living-redemption-request"
      onSubmit={event=>void submit(event)}>
      <h4>ขอแลกรางวัล</h4>
      <label htmlFor="living-redeem-quantity">ต้องการใช้กี่ดวง?
        <input id="living-redeem-quantity" name="quantity" className="input"
          type="number" min="1" max={Math.max(max,1)} step="1" required
          disabled={max===0||busy!==null} value={quantity}
          onChange={event=>setQuantity(Number(event.target.value))}/>
      </label>
      <label htmlFor="living-redeem-reward">อยากได้รางวัลอะไร?
        <textarea id="living-redeem-reward" name="reward_message" className="input"
          rows={3} maxLength={2000} required value={reward}
          placeholder="เช่น ขอไปปิกนิกด้วยกันหนึ่งวัน"
          disabled={max===0||busy!==null}
          onChange={event=>setReward(event.target.value)}/>
      </label>
      {max===0
        ?<p role="status" className="living-redemption-note">ยังไม่มีแสตมป์พร้อมใช้ เมื่อได้รับแสตมป์ใหม่จึงขอแลกได้</p>
        :<div className="living-redemption-preview">
          <strong>ตัวอย่างแสตมป์ที่จะใช้ {count} ดวง</strong>
          <div className="living-redemption-preview-art">
            {sample.map(mark=>{
              const art=stampArtwork.get(mark.asset_id)
              return art?<Image key={mark.id} src={art.png} alt={art.nameTh}
                width={44} height={44}/>:<span key={mark.id}>แสตมป์</span>
            })}
            {remaining>0&&<span>และอีก {remaining} ดวง</span>}
          </div>
          <small>ตัวอย่างตามลำดับที่ได้รับจริง ระบบจะเลือกและล็อกจำนวนดวงที่ใช้ในฐานข้อมูลเมื่อกดยืนยัน</small>
        </div>}
      <button type="submit" className="button button--primary"
        disabled={!sendable||busy!==null}>
        {busy==='request'?'กำลังจองแสตมป์…':'ส่งคำขอแลกรางวัล'}
      </button>
    </form>}

    {lastStampIds.length>0&&<p className="living-redemption-receipt">
      บันทึกดวงที่จองแล้ว {lastStampIds.length} ดวง (หมายเลขอ้างอิงถูกเก็บในประวัติ)
    </p>}
    {feedback&&<p role="status" className="living-redemption-feedback">{feedback}</p>}

    <section className="living-redemption-history" aria-label="ประวัติการขอแลกรางวัล">
      <h4>ประวัติการแลกรางวัล</h4>
      {history.length===0
        ?<p className="living-redemption-empty">ยังไม่มีการแลกรางวัลในสมุดนี้</p>
        :<div className="living-redemption-history-list">
          {history.map(item=>{
            const assoc=associations.filter(a=>a.redemption_id===item.id)
            const usedArt=assoc.slice(0,9).map(a=>
              knownStamps.find(s=>s.id===a.mark_id)).filter((m):m is RedemptionStamp=>!!m)
            return <article className="living-redemption-history-entry" key={item.id}
              data-redemption-status={item.status}>
              <div className="living-redemption-history-top">
                <strong>{item.requested_quantity} ดวง</strong>
                <span>{statusLabel[item.status]}</span>
              </div>
              <p className="living-redemption-history-reward">{item.reward_message}</p>
              <time dateTime={item.requested_at}>
                ขอแลก {new Date(item.requested_at).toLocaleString('th-TH',{
                  year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',
                })}
              </time>
              {usedArt.length>0&&<div className="living-redemption-history-stamps"
                aria-label={'รายการแสตมป์ที่ผูกกับคำขอ '+assoc.length+' ดวง'}>
                {usedArt.map(mark=>{
                  const art=stampArtwork.get(mark.asset_id)
                  return art?<Image key={mark.id} src={art.png} alt={art.nameTh}
                    width={32} height={32}/>:<span key={mark.id}>✿</span>
                })}
                {assoc.length>9&&<small>+{assoc.length-9}</small>}
              </div>}
              {item.status==='fulfilled'&&
                <p className="living-redemption-history-stamp-used">✓ แสตมป์ที่ใช้แล้วมีรอยตำหนิถาวรในสมุด</p>}
              {item.status==='canceled'&&
                <p className="living-redemption-history-refund">แสตมป์ที่จองไว้ได้รับการคืนสถานะแล้ว</p>}
              {item.status==='requested'&&canFulfill&&
                <div className="living-redemption-history-actions">
                  <button type="button" className="button button--primary"
                    disabled={busy!==null}
                    onClick={()=>void resolve(item.id,true)}>ยืนยันให้รางวัลแล้ว</button>
                  <button type="button" className="button button--secondary"
                    disabled={busy!==null}
                    onClick={()=>void resolve(item.id,false)}>ยกเลิกและคืนแสตมป์</button>
                </div>}
            </article>
          })}
        </div>}
    </section>
  </section>
}
