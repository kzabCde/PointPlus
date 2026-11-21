'use server'

import {revalidatePath} from 'next/cache'
import {isUuid} from '@/lib/auth/validation'
import {getSpaceContext} from '@/features/spaces/data'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import {inspectPhoto} from './photo-validation'
import {photoBucket,photoMaxBytes,photoPath,validCrop,validPlacement,
  type ImageCrop} from './stamp-model'

type Base={spaceId:string;bookId:string}
export type M03Result<T=unknown>={ok:boolean;data?:T;message:string;conflict?:boolean}
const bad=(message:string,conflict=false):M03Result<never>=>({ok:false,message,conflict})
const success=<T>(data:T,message:string):M03Result<T>=>({ok:true,data,message})
const path=(ctx:Base)=>'/s/'+ctx.spaceId+'/stamp-books/living/'+ctx.bookId
function rpcError(error:{code?:string;message?:string}|null,action:string){
  return bad(error?.code==='40001'?'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาเปิดหน้าใหม่ก่อนลองอีกครั้ง':
    action+'ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์หรือโหลดหน้าใหม่',error?.code==='40001')
}
async function owner(ctx:Base){
  if(!isUuid(ctx.spaceId)||!isUuid(ctx.bookId))return null
  const context=await getSpaceContext(ctx.spaceId)
  const {data,error}=await context.supabase.from('living_books')
    .select('owner_user_id,status').eq('space_id',ctx.spaceId)
    .eq('id',ctx.bookId).maybeSingle()
  if(error||!data||data.owner_user_id!==context.user.id||data.status!=='active')return null
  return context
}
async function member(ctx:Base){
  if(!isUuid(ctx.spaceId)||!isUuid(ctx.bookId))return null
  return getSpaceContext(ctx.spaceId)
}
export async function uploadLivingPhoto(input:FormData):
Promise<M03Result<{id:string;version:number;url:string|null;storagePath:string;
  pixelWidth:number;pixelHeight:number;mime:string}>> {
  const spaceId=String(input.get('space_id')??'')
  const bookId=String(input.get('book_id')??'')
  const pageId=String(input.get('page_id')??'')
  const file=input.get('photo')
  if(!isUuid(pageId)||!(file instanceof File)||file.size===0||
    file.size>photoMaxBytes)return bad('ภาพต้องเป็น PNG, JPEG หรือ WebP ขนาดไม่เกิน 6 MB')
  const context=await owner({spaceId,bookId})
  if(!context)return bad('เฉพาะเจ้าของสมุดที่เปิดอยู่สามารถเพิ่มรูปภาพได้')
  const {data:page,error:pageError}=await context.supabase.from('living_book_pages')
    .select('id').eq('id',pageId).eq('book_id',bookId).eq('space_id',spaceId)
    .maybeSingle()
  if(pageError||!page)return bad('หน้านี้ไม่อยู่ในสมุด')
  const bytes=new Uint8Array(await file.arrayBuffer())
  const info=inspectPhoto(bytes,file.type)
  if(!info)return bad('รูปภาพไม่ถูกต้อง รูปเคลื่อนไหว หรือขนาดภาพใหญ่เกินกำหนด')
  const id=crypto.randomUUID()
  const storagePath=photoPath(spaceId,bookId,pageId,id,info.mime)
  if(!storagePath)return bad('รูปแบบภาพไม่รองรับ')
  const storage=context.supabase.storage.from(photoBucket)
  const upload=await storage.upload(storagePath,bytes,{contentType:info.mime,
    cacheControl:'3600',upsert:false})
  if(upload.error)return bad('ไม่สามารถบันทึกภาพส่วนตัว กรุณาลองอีกครั้ง')
  const {data,error}=await context.supabase.rpc('pointplus_create_living_book_image',{
    p_book:bookId,p_page:pageId,p_element:id,p_path:storagePath,
    p_mime:info.mime,p_pixel_width:info.width,p_pixel_height:info.height,
  })
  if(error||!data||!isUuid(String(data.id))){
    await storage.remove([storagePath])
    return rpcError(error,'บันทึกตำแหน่งภาพ')
  }
  const signed=await storage.createSignedUrl(storagePath,20*60)
  revalidatePath(path({spaceId,bookId}))
  return success({id,version:Number(data.version),storagePath,
    pixelWidth:info.width,pixelHeight:info.height,mime:info.mime,
    url:signed.error?null:signed.data.signedUrl},'ติดรูปภาพลงสมุดแล้ว')
}

