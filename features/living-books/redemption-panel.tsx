'use client'

import {useEffect,useRef,useState,type FormEvent} from 'react'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {stampArtwork} from './stamp-model'
import {emitPaperCue} from './paper-sound'
import {requestLivingRedemption,fulfillLivingRedemption,
  cancelLivingRedemption} from './redemption-actions'
import type {
  StampBalance,LivingRedemption,RedemptionStamp,RedemptionAssociation,
} from './redemption-data'

type RedemptionProps={
  spaceId:string;bookId:string;balance:StampBalance;
  history:LivingRedemption[];pendingCount:number;candidates:RedemptionStamp[];
  associations:RedemptionAssociation[];knownStamps:RedemptionStamp[];
  canRequest:boolean;canFulfill:boolean;isActive:boolean
  card?:{target_count:number;reward_title:string}
}
const statusLabel:Record<LivingRedemption['status'],string>={
  requested:'รอยืนยัน',fulfilled:'แลกแล้ว',canceled:'ยกเลิกแล้ว',
}
export function LivingRedemptionPanel({
  spaceId,bookId,balance,history,pendingCount,candidates,associations,knownStamps,
  canRequest,canFulfill,isActive,card,
}:RedemptionProps){
  const router=useRouter()
  const [quantity,setQuantity]=useState(1)
  const [reward,setReward]=useState('')
  const [key,setKey]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [feedback,setFeedback]=useState('')
  const [lastStampIds,setLastStampIds]=useState<string[]>([])
  const [attempted,setAttempted]=useState(false)
  const requestLock=useRef(false)
  const actionLock=useRef(false)
  const requestSnapshot=useRef<{
    quantity:number;rewardMessage:string;idempotencyKey:string
  }|null>(null)
  const [confirmAction,setConfirmAction]=useState<{
    id:string;fulfill:boolean
  }|null>(null)
  useEffect(()=>setKey(crypto.randomUUID()),[])
  const max=balance.available
  const requestedQuantity=card?.target_count??quantity
  const requestedReward=card?.reward_title??reward
  const count=Math.max(1,Math.min(requestedQuantity,Math.max(1,max)))
  const sample=candidates.slice(0,Math.min(count,12))
  const remaining=Math.max(0,count-sample.length)
  const pending=history.filter(item=>item.status==='requested')
  const completed=history.filter(item=>item.status!=='requested')
  const sendable=canRequest&&isActive&&max>0&&requestedQuantity>=1&&
    requestedQuantity<=max&&Number.isSafeInteger(requestedQuantity)&&
    requestedReward.trim().length>0&&requestedReward.trim().length<=2000&&!!key

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(requestLock.current||busy||!sendable)return
    requestLock.current=true
    // When the server response is lost, keep EXACTLY the same request parameters.
    // Only a new deliberate request receives a fresh idempotency key.
    if(!requestSnapshot.current)
      requestSnapshot.current={quantity:requestedQuantity,rewardMessage:requestedReward,idempotencyKey:key}
    setAttempted(true)
    setBusy('request');setFeedback('')
    try{
      const receipt=await requestLivingRedemption({
        spaceId,bookId,...requestSnapshot.current,
      })
      setFeedback(receipt.message)
      if(receipt.ok){
        emitPaperCue('stamp')
        setLastStampIds(receipt.data?.mark_ids??[])
        setKey(crypto.randomUUID());setReward('');setQuantity(1)
        setAttempted(false);requestSnapshot.current=null
        router.refresh()
      }else if(receipt.conflict)router.refresh()
    }catch{setFeedback('เชื่อมต่อไม่ได้ ลองส่งคำขอเดิมด้วยจำนวนและข้อความเดิม หรือยกเลิกหลังตรวจสอบรายการ')}
    finally{requestLock.current=false;setBusy(null)}
  }
  async function resolve(id:string,fulfill:boolean){
    if(busy||!canFulfill||actionLock.current||
      confirmAction?.id!==id||confirmAction.fulfill!==fulfill)return
    actionLock.current=true
    setBusy(id);setFeedback('')
    try{
      const result=fulfill
        ?await fulfillLivingRedemption({spaceId,bookId,redemptionId:id})
        :await cancelLivingRedemption({spaceId,bookId,redemptionId:id})
      setFeedback(result.message)
      if(result.ok){
        emitPaperCue(fulfill?'reward':'page')
        setConfirmAction(null)
      }
      if(result.ok||result.conflict)router.refresh()
    }catch{setFeedback('เชื่อมต่อไม่ได้ ยังไม่สามารถยืนยันสถานะรายการ')}
    finally{actionLock.current=false;setBusy(null)}
  }

  return <section className="living-redemption-panel living-redemption-panel--focused"
    aria-label="การแลกแสตมป์">
    <header className="living-redemption-heading">
      <div>
        <span className="living-redemption-eyebrow">POINT+ / LIVING MEMORIES</span>
        <h3>เก็บแต้มความทรงจำ แลกเป็นเรื่องราว</h3>
      </div>
    </header>
    <div className="living-redemption-balances" role="group" aria-label="สถานะแสตมป์">
      {([
        {name:'ใช้ได้',value:balance.available},
        {name:'จองอยู่',value:balance.reserved},
        {name:'แลกแล้ว',value:balance.redeemed},
      ]).map(item=><div key={item.name} className="living-redemption-balance">
        <strong>{item.value.toLocaleString('th-TH')}</strong>
        <span>{item.name}</span>
      </div>)}
    </div>
    <details className="living-redemption-more-balances">
      <summary>รายละเอียดแสตมป์ทั้งหมด</summary>
      <p>ได้รับทั้งหมด {balance.total.toLocaleString('th-TH')} ดวง ·
        ลอกแล้ว {balance.peeled.toLocaleString('th-TH')} ดวง</p>
    </details>

    {canRequest&&isActive&&<form className="living-redemption-request"
      onSubmit={event=>void submit(event)}>
      <h4>ขอแลกเป็นความทรงจำ</h4>
      {card&&<p role="status" className="living-card-fixed-reward">
        ครบ {card.target_count} ดวงจึงแลกได้ · รางวัล: <strong>{card.reward_title}</strong>
      </p>}
      {!card&&<div className="living-redemption-quantity">
        <label htmlFor="living-redeem-quantity">จำนวนแสตมป์ที่ต้องการแลก
          <input id="living-redeem-quantity" name="quantity" className="input"
            type="number" min="1" max={Math.max(max,1)} step="1" required
            inputMode="numeric"
            disabled={max===0||busy!==null||attempted} value={quantity}
            onChange={event=>setQuantity(Number(event.target.value))}/>
        </label>
        <input type="range" className="living-redemption-quantity-slider"
          aria-label="เลื่อนเพื่อเลือกจำนวนแสตมป์" min={1} max={Math.max(1,max)}
          step={1} value={count} disabled={max===0||busy!==null||attempted}
          onChange={event=>setQuantity(Number(event.target.value))}/>
        <span className="living-redemption-quantity-summary">
          {count.toLocaleString('th-TH')} / {max.toLocaleString('th-TH')} ดวง
        </span>
      </div>}
      {!card&&<label htmlFor="living-redeem-reward">อยากแลกเป็นอะไร?
        <textarea id="living-redeem-reward" name="reward_message" className="input"
          rows={3} maxLength={2000} required value={reward}
          placeholder="เช่น ขอไปปิกนิกด้วยกันหนึ่งวัน"
          disabled={max===0||busy!==null||attempted}
          onChange={event=>setReward(event.target.value)}/>
      </label>}
      {card&&max<card.target_count&&<p role="status" className="living-redemption-note">
        เหลือแสตมป์พร้อมใช้ {max} / {card.target_count} ดวง ต้องครบก่อนส่งคำขอ
      </p>}
      {max===0
        ?<p role="status" className="living-redemption-note">
          ยังไม่มีแสตมป์พร้อมใช้ เมื่อได้รับแสตมป์ใหม่จึงขอแลกได้
        </p>
        :<details className="living-redemption-preview">
          <summary>ดูแสตมป์ที่จะจอง {count.toLocaleString('th-TH')} ดวง</summary>
          <div className="living-redemption-preview-art">
            {sample.map(mark=>{
              const art=stampArtwork.get(mark.asset_id)
              return art?<Image key={mark.id} src={art.png} alt={art.nameTh}
                width={44} height={44}/>:<span key={mark.id}>แสตมป์</span>
            })}
            {remaining>0&&<span>และอีก {remaining} ดวง</span>}
          </div>
          <small>ตัวอย่างตามลำดับการรับจริง ระบบฐานข้อมูลจะเลือกและล็อกดวงที่ใช้
            เมื่อส่งคำขอ โดยใช้รหัสแสตมป์จริงเสมอ</small>
        </details>}
      {attempted&&<div className="living-redemption-retry" role="status">
        ส่งคำขอนี้แล้วหรืออาจส่งถึงระบบแล้ว หากไม่เห็นผล ให้ลองยืนยันอีกครั้ง
        ด้วยรหัสคำขอเดิม หรือเปิดประวัติตรวจสอบก่อนเริ่มคำขอใหม่
      </div>}
      <button type="submit" className="button button--primary living-redemption-submit"
        disabled={!sendable||busy!==null}>
        {busy==='request'?'กำลังจองแสตมป์…':
          attempted?'ลองส่งคำขอเดิม':'ส่งคำขอแลกรางวัล'}
      </button>
      {attempted&&<button className="button button--secondary" type="button"
        disabled={busy!==null}
        onClick={()=>{
          if(!window.confirm('โปรดตรวจประวัติว่าไม่มีคำขอที่ส่งสำเร็จแล้วก่อนเริ่มคำขอใหม่ การเริ่มใหม่อาจใช้แสตมป์เพิ่มอีกชุด ยืนยันหรือไม่?'))return
          requestSnapshot.current=null
          setAttempted(false);setKey(crypto.randomUUID())
          setFeedback('เริ่มคำขอใหม่แล้ว โปรดตรวจสอบประวัติก่อนส่ง')
        }}>ตรวจสอบแล้ว เริ่มคำขอใหม่</button>}
    </form>}

    {lastStampIds.length>0&&<p className="living-redemption-receipt" role="status">
      จองแสตมป์แล้ว {lastStampIds.length} ดวง หมายเลขอ้างอิงอยู่ในประวัติ
    </p>}
    {feedback&&<p role={feedback.includes('ไม่สำเร็จ')?'alert':'status'}
      className="living-redemption-feedback">{feedback}</p>}

    {pending.length>0&&<section className="living-redemption-pending"
      aria-label={canFulfill?'คำขอที่รอคุณตอบรับ':'คำขอแลกรางวัลที่รอผล'}>
      <div className="living-redemption-pending-heading">
        <h4>{canFulfill?'คำขอที่รอคุณตอบรับ':'กำลังรอการยืนยัน'}</h4>
        <span className="living-redemption-pending-count">
          {pendingCount.toLocaleString('th-TH')} รายการ
        </span>
      </div>
      {pendingCount>pending.length&&<p className="living-redemption-note" role="status">
        แสดง {pending.length.toLocaleString('th-TH')} คำขอล่าสุดจากทั้งหมด
        {pendingCount.toLocaleString('th-TH')} รายการ
      </p>}
      {pending.map(item=><article className="living-redemption-pending-entry"
        data-redemption-status="requested" key={item.id}>
        <div className="living-redemption-history-top">
          <strong>{item.requested_quantity.toLocaleString('th-TH')} ดวง</strong>
          <span>{statusLabel[item.status]}</span>
        </div>
        <p className="living-redemption-history-reward">{item.reward_message}</p>
        <time dateTime={item.requested_at}>
          {new Date(item.requested_at).toLocaleString('th-TH',{
            year:'numeric',month:'short',day:'numeric',
          })}
        </time>
        {canFulfill&&isActive&&<div className="living-redemption-history-actions">
          <button type="button" className="button button--primary"
            disabled={busy!==null}
            aria-expanded={confirmAction?.id===item.id&&confirmAction.fulfill}
            onClick={()=>setConfirmAction({id:item.id,fulfill:true})}>
            ยืนยันให้รางวัลแล้ว
          </button>
          <button type="button" className="button button--secondary"
            disabled={busy!==null}
            aria-expanded={confirmAction?.id===item.id&&!confirmAction.fulfill}
            onClick={()=>setConfirmAction({id:item.id,fulfill:false})}>
            ยกเลิกและคืนแสตมป์
          </button>
        </div>}
        {canFulfill&&confirmAction?.id===item.id&&<div
          className="living-redemption-confirm" role="group"
          aria-label="ยืนยันการดำเนินการกับคำขอ">
          <p>{confirmAction.fulfill
            ?'คุณได้มอบรางวัลตามข้อความนี้แล้วใช่ไหม? เมื่อยืนยัน แสตมป์ที่จองจะถูกใช้ถาวร'
            :'ต้องการยกเลิกคำขอนี้หรือไม่? แสตมป์ที่จองไว้จะกลับมาใช้ได้'}</p>
          <div className="living-redemption-history-actions">
            <button type="button" className="button button--secondary"
              disabled={busy!==null} onClick={()=>setConfirmAction(null)}>
              กลับไป
            </button>
            <button type="button" className="button button--primary"
              disabled={busy!==null}
              onClick={()=>void resolve(item.id,confirmAction.fulfill)}>
              {busy===item.id?'กำลังบันทึก…':
                confirmAction.fulfill?'ยืนยันมอบรางวัลแล้ว':'ยืนยันยกเลิกคำขอ'}
            </button>
          </div>
        </div>}
      </article>)}
    </section>}

    <details className="living-redemption-history"
      aria-label="ประวัติการแลกรางวัล">
      <summary>ประวัติการแลกรางวัล ({completed.length.toLocaleString('th-TH')} รายการล่าสุด)</summary>
      {completed.length===0
        ?<p className="living-redemption-empty">ยังไม่มีรายการแลกสำเร็จหรือยกเลิก</p>
        :<div className="living-redemption-history-list">
          {completed.map(item=>{
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
                  year:'numeric',month:'short',day:'numeric',
                  hour:'2-digit',minute:'2-digit',
                })}
              </time>
              {usedArt.length>0&&<div className="living-redemption-history-stamps"
                aria-label={'ตัวอย่างแสตมป์ที่ผูกกับคำขอ '+item.requested_quantity+' ดวง'}>
                {usedArt.map(mark=>{
                  const art=stampArtwork.get(mark.asset_id)
                  return art?<Image key={mark.id} src={art.png} alt={art.nameTh}
                    width={32} height={32}/>:<span key={mark.id}>✿</span>
                })}
                {item.requested_quantity>usedArt.length&&
                  <small>+{item.requested_quantity-usedArt.length} ดวง</small>}
              </div>}
              {item.status==='fulfilled'&&
                <p className="living-redemption-history-stamp-used">
                  ✓ แสตมป์ที่ใช้แล้วมีรอยตำหนิถาวรในสมุด
                </p>}
              {item.status==='canceled'&&
                <p className="living-redemption-history-refund">
                  แสตมป์ที่จองไว้ได้รับการคืนสถานะแล้ว
                </p>}
            </article>
          })}
        </div>}
    </details>
  </section>
}
