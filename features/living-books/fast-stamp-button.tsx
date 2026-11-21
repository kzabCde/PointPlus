'use client'

import Image from 'next/image'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import {loadFastStampOptions,submitFastStamp,
  type FastStampCommand,type FastStampOptions} from './fast-stamp-actions'
import {freeStampPosition} from './fast-stamp-placement'

export function FastStampButton({spaceId,bookId,title}:{
  spaceId:string;bookId:string;title:string
}){
  const storageKey='pointplus:fast-stamp:'+spaceId+':'+bookId
  const [open,setOpen]=useState(false)
  const [loading,setLoading]=useState(false)
  const [busy,setBusy]=useState(false)
  const [options,setOptions]=useState<FastStampOptions|null>(null)
  const [assetId,setAssetId]=useState(pointPlusStamps[0]?.id??'')
  const [note,setNote]=useState('')
  const [slot,setSlot]=useState<number|null>(null)
  const [intent,setIntent]=useState<FastStampCommand|null>(null)
  const [feedback,setFeedback]=useState('')
  const [receipt,setReceipt]=useState('')
  const lock=useRef(false)
  const dialogRef=useRef<HTMLElement>(null)
  const openerRef=useRef<HTMLButtonElement>(null)
  const busyRef=useRef(false)
  busyRef.current=busy

  // Keep the exact logical submission across a rerender or page refresh.
  useEffect(()=>{
    try{
      const raw=sessionStorage.getItem(storageKey)
      if(!raw)return
      const saved=JSON.parse(raw) as FastStampCommand
      if(saved?.spaceId!==spaceId||saved?.bookId!==bookId||
        typeof saved.key!=='string'||typeof saved.assetId!=='string')return
      setIntent(saved)
      setAssetId(saved.assetId)
      setNote(saved.note)
      setSlot(saved.cardSlot??null)
      setFeedback('มีคำขอที่ยังไม่ทราบผล กรุณาลองส่งรายการเดิมเพื่อตรวจสอบ')
    }catch{/* Storage may be disabled; the in-memory intent remains valid. */}
  },[spaceId,bookId,storageKey])

  useEffect(()=>{
    if(!open)return
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    dialogRef.current?.focus()
    function onKey(event:KeyboardEvent){
      if(event.key==='Escape'&&!busyRef.current){
        event.preventDefault()
        setOpen(false)
      }
      if(event.key!=='Tab')return
      const dialog=dialogRef.current
      if(!dialog)return
      const items=Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),textarea:not([disabled]),input:not([disabled]),'+
        '[tabindex]:not([tabindex="-1"])'
      )).filter(element=>element.getClientRects().length>0)
      if(!items.length){event.preventDefault();dialog.focus();return}
      const first=items[0],last=items[items.length-1]
      if(!dialog.contains(document.activeElement)){
        event.preventDefault();(event.shiftKey?last:first).focus()
      }else if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus()
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus()
      }
    }
    document.addEventListener('keydown',onKey,true)
    return ()=>{
      document.removeEventListener('keydown',onKey,true)
      document.body.style.overflow=previousOverflow
      openerRef.current?.focus()
    }
  },[open])

  async function show(){
    if(open)return
    setOpen(true);setLoading(true);setFeedback(intent?
      'คำขอเก่ายังไม่ทราบผล สามารถส่งซ้ำด้วยรหัสเดิมได้':'')
    try{
      const response=await loadFastStampOptions({spaceId,bookId})
      if(!response.ok||!response.data){
        setOptions(null);setFeedback(response.message)
        return
      }
      setOptions(response.data)
      if(response.data.kind==='card'&&!intent){
        const first=Array.from({length:response.data.targetCount??0},(_,i)=>i+1)
          .find(n=>!response.data?.occupiedSlots.includes(n))
        setSlot(first??null)
      }
    }catch{
      setOptions(null);setFeedback('โหลดตัวเลือกแสตมป์ไม่สำเร็จ กรุณาลองเปิดใหม่')
    }finally{setLoading(false)}
  }

  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(lock.current||loading||(!options&&!intent))return
    let command=intent
    if(!command){
      if(!options||!assetId)return
      const key=crypto.randomUUID()
      if(options.kind==='card'&&(!slot||options.occupiedSlots.includes(slot)))return
      command={
        spaceId,bookId,pageId:options.pageId,assetId,note,key,
        ...(options.kind==='card'?{cardSlot:slot}:{
          placement:freeStampPosition(key,options.occupiedPositions),
        }),
      }
      setIntent(command)
      try{sessionStorage.setItem(storageKey,JSON.stringify(command))}catch{}
    }
    lock.current=true;setBusy(true);setFeedback('')
    try{
      const result=await submitFastStamp(command)
      if(result.ok){
        try{sessionStorage.removeItem(storageKey)}catch{}
        setIntent(null);setNote('');setReceipt(result.message)
        setOpen(false);setOptions(null)
      }else{
        setFeedback(result.message+' — หากไม่แน่ใจว่าสำเร็จหรือไม่ ให้ลองรายการเดิม')
      }
    }catch{
      setFeedback('เครือข่ายขัดข้องหรือยังไม่ทราบผล กรุณาลองส่งรายการเดิมโดยไม่สร้างคำขอใหม่')
    }finally{lock.current=false;setBusy(false)}
  }

  function close(){if(!busyRef.current)setOpen(false)}

  return <div className="fast-stamp-launch">
    <button ref={openerRef} className="button button--primary" type="button"
      onClick={()=>void show()}>
      ให้แสตมป์
    </button>
    {receipt&&<small className="fast-stamp-receipt" role="status">{receipt}</small>}
    {intent&&!open&&<small className="fast-stamp-receipt" role="status">มีคำขอรอตรวจสอบ</small>}
    {open&&<div className="fast-stamp-layer">
      <button className="fast-stamp-backdrop" type="button" tabIndex={-1}
        aria-label="ปิดหน้าต่างให้แสตมป์" disabled={busy} onClick={close}/>
      <section className="fast-stamp-sheet" ref={dialogRef} role="dialog"
        aria-modal="true" aria-labelledby={'fast-stamp-title-'+bookId} tabIndex={-1}>
        <header className="fast-stamp-header">
          <div>
            <small>POINT+ / STAMP</small>
            <h3 id={'fast-stamp-title-'+bookId}>ให้แสตมป์</h3>
            <p>{title}</p>
          </div>
          <button className="button button--secondary" type="button"
            disabled={busy} onClick={close} aria-label="ปิดหน้าต่าง">ปิด</button>
        </header>
        {loading&&<p role="status">กำลังเตรียมช่องแสตมป์…</p>}
        {options&&<form onSubmit={event=>void send(event)} className="fast-stamp-form">
          <fieldset disabled={busy||Boolean(intent)}>
            <legend>เลือกลายแสตมป์</legend>
            <div className="fast-stamp-artworks">
              {pointPlusStamps.map(stamp=><button key={stamp.id} type="button"
                aria-pressed={assetId===stamp.id} onClick={()=>setAssetId(stamp.id)}
                className="fast-stamp-artwork">
                <Image src={stamp.png} alt="" width={46} height={46}/>
                <span>{stamp.nameTh}</span>
              </button>)}
            </div>
            {options.kind==='card'&&<fieldset className="fast-stamp-slots">
              <legend>เลือกช่องสะสม</legend>
              <div className="fast-stamp-slot-grid">
                {Array.from({length:options.targetCount??0},(_,i)=>i+1).map(number=>
                  <button key={number} type="button"
                    aria-pressed={slot===number} disabled={options.occupiedSlots.includes(number)}
                    onClick={()=>setSlot(number)} aria-label={'ช่อง '+number+
                      (options.occupiedSlots.includes(number)?' ไม่ว่าง':' ว่าง')}>
                    {number}
                  </button>)}
              </div>
            </fieldset>}
            {options.kind==='book'&&<p className="fast-stamp-hint">
              ระบบจะวางแสตมป์บนหน้าสมุดให้อัตโนมัติ สามารถจัดตำแหน่งภายหลังได้ตามสิทธิ์
            </p>}
            <label className="fast-stamp-note">ข้อความถึงคนสำคัญ (ไม่บังคับ)
              <textarea className="input" maxLength={1000} rows={2}
                value={note} onChange={event=>setNote(event.target.value)}/>
            </label>
          </fieldset>
          {intent&&<p className="fast-stamp-hint">รายการนี้ถูกล็อกเพื่อป้องกันการให้แสตมป์ซ้ำ
            การลองใหม่จะใช้รหัสเดิมเสมอ</p>}
          <div className="fast-stamp-actions">
            <button className="button button--primary" type="submit"
              disabled={busy||!assetId||(!intent&&options.kind==='card'&&!slot)}>
              {busy?'กำลังบันทึก…':intent?'ลองส่งรายการเดิม':'ยืนยันให้แสตมป์'}
            </button>
            <button className="button button--secondary" type="button"
              disabled={busy} onClick={close}>ปิด</button>
          </div>
        </form>}
        {!options&&intent&&<button className="button button--primary" type="button"
          disabled={busy} onClick={()=>void send({preventDefault(){} } as FormEvent<HTMLFormElement>)}>
          {busy?'กำลังตรวจสอบ…':'ลองส่งคำขอเดิม'}
        </button>}
        {feedback&&<p className="fast-stamp-feedback" role="status">{feedback}</p>}
      </section>
    </div>}
  </div>
}
