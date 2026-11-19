'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { submitMissionAction } from './actions'
const allowedTypes: Record<string,string> = {
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf',
}
export function SubmissionForm({spaceId,missionId,participantId,disabled=false}:{
  spaceId:string; missionId:string; participantId:string; disabled?:boolean
}) {
  const router=useRouter()
  const [proofText,setProofText]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [success,setSuccess]=useState(false)
  const pending=useRef(false)
  const key=useRef<string|null>(null)
  const uploaded=useRef<string|null>(null)

  async function handleSubmit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(disabled || pending.current) return
    pending.current=true;setBusy(true);setMessage('')
    try {
      const supabase=createClient()
      let proofPath=uploaded.current ?? undefined
      if (file && !proofPath) {
        const extension=allowedTypes[file.type]
        if (!extension || file.size>5*1024*1024 || file.size===0) {
          setMessage('ไฟล์ต้องเป็น JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 5 MB');return
        }
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError || !auth.user) {setMessage('กรุณาเข้าสู่ระบบอีกครั้ง');return}
        const path=auth.user.id+'/'+crypto.randomUUID()+'.'+extension
        const {error:uploadError}=await supabase.storage.from('pointplus-evidence')
          .upload(path,file,{contentType:file.type,upsert:false})
        if(uploadError) {setMessage('อัปโหลดหลักฐานไม่สำเร็จ: '+uploadError.message);return}
        uploaded.current=path;proofPath=path
      }
      key.current ??=crypto.randomUUID()
      const result=await submitMissionAction({
        spaceId,missionId,participantId,idempotencyKey:key.current,
        proofText,proofPath,
      })
      setMessage(result.message)
      if(result.status==='success') {
        setSuccess(true);key.current=null;router.refresh()
      }
    } catch {
      setMessage('ไม่สามารถส่งภารกิจได้ กรุณาลองใหม่โดยไม่เปลี่ยนข้อมูลเดิม')
    } finally {pending.current=false;setBusy(false)}
  }
  return <form className="card social-form" onSubmit={handleSubmit}>
    <h3>ส่งหลักฐานการทำภารกิจ</h3>
    <p className="muted">ข้อความและไฟล์เป็นทางเลือก เว้นแต่รายละเอียดภารกิจจะระบุไว้ ผู้มีสิทธิ์ตรวจภารกิจเท่านั้นที่ดูไฟล์ได้</p>
    <div className="form-field"><label htmlFor="submission-proof">บันทึกสิ่งที่ทำ (ไม่บังคับ)</label>
      <textarea id="submission-proof" className="input" maxLength={4000} rows={3}
        value={proofText} disabled={busy||success} onChange={e=>setProofText(e.target.value)}/></div>
    <div className="form-field"><label htmlFor="submission-file">รูปภาพหรือ PDF (ไม่บังคับ, ไม่เกิน 5 MB)</label>
      <input id="submission-file" type="file" className="input" accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={busy||success||Boolean(uploaded.current)}
        onChange={e=>setFile(e.target.files?.[0]??null)}/></div>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <button className="button button--primary" disabled={busy||success||disabled} type="submit">
      {busy?'กำลังส่ง…':success?'ส่งแล้ว':'ส่งภารกิจ'}
    </button>
  </form>
}
