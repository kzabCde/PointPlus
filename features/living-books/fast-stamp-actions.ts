'use server'

import {revalidatePath} from 'next/cache'
import {isUuid} from '@/lib/auth/validation'
import {getSpaceContext} from '@/features/spaces/data'
import {giveLivingStamp, type M03Result} from './m03-actions'
import {cardStampPosition, type StampPoint} from './fast-stamp-placement'
import {validPlacement} from './stamp-model'

type Scope={spaceId:string;bookId:string}
export type FastStampOptions={
  kind:'card'|'book';pageId:string;targetCount:number|null;
  occupiedSlots:number[];occupiedPositions:StampPoint[]
}
export type FastStampOptionsResult={
  ok:boolean;message:string;data?:FastStampOptions
}
export type FastStampCommand=Scope&{
  pageId:string;assetId:string;note:string;key:string;
  cardSlot?:number|null;placement?:StampPoint|null
}

const denied='ไม่สามารถให้แสตมป์ในสมุดนี้ได้ กรุณาตรวจสอบสิทธิ์และสถานะสมุด'

/** All lazy reads are small, room-scoped and performed ONLY when the sheet opens. */
export async function loadFastStampOptions(input:Scope):Promise<FastStampOptionsResult>{
  if(!isUuid(input.spaceId)||!isUuid(input.bookId))
    return {ok:false,message:'ข้อมูลสมุดไม่ถูกต้อง'}
  const {supabase,user}=await getSpaceContext(input.spaceId)
  const [book,giver,page,card]=await Promise.all([
    supabase.from('living_books').select('status')
      .eq('id',input.bookId).eq('space_id',input.spaceId).maybeSingle(),
    supabase.from('living_book_givers').select('user_id')
      .eq('book_id',input.bookId).eq('space_id',input.spaceId)
      .eq('user_id',user.id).maybeSingle(),
    supabase.from('living_book_pages').select('id')
      .eq('book_id',input.bookId).eq('space_id',input.spaceId)
      .order('page_order',{ascending:true}).limit(1).maybeSingle(),
    supabase.from('living_book_cards').select('target_count')
      .eq('book_id',input.bookId).eq('space_id',input.spaceId).maybeSingle(),
  ])
  if(book.error||giver.error||page.error||card.error)
    return {ok:false,message:'โหลดข้อมูลให้แสตมป์ไม่สำเร็จ'}
  if(!book.data||book.data.status!=='active'||!giver.data||!page.data)
    return {ok:false,message:denied}
  if(card.data){
    const {data,error}=await supabase.from('living_stamp_requests')
      .select('card_slot,status').eq('book_id',input.bookId)
      .eq('space_id',input.spaceId).in('status',['pending','approved'])
      .not('card_slot','is',null).limit(100)
    if(error)return {ok:false,message:'ไม่สามารถตรวจสอบช่องที่ว่างได้'}
    return {ok:true,message:'',data:{
      kind:'card',pageId:page.data.id,targetCount:card.data.target_count,
      occupiedSlots:(data??[]).map(row=>Number(row.card_slot))
        .filter(n=>Number.isSafeInteger(n)),occupiedPositions:[],
    }}
  }
  const [marks,pending]=await Promise.all([
    supabase.from('living_stamp_marks').select('position_x,position_y')
      .eq('book_id',input.bookId).eq('page_id',page.data.id).limit(600),
    supabase.from('living_stamp_requests').select('position_x,position_y')
      .eq('book_id',input.bookId).eq('page_id',page.data.id)
      .eq('status','pending').limit(600),
  ])
  if(marks.error||pending.error)
    return {ok:false,message:'ไม่สามารถเลือกตำแหน่งแสตมป์ได้'}
  return {ok:true,message:'',data:{
    kind:'book',pageId:page.data.id,targetCount:null,occupiedSlots:[],
    occupiedPositions:[...(marks.data??[]),...(pending.data??[])].map(row=>({
      x:Number(row.position_x),y:Number(row.position_y),
    })),
  }}
}

/** Reuse the original atomic RPC, its grants, unique keys, audit and approval. */
export async function submitFastStamp(input:FastStampCommand):
Promise<M03Result<{request_id:string;mark_id:string|null;status:string}>> {
  if(!isUuid(input.spaceId)||!isUuid(input.bookId)||
    !isUuid(input.pageId)||!isUuid(input.key)||
    typeof input.note!=='string'||input.note.length>1000)
    return {ok:false,message:'ข้อมูลให้แสตมป์ไม่ถูกต้อง'}
  const {supabase}=await getSpaceContext(input.spaceId)
  const [page,card]=await Promise.all([
    supabase.from('living_book_pages').select('id')
      .eq('book_id',input.bookId).eq('space_id',input.spaceId)
      .order('page_order',{ascending:true}).limit(1).maybeSingle(),
    supabase.from('living_book_cards').select('target_count')
      .eq('book_id',input.bookId).eq('space_id',input.spaceId).maybeSingle(),
  ])
  if(page.error||card.error||!page.data||page.data.id!==input.pageId)
    return {ok:false,message:'หน้าสมุดเปลี่ยนไป กรุณาตรวจสอบอีกครั้ง'}
  let position:StampPoint|null
  if(card.data){
    position=cardStampPosition(input.cardSlot??NaN,card.data.target_count)
    if(!position||input.placement)
      return {ok:false,message:'กรุณาเลือกช่องการ์ดที่ถูกต้อง'}
  }else{
    position=input.placement??null
    if(input.cardSlot!=null||!position||
      !validPlacement(position.x,position.y,0,.7))
      return {ok:false,message:'ตำแหน่งแสตมป์ไม่ถูกต้อง'}
  }
  const result=await giveLivingStamp({
    spaceId:input.spaceId,bookId:input.bookId,pageId:page.data.id,
    assetId:input.assetId,note:input.note,key:input.key,
    x:position.x,y:position.y,rotation:0,scale:.7,
  })
  if(result.ok){
    revalidatePath('/s/'+input.spaceId)
    revalidatePath('/s/'+input.spaceId+'/stamp-books')
  }
  return result
}
