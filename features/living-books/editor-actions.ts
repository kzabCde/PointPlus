'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/auth/validation'
import { getSpaceContext } from '@/features/spaces/data'
import {
  backgrounds,validPayload, type EditorElement,type PaperBackground,
} from './editor-model'

export type EditorResult<T=unknown> = {
  ok:boolean;data?:T;error?:string;conflict?:boolean
}
const reject = (error:string, conflict=false):EditorResult<never> => ({ok:false,error,conflict})
type Context = {spaceId:string;bookId:string}
async function ownerContext({spaceId,bookId}:Context) {
  if(!isUuid(spaceId)||!isUuid(bookId))return null
  const context=await getSpaceContext(spaceId)
  const {data,error}=await context.supabase.from('living_books')
    .select('id,owner_user_id,status').eq('space_id',spaceId).eq('id',bookId).maybeSingle()
  if(error||!data||data.owner_user_id!==context.user.id||data.status!=='active')return null
  return context
}
function isRecord(data:unknown):data is Record<string,unknown> {
  return data!==null&&typeof data==='object'&&!Array.isArray(data)
}
function isVersioned(data:unknown):data is {id:string;version:number} {
  return isRecord(data)&&typeof data.id==='string'&&isUuid(data.id)&&
    typeof data.version==='number'&&Number.isSafeInteger(data.version)&&data.version>=1
}
type PageReply={id:string;version:number;title:string|null;background_style:PaperBackground}
function isPageReply(data:unknown):data is PageReply {
  return isVersioned(data)&&isRecord(data)&&
    (data.title===null||typeof data.title==='string')&&
    backgrounds.includes(data.background_style as PaperBackground)
}
type ElementReply={id:string;version:number;updated_at:string}
function isElementReply(data:unknown):data is ElementReply {
  return isVersioned(data)&&isRecord(data)&&typeof data.updated_at==='string'
}
type DeleteReply={id:string;version:number;deleted:boolean}
function isDeleteReply(data:unknown):data is DeleteReply {
  return isVersioned(data)&&isRecord(data)&&data.deleted===true
}
function isCount(data:unknown):data is number {
  return typeof data==='number'&&Number.isSafeInteger(data)&&data>=0
}
function response<T>(data:unknown,error:{message?:string;code?:string}|null,
  fallback:string,validator:(value:unknown)=>value is T):EditorResult<T> {
  if(error||!validator(data))return {ok:false,error:error?.code==='40001'?
    'มีการแก้ไขจากอีกหน้าต่าง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่':fallback,
    conflict:error?.code==='40001'}
  return {ok:true,data}
}
export type PageSettingsInput = Context&{
  pageId:string;title:string;background:PaperBackground;expectedVersion:number
}
export async function updateLivingPageSettings(input:PageSettingsInput):
  Promise<EditorResult<{id:string;version:number;title:string|null;background_style:PaperBackground}>> {
  if(!isUuid(input.pageId)||input.title.length>160||
    !backgrounds.includes(input.background)||!Number.isSafeInteger(input.expectedVersion)||
    input.expectedVersion<1)return reject('ข้อมูลหน้ากระดาษไม่ถูกต้อง')
  const context=await ownerContext(input)
  if(!context)return reject('เฉพาะเจ้าของสมุดที่เปิดใช้งานเท่านั้นที่แก้ไขหน้าได้')
  const {data,error}=await context.supabase.rpc('pointplus_update_living_book_page',{
    p_book:input.bookId,p_page:input.pageId,p_title:input.title,
    p_background:input.background,p_expected_version:input.expectedVersion,
  })
  const result=response(data,error,'แก้ไขหน้ากระดาษไม่สำเร็จ',isPageReply)
  if(result.ok)revalidatePath('/s/'+input.spaceId+'/stamp-books/living/'+input.bookId)
  return result
}
export async function reorderLivingPages(input:Context&{pageIds:string[]}):
  Promise<EditorResult<number>> {
  if(!Array.isArray(input.pageIds)||input.pageIds.length<1||
    input.pageIds.some(id=>!isUuid(id))||new Set(input.pageIds).size!==input.pageIds.length)
    return reject('ลำดับหน้ากระดาษไม่ถูกต้อง')
  const context=await ownerContext(input)
  if(!context)return reject('เฉพาะเจ้าของสมุดที่เปิดใช้งานเท่านั้นที่จัดเรียงหน้าได้')
  const {data,error}=await context.supabase.rpc('pointplus_reorder_living_book_pages',{
    p_book:input.bookId,p_page_ids:input.pageIds,
  })
  const result=response(data,error,'เรียงลำดับหน้าไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุด',isCount)
  if(result.ok)revalidatePath('/s/'+input.spaceId+'/stamp-books/living/'+input.bookId)
  return result
}
export type SaveElementInput = Context&{
  pageId:string;element:EditorElement;expectedVersion:number
}
export async function saveLivingElement(input:SaveElementInput):
  Promise<EditorResult<{id:string;version:number;updated_at:string}>> {
  const e=input.element
  if(!e||!isUuid(input.pageId)||!isUuid(e.id)||
    e.book_id!==input.bookId||e.page_id!==input.pageId||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||
    !['text','drawing'].includes(e.element_type)||
    !validPayload(e.element_type,e.payload)||
    JSON.stringify(e.payload).length>65536||
    [e.position_x,e.position_y,e.width,e.height,e.rotation_deg,e.opacity,e.z_index]
      .some(n=>typeof n!=='number'||!Number.isFinite(n))||
    e.position_x<0||e.position_x>1||e.position_y<0||e.position_y>1||
    e.width<.005||e.width>1||e.height<.005||e.height>1||
    e.rotation_deg< -180||e.rotation_deg>180||
    e.opacity<.05||e.opacity>1||
    !Number.isInteger(e.z_index)||e.z_index< -1000000||e.z_index>1000000)
    return reject('ข้อความหรือรูปวาดไม่ถูกต้อง')
  const context=await ownerContext(input)
  if(!context)return reject('เฉพาะเจ้าของสมุดที่เปิดใช้งานเท่านั้นที่แก้ไขวัตถุได้')
  const {data,error}=await context.supabase.rpc('pointplus_save_living_book_element',{
    p_book:input.bookId,p_page:input.pageId,p_element:e.id,p_type:e.element_type,
    p_payload:e.payload,p_x:e.position_x,p_y:e.position_y,p_width:e.width,
    p_height:e.height,p_rotation:e.rotation_deg,p_opacity:e.opacity,
    p_z:e.z_index,p_expected_version:input.expectedVersion,
  })
  const result=response(data,error,'ไม่สามารถบันทึกวัตถุลงบนกระดาษได้',isElementReply)
  if(result.ok)revalidatePath('/s/'+input.spaceId+'/stamp-books/living/'+input.bookId)
  return result
}
export async function deleteLivingElement(input:Context&{
  pageId:string;elementId:string;expectedVersion:number
}):Promise<EditorResult<{id:string;version:number;deleted:boolean}>> {
  if(!isUuid(input.pageId)||!isUuid(input.elementId)||
    !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
    return reject('ข้อมูลวัตถุไม่ถูกต้อง')
  const context=await ownerContext(input)
  if(!context)return reject('เฉพาะเจ้าของสมุดที่เปิดใช้งานเท่านั้นที่ลบวัตถุได้')
  const {data,error}=await context.supabase.rpc('pointplus_delete_living_book_element',{
    p_book:input.bookId,p_page:input.pageId,p_element:input.elementId,
    p_expected_version:input.expectedVersion,
  })
  const result=response(data,error,'ลบวัตถุไม่สำเร็จ',isDeleteReply)
  if(result.ok)revalidatePath('/s/'+input.spaceId+'/stamp-books/living/'+input.bookId)
  return result
}
