import { createClient } from '@/utils/supabase/server'
/** URLs are generated only after RLS authorization; never use public storage URLs. */
export async function PrivateEvidence({path}: {path:string|null}) {
  if(!path) return null
  const supabase=await createClient()
  const {data,error}=await supabase.storage.from('pointplus-evidence')
    .createSignedUrl(path,60)
  if(error || !data?.signedUrl) return <p className="muted">มีไฟล์หลักฐานส่วนตัว แต่ยังเปิดดูไม่ได้</p>
  return <a href={data.signedUrl} className="text-link"
    target="_blank" rel="noopener noreferrer">เปิดไฟล์หลักฐานส่วนตัว (ลิงก์ชั่วคราว)</a>
}
