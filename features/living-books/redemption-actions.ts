'use server'

import {revalidatePath} from 'next/cache'
import {isUuid} from '@/lib/auth/validation'
import {getSpaceContext} from '@/features/spaces/data'

type Context={spaceId:string;bookId:string}
export type RedemptionReceipt={
  id:string;status:'requested'|'fulfilled'|'canceled'
  quantity:number;mark_ids?:string[]
}
export type RedemptionActionResult={
  ok:boolean;data?:RedemptionReceipt;message:string;conflict?:boolean
}
const deny=(message:string,conflict=false):RedemptionActionResult=>({
  ok:false,message,conflict,
})
const url=(input:Context)=>'/s/'+input.spaceId+'/stamp-books/living/'+input.bookId
const isReceipt=(value:unknown):value is RedemptionReceipt=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const r=value as Record<string,unknown>
  return isUuid(String(r.id))&&
    ['requested','fulfilled','canceled'].includes(String(r.status))&&
    typeof r.quantity==='number'&&Number.isSafeInteger(r.quantity)&&r.quantity>0&&
    (r.mark_ids===undefined||(Array.isArray(r.mark_ids)&&r.mark_ids.every(isUuid)))
}
async function validContext(input:Context){
  if(!isUuid(input.spaceId)||!isUuid(input.bookId))return null
  const context=await getSpaceContext(input.spaceId)
  const {data,error}=await context.supabase.from('living_books')
    .select('id,space_id,status').eq('id',input.bookId)
    .eq('space_id',input.spaceId).maybeSingle()
  if(error||!data)return null
  return context
}
function errorReply(error:{code?:string;message?:string}|null,operation:string):RedemptionActionResult{
  if(error?.code==='40001')
    return deny('รายการแสตมป์เปลี่ยนไป กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่',true)
  return deny(operation+'ไม่สำเร็จ จำนวนแสตมป์อาจเปลี่ยนหรือคุณไม่มีสิทธิ์ในรายการนี้')
}
export async function requestLivingRedemption(input:Context&{
  quantity:number;rewardMessage:string;idempotencyKey:string
}):Promise<RedemptionActionResult>{
  const reward=input.rewardMessage?.trim()
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1||
    !reward||reward.length>2000||!isUuid(input.idempotencyKey))
    return deny('กรุณาระบุจำนวนแสตมป์และข้อความรางวัลที่ถูกต้อง')
  const context=await validContext(input)
  if(!context)return deny('ไม่พบสมุดหรือไม่มีสิทธิ์ในห้องนี้')
  const {data,error}=await context.supabase.rpc('pointplus_request_living_stamp_redemption',{
    p_book:input.bookId,p_quantity:input.quantity,
    p_reward_message:reward,p_key:input.idempotencyKey,
  })
  if(error||!isReceipt(data))
    return errorReply(error,'ส่งคำขอแลกรางวัล')
  revalidatePath(url(input))
  const message=data.status==='requested'
    ?'จองแสตมป์และส่งคำขอแลกรางวัลแล้ว รอเจ้าของสมุดยืนยัน'
    :data.status==='fulfilled'
      ?'คำขอนี้ได้รับการยืนยันแล้ว แสตมป์ที่ใช้ยังคงเป็นรายการแลกแล้ว'
      :'คำขอนี้ถูกยกเลิกไปแล้ว กรุณาสร้างคำขอใหม่'
  return {ok:true,data,message}
}
export async function fulfillLivingRedemption(input:Context&{
  redemptionId:string
}):Promise<RedemptionActionResult>{
  if(!isUuid(input.redemptionId))return deny('คำขอแลกรางวัลไม่ถูกต้อง')
  const context=await validContext(input)
  if(!context)return deny('ไม่พบสมุดหรือไม่มีสิทธิ์ในห้องนี้')
  const {data,error}=await context.supabase.rpc('pointplus_fulfill_living_stamp_redemption',{
    p_redemption:input.redemptionId,
  })
  if(error||!isReceipt(data)||data.id!==input.redemptionId||data.status!=='fulfilled')
    return errorReply(error,'ยืนยันการแลกรางวัล')
  revalidatePath(url(input))
  return {ok:true,data,message:'ยืนยันการแลกรางวัลแล้ว แสตมป์ที่ใช้จะแสดงรอยแลกแล้ว'}
}
export async function cancelLivingRedemption(input:Context&{
  redemptionId:string
}):Promise<RedemptionActionResult>{
  if(!isUuid(input.redemptionId))return deny('คำขอแลกรางวัลไม่ถูกต้อง')
  const context=await validContext(input)
  if(!context)return deny('ไม่พบสมุดหรือไม่มีสิทธิ์ในห้องนี้')
  const {data,error}=await context.supabase.rpc('pointplus_cancel_living_stamp_redemption',{
    p_redemption:input.redemptionId,
  })
  if(error||!isReceipt(data)||data.id!==input.redemptionId||data.status!=='canceled')
    return errorReply(error,'ยกเลิกคำขอ')
  revalidatePath(url(input))
  return {ok:true,data,message:'ยกเลิกคำขอแล้ว คืนแสตมป์ที่จองไว้ให้ใช้ได้ตามเดิม'}
}
