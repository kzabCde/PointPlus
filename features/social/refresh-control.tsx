'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
/** Polling fallback only: publication and Realtime permissions require live verification. */
export function RefreshControl() {
  const router=useRouter()
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible') router.refresh()
    },45000)
    return ()=>window.clearInterval(timer)
  },[router])
  return <div className="hero__actions">
    <button className="button button--secondary" type="button" onClick={()=>router.refresh()}>
      โหลดข้อมูลล่าสุด
    </button>
    <span className="muted">ตรวจสอบข้อมูลใหม่เป็นระยะเมื่อเปิดหน้านี้</span>
  </div>
}
