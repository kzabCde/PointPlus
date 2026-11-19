'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markNotificationReadAction } from './actions'
import { notificationDestination,type NotificationItem } from './notifications'

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
    } catch {setError('ไม่สามารถบันทึกการอ่านได้')}
    finally {setBusy(null)}
  }
  if(!items.length) return <div className="card empty-state" role="status">ยังไม่มีการแจ้งเตือน</div>
  return <div className="social-stack">
    {error && <p role="alert">{error}</p>}
    {items.map(n=><article key={n.id} className="card">
      <div className="space-header">
        <h3>{n.title}</h3>
        <small className="muted">{new Date(n.created_at).toLocaleString('th-TH')}</small>
      </div>
      {n.body && <p>{n.body}</p>}
      <p className="muted">{n.read_at?'อ่านแล้ว':'ยังไม่ได้อ่าน'}</p>
      <div className="hero__actions">
        <Link className="button button--secondary" href={notificationDestination(n)}>ดูที่เกี่ยวข้อง</Link>
        {!n.read_at && <button className="button button--primary" disabled={busy===n.id}
          onClick={()=>void mark(n.id)}>{busy===n.id?'กำลังบันทึก…':'ทำเครื่องหมายว่าอ่านแล้ว'}</button>}
      </div>
    </article>)}
  </div>
}