export async function transformLivingPhoto(input:Base&{
  pageId:string;elementId:string;expectedVersion:number;
  x:number;y:number;width:number;height:number;rotation:number;opacity:number;
  zIndex:number;crop:ImageCrop
}):Promise<M03Result<{id:string;version:number}>>{
  if(!isUuid(input.pageId)||!isUuid(input.elementId)||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||
    ![input.x,input.y,input.width,input.height,input.rotation,input.opacity,input.zIndex]
      .every(Number.isFinite)||input.x<0||input.x>1||input.y<0||input.y>1||
    input.width<.005||input.width>1||input.height<.005||input.height>1||
    input.rotation< -180||input.rotation>180||input.opacity<.05||input.opacity>1||
    !Number.isSafeInteger(input.zIndex)||input.zIndex< -1000000||input.zIndex>1000000||
    !validCrop(input.crop))return bad('ตำแหน่งภาพหรือกรอบครอปไม่ถูกต้อง')
  const context=await owner(input)
  if(!context)return bad('เฉพาะเจ้าของสมุดที่เปิดอยู่สามารถปรับภาพได้')
  const {data,error}=await context.supabase.rpc('pointplus_transform_living_book_image',{
    p_book:input.bookId,p_page:input.pageId,p_element:input.elementId,
    p_x:input.x,p_y:input.y,p_w:input.width,p_h:input.height,
    p_rotation:input.rotation,p_opacity:input.opacity,p_z:input.zIndex,
    p_crop:input.crop,p_expected_version:input.expectedVersion,
  })
  if(error||!data||!isUuid(String(data.id)))return rpcError(error,'แก้ไขภาพ')
  revalidatePath(path(input))
  return success({id:String(data.id),version:Number(data.version)},'บันทึกตำแหน่งและครอปภาพแล้ว')
}

