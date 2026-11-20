'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markNotificationReadAction } from './actions'
import type { NotificationItem } from './notifications'
import { notificationDestination } from './notification-links'

export function NotificationCenter({items}: {items:NotificationItem[]}) {
  const router=useRouter()
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState('')
  async function mark(id:string) {
    setBusy(id);setError('')
    try {
      const result=await markNotificationReadAction(id)
      if(result.status==='success') router.refresh()
      else setError(result.message)
    } catch {setError('บันทึกการอ่านไม่ได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง')}
    finally {setBusy(null)}
  }
  if(!items.length) return <div className="card empty-state" role="status">ยังไม่มีการแจ้งเตือน</div>
  return <>
    {error && <p role="alert" className="form-field__error">{error}</p>}
    <ul className="social-stack notification-list">
    {items.map(n=><li key={n.id} className="card notification-entry" data-unread={!n.read_at}>
      <div className="space-header">
        <h2>{n.title}</h2>
        <time className="room-meta" dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</time>
      </div>
      {n.body && <p>{n.body}</p>}
      <p className="muted">{n.read_at?'อ่านแล้ว':'ยังไม่ได้อ่าน'}</p>
      <div className="hero__actions">
        <Link className="button button--secondary" href={notificationDestination(n)}>ดูที่เกี่ยวข้อง</Link>
        {!n.read_at && <button className="button button--primary" disabled={busy !== null}
          onClick={()=>void mark(n.id)}>{busy===n.id?'กำลังบันทึก…':'ทำเครื่องหมายว่าอ่านแล้ว'}</button>}
      </div>
    </li>)}
    </ul>
  </>
}
