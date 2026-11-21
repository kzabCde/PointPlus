'use server'

import { revalidatePath } from 'next/cache'
import { field, isUuid } from '@/lib/auth/validation'
import { getSpaceContext } from '@/features/spaces/data'
import { pointPlusStamps } from '@/lib/point-plus/assets'

export type LivingActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  bookId?: string
  pageId?: string
}
const fail = (message:string):LivingActionState => ({status:'error',message})
const text = (data:FormData,name:string) => field(data,name)

export async function createLivingBookAction(_previous:LivingActionState,form:FormData):Promise<LivingActionState> {
  const spaceId=text(form,'space_id')
  const recipient=text(form,'recipient_id')
  const title=text(form,'title')
  const description=text(form,'description')
  const cover=text(form,'cover_asset_id')
  const approval=text(form,'approval_policy')
  const key=text(form,'idempotency_key')
  if (![spaceId,recipient,key].every(isUuid) ||
    title.length<1 || title.length>160 || description.length>2000 ||
    !['direct','approval_required'].includes(approval) ||
    !pointPlusStamps.some(stamp=>stamp.id===cover))
    return fail('กรุณาตรวจชื่อสมุด ผู้รับ ลายปก และข้อมูลการสร้าง')

  const {supabase,space,member}=await getSpaceContext(spaceId)
  if (space.kind!=='couple' && !['owner','admin'].includes(member.role))
    return fail('เฉพาะผู้ดูแลห้องที่สร้างสมุดได้')

  const {data,error}=await supabase.rpc('pointplus_create_living_book',{
    p_space:spaceId,p_recipient:recipient,p_title:title,
    p_description:description||null,p_cover:cover,p_approval:approval,p_key:key,
  })
  if(error || !data || !isUuid(String(data)))
    return fail('สร้างสมุดไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และฐานข้อมูล Living Stampbook V3')

  revalidatePath('/s/'+spaceId+'/stamp-books')
  return {status:'success',message:'สร้างสมุด Living พร้อมกระดาษหน้าแรกแล้ว',bookId:String(data)}
}

export async function addLivingBookPageAction(_previous:LivingActionState,form:FormData):Promise<LivingActionState> {
  const spaceId=text(form,'space_id')
  const bookId=text(form,'book_id')
  const key=text(form,'idempotency_key')
  const title=text(form,'title')
  const background=text(form,'background_style')
  if(![spaceId,bookId,key].every(isUuid) || title.length>160 ||
    !['cream','white','lined','grid','kraft'].includes(background))
    return fail('ข้อมูลหน้ากระดาษไม่ถูกต้อง')

  const {supabase,user}=await getSpaceContext(spaceId)
  const {data:book,error:scopeError}=await supabase.from('living_books')
    .select('id,owner_user_id').eq('id',bookId).eq('space_id',spaceId).maybeSingle()
  if(scopeError || !book || book.owner_user_id!==user.id)
    return fail('เฉพาะเจ้าของสมุดเท่านั้นที่เพิ่มหน้ากระดาษได้')

  const {data,error}=await supabase.rpc('pointplus_add_living_book_page',{
    p_book:bookId,p_key:key,p_title:title||null,p_background:background,
  })
  if(error || !data || !isUuid(String(data)))
    return fail('เพิ่มหน้าไม่สำเร็จ ตรวจสอบสถานะสมุดและลองอีกครั้ง')

  revalidatePath('/s/'+spaceId+'/stamp-books/living/'+bookId)
  return {status:'success',message:'เพิ่มหน้ากระดาษแล้ว',bookId,pageId:String(data)}
}