export async function deleteLivingPhoto(input:Base&{
  pageId:string;elementId:string;expectedVersion:number
}):Promise<M03Result<{id:string;version:number;storageRemoved:boolean}>>{
  if(!isUuid(input.pageId)||!isUuid(input.elementId)||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
    return bad('ข้อมูลรูปภาพไม่ถูกต้อง')
  const context=await owner(input)
  if(!context)return bad('เฉพาะเจ้าของสมุดที่เปิดอยู่สามารถลบภาพได้')
  const {data:element,error:readError}=await context.supabase.from('living_book_elements')
    .select('element_type,payload,version').eq('book_id',input.bookId)
    .eq('page_id',input.pageId).eq('id',input.elementId).maybeSingle()
  if(readError||!element||element.element_type!=='image'||
    element.version!==input.expectedVersion)return bad('ภาพถูกแก้ไขหรือลบจากที่อื่นแล้ว')
  const storagePath=String(element.payload?.storagePath??'')
  const {data,error}=await context.supabase.rpc('pointplus_delete_living_book_element',{
    p_book:input.bookId,p_page:input.pageId,p_element:input.elementId,
    p_expected_version:input.expectedVersion,
  })
  if(error||!data?.deleted)return rpcError(error,'ลบภาพ')
  const deleted=await context.supabase.storage.from(photoBucket).remove([storagePath])
  revalidatePath(path(input))
  return success({id:input.elementId,version:Number(data.version),
    storageRemoved:!deleted.error},
    deleted.error?'ลบภาพจากหน้าสมุดแล้ว แต่การลบไฟล์ยังไม่สำเร็จ':'ลบภาพออกจากสมุดแล้ว')
}

type StampRequestData={request_id:string;mark_id:string|null;status:string}
export async function giveLivingStamp(input:Base&{
  pageId:string;assetId:string;note:string;key:string;
  x:number;y:number;rotation:number;scale:number
}):Promise<M03Result<StampRequestData>>{
  if(!isUuid(input.pageId)||!isUuid(input.key)||!validPlacement(
    input.x,input.y,input.rotation,input.scale)||
    input.note.length>1000||
    !pointPlusStamps.some(s=>s.id===input.assetId))return bad('ข้อมูลแสตมป์ไม่ถูกต้อง')
  const context=await member(input)
  if(!context)return bad('กรุณาเข้าสู่ระบบก่อนให้แสตมป์')
  const {data,error}=await context.supabase.rpc('pointplus_give_living_stamp',{
    p_book:input.bookId,p_page:input.pageId,p_asset:input.assetId,
    p_note:input.note,p_key:input.key,p_x:input.x,p_y:input.y,
    p_rotation:input.rotation,p_scale:input.scale,
  })
  if(error||!data?.request_id||!['pending','approved'].includes(data.status))
    return rpcError(error,'ให้แสตมป์')
  revalidatePath(path(input))
  return success(data as StampRequestData,data.status==='pending'?
    'ส่งคำขอแสตมป์แล้ว รออีกฝ่ายอนุมัติ':'ประทับแสตมป์แล้ว')
}
export async function reviewLivingStamp(input:Base&{
  requestId:string;approve:boolean
}):Promise<M03Result<StampRequestData>>{
  if(!isUuid(input.requestId)||typeof input.approve!=='boolean')
    return bad('ข้อมูลการอนุมัติไม่ถูกต้อง')
  const context=await member(input)
  if(!context)return bad('กรุณาเข้าสู่ระบบ')
  const {data,error}=await context.supabase.rpc('pointplus_review_living_stamp',{
    p_request:input.requestId,p_approve:input.approve,
  })
  if(error||!data?.request_id)return rpcError(error,'อนุมัติแสตมป์')
  revalidatePath(path(input))
  return success(data as StampRequestData,input.approve?'อนุมัติแสตมป์แล้ว':'ปฏิเสธคำขอแล้ว')
}
export async function cancelLivingStampRequest(input:Base&{requestId:string}):
Promise<M03Result<{request_id:string;status:string}>>{
  if(!isUuid(input.requestId))return bad('คำขอไม่ถูกต้อง')
  const context=await member(input)
  if(!context)return bad('กรุณาเข้าสู่ระบบ')
  const {data,error}=await context.supabase.rpc('pointplus_cancel_living_stamp_request',{
    p_request:input.requestId,
  })
  if(error||!data?.request_id)return rpcError(error,'ยกเลิกคำขอ')
  revalidatePath(path(input))
  return success(data as {request_id:string;status:string},'ยกเลิกคำขอแสตมป์แล้ว')
}
export async function transformLivingStamp(input:Base&{
  markId:string;pageId:string;x:number;y:number;rotation:number;
  scale:number;expectedVersion:number
}):Promise<M03Result<{id:string;version:number;state:string}>>{
  if(!isUuid(input.markId)||!isUuid(input.pageId)||!validPlacement(
    input.x,input.y,input.rotation,input.scale)||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
    return bad('ตำแหน่งแสตมป์ไม่ถูกต้อง')
  const context=await owner(input)
  if(!context)return bad('เฉพาะเจ้าของสมุดที่เปิดอยู่สามารถจัดวางแสตมป์ได้')
  const {data,error}=await context.supabase.rpc('pointplus_transform_living_stamp',{
    p_mark:input.markId,p_page:input.pageId,p_x:input.x,p_y:input.y,
    p_rotation:input.rotation,p_scale:input.scale,
    p_expected_version:input.expectedVersion,
  })
  if(error||!data?.id)return rpcError(error,'ย้ายแสตมป์')
  revalidatePath(path(input))
  return success(data as {id:string;version:number;state:string},'บันทึกตำแหน่งแสตมป์แล้ว')
}
export async function peelLivingStamp(input:Base&{
  markId:string;expectedVersion:number
}):Promise<M03Result<{id:string;version:number;state:string}>>{
  if(!isUuid(input.markId)||!Number.isSafeInteger(input.expectedVersion)||
    input.expectedVersion<1)return bad('ข้อมูลแสตมป์ไม่ถูกต้อง')
  const context=await owner(input)
  if(!context)return bad('เฉพาะเจ้าของสมุดที่เปิดอยู่สามารถลอกแสตมป์ได้')
  const {data,error}=await context.supabase.rpc('pointplus_peel_living_stamp',{
    p_mark:input.markId,p_expected_version:input.expectedVersion,
  })
  if(error||data?.state!=='peeled')return rpcError(error,'ลอกแสตมป์')
  revalidatePath(path(input))
  return success(data as {id:string;version:number;state:string},'ลอกแสตมป์แล้ว โดยเก็บรอยและประวัติไว้')
}
