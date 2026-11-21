'use client'

import Link from 'next/link'
import {useEffect,useRef,useState,type MouseEvent,type TouchEvent} from 'react'
import {useRouter} from 'next/navigation'
import {AddLivingBookPageForm} from './forms'
import {reorderLivingPages,updateLivingPageSettings} from './editor-actions'
import {orderedPageIds,backgrounds,
  type LivingEditorPage,type PaperBackground} from './editor-model'
import {useLivingEditorStudio} from './editor-studio'
import {emitPaperCue} from './paper-sound'

const backgroundNames:Record<PaperBackground,string>={
  cream:'ครีม',white:'ขาว',lined:'มีเส้น',grid:'ตาราง',kraft:'คราฟต์',
}
const windowSize=36

export function LivingPageManager({spaceId,bookId,pages,page,editable}:{
  spaceId:string;bookId:string;pages:LivingEditorPage[];page:LivingEditorPage;editable:boolean
}){
  const router=useRouter()
  const studio=useLivingEditorStudio()
  const [title,setTitle]=useState(page.title??'')
  const [background,setBackground]=useState<PaperBackground>(page.background_style)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const current=Math.max(0,pages.findIndex(p=>p.id===page.id))
  const [jump,setJump]=useState(current+1)
  const [start,setStart]=useState(Math.floor(current/windowSize)*windowSize)
  const savedRef=useRef({title:page.title??'',background:page.background_style,version:page.version})
  const savingRef=useRef(false)
  const retryBlocked=useRef(false)
  const swipeStart=useRef<{x:number;y:number}|null>(null)
  const base='/s/'+spaceId+'/stamp-books/living/'+bookId
  const unsaved=title!==savedRef.current.title||background!==savedRef.current.background

  useEffect(()=>{
    setTitle(page.title??'')
    setBackground(page.background_style)
    savedRef.current={title:page.title??'',background:page.background_style,version:page.version}
    retryBlocked.current=false
    setJump(current+1)
    setStart(Math.floor(current/windowSize)*windowSize)
    setMessage('')
    studio?.setPageUnsaved(false)
  // All setters are stable; reset only after server page version or identity changes.
  },[page.id,page.version,page.title,page.background_style,current])

  useEffect(()=>{
    studio?.setPageUnsaved(unsaved||savingRef.current)
  },[unsaved,busy,studio?.setPageUnsaved])
  useEffect(()=>()=>studio?.setPageUnsaved(false),[studio?.setPageUnsaved])

  async function savePage(){
    if(!editable||savingRef.current||!unsaved)return
    savingRef.current=true
    setBusy(true)
    setMessage('กำลังบันทึกหน้ากระดาษ…')
    const latest={title,background}
    const expected=savedRef.current.version
    try{
      const result=await updateLivingPageSettings({
        spaceId,bookId,pageId:page.id,title:latest.title,
        background:latest.background,expectedVersion:expected,
      })
      if(result.ok&&result.data){
        savedRef.current={...latest,version:result.data.version}
        retryBlocked.current=false
        setMessage('บันทึกหน้ากระดาษแล้ว')
        emitPaperCue('write')
        router.refresh()
      }else{
        retryBlocked.current=true
        setMessage(result.error??'บันทึกไม่สำเร็จ เลือกบันทึกอีกครั้ง')
        if(result.conflict)setMessage('หน้าเปลี่ยนจากอุปกรณ์อื่น กรุณาตรวจสอบแล้วโหลดข้อมูลใหม่')
      }
    }catch{
      retryBlocked.current=true
      setMessage('การเชื่อมต่อขัดข้อง ข้อมูลยังไม่ได้บันทึก กดบันทึกใหม่เมื่อพร้อม')
    }finally{
      savingRef.current=false;setBusy(false)
    }
  }
  useEffect(()=>{
    if(!editable||!unsaved||busy||retryBlocked.current)return
    const timer=window.setTimeout(()=>{void savePage()},850)
    return ()=>window.clearTimeout(timer)
  },[title,background,editable,busy,page.id])

  function canNavigate():boolean{
    if(savingRef.current||unsaved||studio?.paperUnsaved||studio?.pageUnsaved){
      setMessage('มีการแก้ไขที่ยังไม่บันทึก กรุณาบันทึกให้เรียบร้อยก่อนพลิกหน้า')
      return false
    }
    emitPaperCue('page')
    return true
  }
  function handleLink(event:MouseEvent<HTMLAnchorElement>){
    if(!canNavigate())event.preventDefault()
  }
  function go(index:number){
    if(!Number.isSafeInteger(index)||index<0||index>=pages.length||!canNavigate())return
    router.push(base+'?page='+pages[index].id)
  }
  async function reorder(direction:-1|1){
    if(!editable||busy||!canNavigate())return
    const ids=orderedPageIds(pages,page.id,direction)
    if(!ids)return
    setBusy(true);setMessage('')
    try{
      const result=await reorderLivingPages({spaceId,bookId,pageIds:ids})
      setMessage(result.ok?'เปลี่ยนลำดับหน้าแล้ว':result.error??'เรียงหน้าไม่สำเร็จ')
      if(result.ok||result.conflict)router.refresh()
    }catch{setMessage('เชื่อมต่อไม่ได้ ลำดับหน้ายังไม่เปลี่ยน')}
    finally{setBusy(false)}
  }
  function beginSwipe(event:TouchEvent<HTMLDivElement>){
    const touch=event.touches[0]
    if(touch)swipeStart.current={x:touch.clientX,y:touch.clientY}
  }
  function finishSwipe(event:TouchEvent<HTMLDivElement>){
    const start=swipeStart.current
    swipeStart.current=null
    const touch=event.changedTouches[0]
    if(!start||!touch)return
    const dx=touch.clientX-start.x,dy=touch.clientY-start.y
    if(Math.abs(dx)<72||Math.abs(dy)>Math.abs(dx)*.5)return
    event.preventDefault()
    const next=current+(dx<0?1:-1)
    if(next>=0&&next<pages.length)go(next)
  }
  const windowed=pages.slice(start,start+windowSize)
  return <section className="living-page-manager" aria-label="ตัวจัดการหน้าสมุด">
    <div className="living-page-controls"
      onTouchStart={beginSwipe} onTouchEnd={finishSwipe}
      aria-label="พลิกหน้า: ปัดซ้ายหรือขวาบนแถบเครื่องมือนี้">
      <Link aria-disabled={current===0} tabIndex={current===0?-1:0}
        className={'button button--secondary'+(current===0?' is-disabled':'')}
        onClick={handleLink}
        href={current>0?base+'?page='+pages[current-1].id:base+'?page='+page.id}>
        ← ก่อนหน้า
      </Link>
      <span role="status">หน้า {current+1} / {pages.length}</span>
      <Link aria-disabled={current===pages.length-1}
        tabIndex={current===pages.length-1?-1:0}
        className={'button button--secondary'+(current===pages.length-1?' is-disabled':'')}
        onClick={handleLink}
        href={current<pages.length-1?base+'?page='+pages[current+1].id:base+'?page='+page.id}>
        ถัดไป →
      </Link>
    </div>
    <div className="living-page-jump">
      <label htmlFor="living-page-jump-number">ไปยังหน้าที่</label>
      <div className="living-page-jump__row">
        <input className="input" id="living-page-jump-number" type="number"
          min={1} max={pages.length} value={jump} inputMode="numeric"
          onChange={e=>setJump(Number(e.target.value))}/>
        <button type="button" className="button button--secondary"
          onClick={()=>go(jump-1)}>ไปยังหน้า</button>
      </div>
    </div>
    <div className="living-page-window-actions" role="group" aria-label="ช่วงภาพย่อหน้าสมุด">
      <button type="button" className="button button--secondary" disabled={start===0}
        onClick={()=>setStart(Math.max(0,start-windowSize))}>← ก่อนหน้า {windowSize} หน้า</button>
      <small>{start+1}–{Math.min(start+windowSize,pages.length)}</small>
      <button type="button" className="button button--secondary"
        disabled={start+windowSize>=pages.length}
        onClick={()=>setStart(Math.min(Math.floor((pages.length-1)/windowSize)*windowSize,start+windowSize))}>
        ต่อไป {windowSize} หน้า →
      </button>
    </div>
    <nav aria-label="ภาพย่อหน้าสมุด" className="living-page-thumbnails">
      {windowed.map((p,i)=><Link href={base+'?page='+p.id} key={p.id}
        onClick={handleLink}
        aria-current={p.id===page.id?'page':undefined}
        className="living-page-thumbnail" data-background={p.background_style}>
        <span>{start+i+1}</span><small>{p.title||'หน้ากระดาษ'}</small>
      </Link>)}
    </nav>
    {editable&&<div className="living-page-settings">
      <h3>จัดการหน้าปัจจุบัน</h3>
      <label>ชื่อหน้า
        <input className="input" value={title} maxLength={160} disabled={busy}
          onChange={e=>{retryBlocked.current=false;setTitle(e.target.value)}}
          placeholder="ตั้งชื่อหน้าความทรงจำ"/>
      </label>
      <label>พื้นหลังกระดาษ
        <select className="input" value={background} disabled={busy}
          onChange={e=>{retryBlocked.current=false;setBackground(e.target.value as PaperBackground)}}>
          {backgrounds.map(bg=><option key={bg} value={bg}>{backgroundNames[bg]}</option>)}
        </select>
      </label>
      <div className="living-page-settings__actions">
        <button type="button" className="button button--secondary"
          disabled={busy||current===0} onClick={()=>void reorder(-1)}>เลื่อนหน้าขึ้น</button>
        <button type="button" className="button button--secondary"
          disabled={busy||current===pages.length-1}
          onClick={()=>void reorder(1)}>เลื่อนหน้าลง</button>
        <button type="button" className="button button--primary"
          disabled={busy||!unsaved} onClick={()=>void savePage()}>
          {busy?'กำลังบันทึก…':unsaved?'บันทึกการเปลี่ยนแปลง':'บันทึกแล้ว'}
        </button>
      </div>
      {!unsaved&&<details className="living-add-page-details">
        <summary>+ เพิ่มหน้ากระดาษเอง</summary>
        <AddLivingBookPageForm spaceId={spaceId} bookId={bookId}/>
      </details>}
    </div>}
    {message&&<p role="status" className="living-page-feedback">{message}</p>}
  </section>
}
