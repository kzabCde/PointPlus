'use client'

import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {usePaperSound} from './paper-sound'

type EditorStudioContext={
  paperUnsaved:boolean;pageUnsaved:boolean;
  setPaperUnsaved:(value:boolean)=>void;setPageUnsaved:(value:boolean)=>void;
}
const studioContext=createContext<EditorStudioContext|null>(null)

export function useLivingEditorStudio(){
  return useContext(studioContext)
}

/**
 * Parent stays mounted for the current Living Book while page query changes.
 * Sound follows a user-controlled preference; unsaved edits block page navigation.
 */
export function LivingBookStudio({children,title,backHref,description,recipientName,status,availableStamps,pendingRewards=0,rewardPanel}:{
  children:ReactNode
  title:string;backHref:string;description?:string|null;recipientName?:string|null
  status:'active'|'paused'|'archived';availableStamps:number
  pendingRewards?:number;rewardPanel:ReactNode
}){
  const [paperUnsaved,setPaperUnsaved]=useState(false)
  const [pageUnsaved,setPageUnsaved]=useState(false)
  const {enabled,toggle}=usePaperSound()
  const router=useRouter()
  const settingsRef=useRef<HTMLDetailsElement|null>(null)
  const rewardTriggerRef=useRef<HTMLButtonElement|null>(null)
  const rewardDialogRef=useRef<HTMLElement|null>(null)
  const [rewardsOpen,setRewardsOpen]=useState(false)
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&settingsRef.current?.open)settingsRef.current.open=false
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[])
  useEffect(()=>{
    if(!rewardsOpen)return
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const dialog=rewardDialogRef.current
    dialog?.focus()
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault()
        event.stopPropagation()
        setRewardsOpen(false)
        return
      }
      if(event.key!=='Tab'||!dialog)return
      const nodes=Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),textarea:not([disabled]),'+
        'select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'
      )).filter(node=>!node.closest('[hidden]')&&!node.hasAttribute('hidden')&&
        node.getClientRects().length>0)
      if(nodes.length===0){event.preventDefault();dialog.focus();return}
      const first=nodes[0],last=nodes[nodes.length-1]
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){
        event.preventDefault();last.focus()
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus()
      }
    }
    document.addEventListener('keydown',onKey,true)
    return ()=>{
      document.removeEventListener('keydown',onKey,true)
      document.body.style.overflow=previousOverflow
      rewardTriggerRef.current?.focus()
    }
  },[rewardsOpen])
  useEffect(()=>{
    const block=(event:BeforeUnloadEvent)=>{
      if(paperUnsaved||pageUnsaved){event.preventDefault();event.returnValue=''}
    }
    window.addEventListener('beforeunload',block)
    // Renew private photo signed URLs before their 20-minute expiry when idle.
    const urlRefresh=window.setInterval(()=>{
      if(!paperUnsaved&&!pageUnsaved&&document.visibilityState==='visible')
        router.refresh()
    },14*60*1000)
    return ()=>{
      window.removeEventListener('beforeunload',block)
      window.clearInterval(urlRefresh)
    }
  },[paperUnsaved,pageUnsaved,router])
  const state=useMemo(()=>({
    paperUnsaved,pageUnsaved,setPaperUnsaved,setPageUnsaved,
  }),[paperUnsaved,pageUnsaved])
  const statusLabel=status==='active'?'กำลังสะสม':status==='paused'?'พักใช้':'เก็บถาวร'
  return <studioContext.Provider value={state}>
    <div className="living-workspace living-reader">
      <header className="living-reader-header">
        <Link className="living-reader-back" href={backHref}
          aria-label="กลับไปหน้ารวมสมุดความทรงจำ">
          <span aria-hidden="true">←</span>
        </Link>
        <div className="living-reader-heading">
          <span className="living-reader-kicker">POINT+ / OUR STORY</span>
          <h1 title={title}>{title}</h1>
        </div>
        <div className="living-reader-actions">
          <button type="button" ref={rewardTriggerRef}
            className="living-reader-balance"
            aria-haspopup="dialog" aria-expanded={rewardsOpen}
            aria-controls="living-reader-rewards"
            aria-label={`ดูยอดแสตมป์และการแลกรางวัล มีพร้อมใช้ ${availableStamps} ดวง`+
              (pendingRewards>0?` มีคำขอรอตอบ ${pendingRewards} รายการ`:'')}
            onClick={()=>{if(settingsRef.current)settingsRef.current.open=false;setRewardsOpen(true)}}>
            <span aria-hidden="true">✿</span>
            <span>{availableStamps.toLocaleString('th-TH')}</span>
            <span className="living-reader-balance-label">ดวง</span>
            {pendingRewards>0&&<span className="living-reader-pending-count"
              aria-hidden="true">{pendingRewards}</span>}
          </button>
          <details ref={settingsRef} className="living-reader-more">
            <summary aria-label="ตัวเลือกและรายละเอียดสมุด">···</summary>
            <div className="living-reader-menu">
              <p className="living-reader-menu-title">รายละเอียดสมุด</p>
              <p className="living-reader-menu-meta">สถานะ: {statusLabel}</p>
              {recipientName&&<p className="living-reader-menu-meta">สำหรับ {recipientName}</p>}
              {description&&<p className="living-reader-menu-description">{description}</p>}
              <button type="button" className="living-reader-sound-toggle"
                aria-pressed={enabled} onClick={toggle}
                aria-label={enabled?'ปิดเสียงสมุด':'เปิดเสียงสมุด'}>
                <span aria-hidden="true">{enabled?'🔊':'🔇'}</span>
                {enabled?'ปิดเสียงกระดาษ':'เปิดเสียงกระดาษ'}
              </button>
            </div>
          </details>
        </div>
      </header>
      <div className="living-reader-reward-overlay" hidden={!rewardsOpen}>
        <button type="button" className="living-reader-reward-backdrop"
          aria-label="ปิดแผงแลกรางวัล" tabIndex={rewardsOpen?0:-1}
          onClick={()=>setRewardsOpen(false)}/>
        <section id="living-reader-rewards" ref={rewardDialogRef}
          role="dialog" aria-modal="true"
          aria-labelledby="living-reader-rewards-title"
          tabIndex={-1} className="living-reader-reward-sheet">
          <div className="living-reader-sheet-title">
            <strong id="living-reader-rewards-title">ความทรงจำและรางวัล</strong>
            <button className="living-reader-close" type="button"
              onClick={()=>setRewardsOpen(false)} aria-label="ปิดแผงแลกรางวัล">✕</button>
          </div>
          {rewardPanel}
        </section>
      </div>
      {status!=='active'&&<p className="living-reader-status" role="status">
        {status==='paused'?'สมุดพักใช้งานชั่วคราว':'สมุดเก็บเป็นความทรงจำแล้ว'}
      </p>}
      {children}
    </div>
  </studioContext.Provider>
}
