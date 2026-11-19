'use server'

import { revalidatePath } from 'next/cache'
import { field, isUuid } from '@/lib/auth/validation'
import { canManage, getSpaceContext } from '@/features/spaces/data'
import { pointPlusStamps } from '@/lib/point-plus/assets'

export type StampBookState = {
  status: 'idle' | 'success' | 'error'
  message: string
  bookId?: string
}
const fail = (message:string):StampBookState => ({status:'error',message})
const success = (message:string,bookId?:string):StampBookState => ({status:'success',message,bookId})
const isKey = (value:string) => isUuid(value)
const text = (form:FormData,name:string) => field(form,name)
const list = (form:FormData,name:string) => form.getAll(name).map(String).filter(Boolean)
const refresh = (spaceId:string,bookId?:string) => {
  revalidatePath('/s/'+spaceId)
  revalidatePath('/s/'+spaceId+'/stamp-books')
  if(bookId) revalidatePath('/s/'+spaceId+'/stamp-books/'+bookId)
}
export async function createStampBookAction(_prev:StampBookState, form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id')
  const title=text(form,'title')
  const description=text(form,'description')
  const target=Number(text(form,'target_count'))
  const recipients=list(form,'recipient_id')
  const givers=list(form,'giver_id')
  const styles=list(form,'asset_id')
  const rewards=text(form,'rewards').split('\n').map(s=>s.trim()).filter(Boolean)
  const approval=text(form,'approval_policy')
  if(!isUuid(spaceId)||title.length<1||title.length>160||description.length>2000||
     !Number.isInteger(target)||target<1||target>100||
     !['direct','approval_required'].includes(approval)||
     !recipients.length||recipients.length>30||!givers.length||givers.length>30||
     !styles.length||styles.length>18||!rewards.length||rewards.length>20||
     !recipients.every(isUuid)||!givers.every(isUuid)||
     !styles.every(id=>pointPlusStamps.some(s=>s.id===id))||
     rewards.some(s=>s.length>160)) return fail('กรุณาตรวจชื่อ จำนวนช่อง สมาชิก ผู้ให้แสตมป์ ลาย และรายการรางวัล')
  const {supabase,member}=await getSpaceContext(spaceId)
  if(!canManage(member.role)) return fail('เฉพาะผู้ดูแลห้องที่สร้างสมุดได้')
  const {data,error}=await supabase.rpc('pointplus_create_stamp_book',{
    p_space:spaceId,p_title:title,p_description:description||null,p_target:target,
    p_repeatable:form.get('repeatable')==='on',
    p_allow_self:form.get('allow_self_stamp')==='on',
    p_approval:approval,p_recipients:recipients,p_givers:givers,p_styles:styles,p_rewards:rewards,
  })
  if(error||!data||!isUuid(String(data))) return fail('สร้างสมุดไม่สำเร็จ กรุณาตรวจสอบการติดตั้งฐานข้อมูลใหม่และสิทธิ์')
  refresh(spaceId,String(data))
  return success('สร้างสมุดสะสมแล้ว',String(data))
}
export async function giveStampAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),person=text(form,'recipient_id')
  const art=text(form,'asset_id'),note=text(form,'note'),key=text(form,'idempotency_key')
  if(![spaceId,bookId,person,key].every(isKey)||!pointPlusStamps.some(s=>s.id===art)||note.length>1000)
    return fail('ข้อมูลการให้แสตมป์ไม่ถูกต้อง')
  const {supabase}=await getSpaceContext(spaceId)
  const {data:book,error:bookError}=await supabase.from('stamp_books')
    .select('id').eq('space_id',spaceId).eq('id',bookId).maybeSingle()
  if(bookError||!book) return fail('ไม่พบสมุดนี้ในห้อง')
  const {data,error}=await supabase.rpc('pointplus_give_stamp',{
    p_book:bookId,p_recipient:person,p_art:art,p_note:note||null,p_key:key,
  })
  if(error)return fail('ให้แสตมป์ไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success(data?.status==='pending'?'ส่งคำขอแสตมป์ รอผู้ดูแลอนุมัติ':'เพิ่มแสตมป์ 1 ดวงแล้ว')
}
export async function reviewStampAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),requestId=text(form,'request_id')
  const decision=text(form,'decision')
  if(![spaceId,bookId,requestId].every(isUuid)||!['approve','reject'].includes(decision))
    return fail('รายการตรวจแสตมป์ไม่ถูกต้อง')
  const {supabase,member}=await getSpaceContext(spaceId)
  if(!canManage(member.role))return fail('เฉพาะผู้ดูแลห้องที่ตรวจได้')
  const {data,error:scopeError}=await supabase.from('stamp_book_stamp_requests')
    .select('id').eq('id',requestId).eq('space_id',spaceId).eq('book_id',bookId).maybeSingle()
  if(scopeError||!data)return fail('ไม่พบรายการนี้ในห้อง')
  const {error}=await supabase.rpc('pointplus_review_stamp_request',{
    p_request:requestId,p_approve:decision==='approve',
  })
  if(error)return fail('ตรวจแสตมป์ไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success(decision==='approve'?'อนุมัติแสตมป์แล้ว':'ปฏิเสธคำขอแล้ว')
}
export async function claimStampRewardAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),cycle=text(form,'cycle_id')
  const reward=text(form,'reward_id'),key=text(form,'idempotency_key')
  if(![spaceId,bookId,cycle,reward,key].every(isUuid))return fail('ข้อมูลการเลือกรางวัลไม่ถูกต้อง')
  const {supabase}=await getSpaceContext(spaceId)
  const [{data:c,error:ce},{data:r,error:re}]=await Promise.all([
    supabase.from('stamp_book_cycles').select('id').eq('id',cycle)
      .eq('book_id',bookId).eq('space_id',spaceId).maybeSingle(),
    supabase.from('stamp_book_reward_options').select('id').eq('id',reward)
      .eq('book_id',bookId).eq('space_id',spaceId).maybeSingle(),
  ])
  if(ce||re||!c||!r)return fail('สมุด รอบสะสม หรือรางวัลไม่ได้อยู่ในห้องนี้')
  const {error}=await supabase.rpc('pointplus_claim_stamp_book_reward',{
    p_cycle:cycle,p_reward:reward,p_key:key,
  })
  if(error)return fail('เลือกรางวัลไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success('เลือกรางวัลสำเร็จ รอการส่งมอบโดยผู้ดูแล')
}
export async function processStampClaimAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),claim=text(form,'claim_id')
  const decision=text(form,'decision')
  if(![spaceId,bookId,claim].every(isUuid)||!['fulfilled','canceled'].includes(decision))
    return fail('ข้อมูลการส่งมอบไม่ถูกต้อง')
  const {supabase,member}=await getSpaceContext(spaceId)
  if(!canManage(member.role))return fail('เฉพาะผู้ดูแลห้องที่ส่งมอบรางวัลได้')
  const {data,error:scopeError}=await supabase.from('stamp_book_claims').select('id')
    .eq('id',claim).eq('book_id',bookId).eq('space_id',spaceId).maybeSingle()
  if(scopeError||!data)return fail('ไม่พบรายการรางวัลในห้อง')
  const {error}=await supabase.rpc('pointplus_process_stamp_book_claim',{
    p_claim:claim,p_decision:decision,
  })
  if(error)return fail('ดำเนินการไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success(decision==='fulfilled'?'บันทึกการส่งมอบแล้ว':'ยกเลิกการส่งมอบแล้ว')
}
export async function updateStampBookAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),title=text(form,'title')
  const description=text(form,'description'),status=text(form,'status')
  const target=Number(text(form,'target_count'))
  if(![spaceId,bookId].every(isUuid)||title.length<1||title.length>160||
    description.length>2000||!['active','paused','archived'].includes(status)||
    !Number.isInteger(target)||target<1||target>100)return fail('ข้อมูลสมุดไม่ถูกต้อง')
  const {supabase,member}=await getSpaceContext(spaceId)
  if(!canManage(member.role))return fail('ไม่มีสิทธิ์แก้ไขสมุด')
  const {data,error:scopeError}=await supabase.from('stamp_books').select('id').eq('id',bookId).eq('space_id',spaceId).maybeSingle()
  if(scopeError||!data)return fail('ไม่พบสมุดในห้อง')
  const {error}=await supabase.rpc('pointplus_update_stamp_book',{
    p_book:bookId,p_title:title,p_description:description||null,p_status:status,p_target:target,
  })
  if(error)return fail('บันทึกสมุดไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success('อัปเดตสมุดแล้ว')
}
export async function addStampRewardAction(_prev:StampBookState,form:FormData):Promise<StampBookState> {
  const spaceId=text(form,'space_id'),bookId=text(form,'book_id'),title=text(form,'title')
  const description=text(form,'description'),stockText=text(form,'stock')
  const stock=stockText===''?null:Number(stockText)
  if(![spaceId,bookId].every(isUuid)||title.length<1||title.length>160||
    description.length>2000||(stock!==null&&(!Number.isInteger(stock)||stock<0)))
    return fail('ข้อมูลรางวัลไม่ถูกต้อง')
  const {supabase,member}=await getSpaceContext(spaceId)
  if(!canManage(member.role))return fail('ไม่มีสิทธิ์เพิ่มรางวัล')
  const {data,error:scopeError}=await supabase.from('stamp_books').select('id').eq('id',bookId).eq('space_id',spaceId).maybeSingle()
  if(scopeError||!data)return fail('ไม่พบสมุดนี้')
  const {error}=await supabase.rpc('pointplus_add_stamp_book_reward',{
    p_book:bookId,p_title:title,p_description:description||null,p_stock:stock,
  })
  if(error)return fail('เพิ่มรางวัลไม่สำเร็จ: '+error.message)
  refresh(spaceId,bookId)
  return success('เพิ่มตัวเลือกรางวัลแล้ว')
}
