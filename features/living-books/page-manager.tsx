'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddLivingBookPageForm } from './forms'
import { reorderLivingPages, updateLivingPageSettings } from './editor-actions'
import { orderedPageIds, backgrounds, type LivingEditorPage,type PaperBackground } from './editor-model'

const backgroundNames:Record<PaperBackground,string> = {
  cream:'ครีม',white:'ขาว',lined:'มีเส้น',grid:'ตาราง',kraft:'คราฟต์',
}
export function LivingPageManager({spaceId,bookId,pages,page,editable}:{
  spaceId:string;bookId:string;pages:LivingEditorPage[];page:LivingEditorPage;editable:boolean
}) {
  const router=useRouter()
  const [title,setTitle]=useState(page.title??'')
  const [background,setBackground]=useState<PaperBackground>(page.background_style)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{
    setTitle(page.title??'')
    setBackground(page.background_style)
    setMessage('')
  },[page.id,page.version,page.title,page.background_style])

  const current=pages.findIndex(p=>p.id===page.id)
  const base='/s/'+spaceId+'/stamp-books/living/'+bookId
  async function savePage() {
    if(!editable||busy)return
    setBusy(true);setMessage('')
    try {
      const result=await updateLivingPageSettings({
        spaceId,bookId,pageId:page.id,title,background,expectedVersion:page.version,
      })
      setMessage(result.ok?'บันทึกชื่อและพื้นหลังหน้าแล้ว':result.error??'เกิดข้อผิดพลาด')
      if(result.ok||result.conflict)router.refresh()
    } catch {setMessage('เชื่อมต่อไม่ได้ ข้อมูลหน้ายังไม่ถูกบันทึก')}
    finally {setBusy(false)}
  }
  async function reorder(direction:-1|1) {
    if(!editable||busy)return
    const ids=orderedPageIds(pages,page.id,direction)
    if(!ids)return
    setBusy(true);setMessage('')
    try{
      const result=await reorderLivingPages({spaceId,bookId,pageIds:ids})
      setMessage(result.ok?'เปลี่ยนลำดับหน้าแล้ว':result.error??'ไม่สามารถเปลี่ยนลำดับหน้า')
      if(result.ok||result.conflict)router.refresh()
    }catch {setMessage('เชื่อมต่อไม่ได้ ลำดับหน้ายังไม่เปลี่ยน')}
    finally{setBusy(false)}
  }

  return <section className="living-page-manager" aria-label="ตัวจัดการหน้าสมุด">
    <div className="living-page-controls">
      <Link aria-disabled={current===0} tabIndex={current===0?-1:0}
        className={'button button--secondary'+(current===0?' is-disabled':'')}
        href={current>0?base+'?page='+pages[current-1].id:base+'?page='+page.id}>← ก่อนหน้า</Link>
      <span role="status">หน้า {current+1} / {pages.length}</span>
      <Link aria-disabled={current===pages.length-1} tabIndex={current===pages.length-1?-1:0}
        className={'button button--secondary'+(current===pages.length-1?' is-disabled':'')}
        href={current<pages.length-1?base+'?page='+pages[current+1].id:base+'?page='+page.id}>ถัดไป →</Link>
    </div>
    <label className="living-page-jump">ไปยังหน้า
      <select className="input" value={page.id}
        onChange={e=>router.push(base+'?page='+e.target.value)}>
        {pages.map((p,i)=><option value={p.id} key={p.id}>{i+1} · {p.title||'หน้ากระดาษ'}</option>)}
      </select>
    </label>
    <nav aria-label="ภาพย่อหน้าสมุด" className="living-page-thumbnails">
      {pages.map((p,i)=><Link href={base+'?page='+p.id} key={p.id}
        aria-current={p.id===page.id?'page':undefined}
        className="living-page-thumbnail" data-background={p.background_style}>
        <span>{i+1}</span><small>{p.title||'หน้ากระดาษ'}</small>
      </Link>)}
    </nav>
    {editable && <div className="living-page-settings">
      <h3>จัดการหน้าปัจจุบัน</h3>
      <label>ชื่อหน้า
        <input className="input" value={title} maxLength={160} disabled={busy}
          onChange={e=>setTitle(e.target.value)} placeholder="ตั้งชื่อหน้าความทรงจำ"/>
      </label>
      <label>พื้นหลังกระดาษ
        <select className="input" value={background} disabled={busy}
          onChange={e=>setBackground(e.target.value as PaperBackground)}>
          {backgrounds.map(bg=><option key={bg} value={bg}>{backgroundNames[bg]}</option>)}
        </select>
      </label>
      <div className="living-page-settings__actions">
        <button className="button button--secondary" type="button" disabled={busy||current===0}
          onClick={()=>void reorder(-1)}>เลื่อนหน้าขึ้น</button>
        <button className="button button--secondary" type="button" disabled={busy||current===pages.length-1}
          onClick={()=>void reorder(1)}>เลื่อนหน้าลง</button>
        <button className="button button--primary" type="button" disabled={busy}
          onClick={()=>void savePage()}>บันทึกหน้ากระดาษ</button>
      </div>
      <details className="living-add-page-details">
        <summary>+ เพิ่มหน้ากระดาษเอง</summary>
        <AddLivingBookPageForm spaceId={spaceId} bookId={bookId}/>
      </details>
    </div>}
    {message&&<p role="status" className="living-page-feedback">{message}</p>}
  </section>
}
