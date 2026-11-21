import { notFound } from 'next/navigation'
import { getSpaceContext, getSpaceParticipants, type Participant } from '@/features/spaces/data'

export type LivingBook = {
  id: string; space_id: string; owner_user_id: string; recipient_participant_id: string
  title: string; description: string | null; cover_asset_id: string | null
  status: 'active' | 'paused' | 'archived'
  approval_policy: 'direct' | 'approval_required'; created_at: string
  card?: { target_count:number; reward_title:string } | null
}
export type LivingPage = {
  id:string;book_id:string;space_id:string;page_order:number;title:string|null
  background_style:'cream'|'white'|'lined'|'grid'|'kraft'
  version:number
}
export type LivingSummary = {
  id:string;space_id:string;owner_user_id:string;title:string;status:string
  page_count:number;first_page_id:string|null;unlimited_stamps:boolean;auto_archive:boolean
}

export async function loadLivingBookShelf(spaceId:string) {
  const context=await getSpaceContext(spaceId)
  const [people,response,cardResponse,giverResponse]=await Promise.all([
    getSpaceParticipants(spaceId,{includeArchived:true}),
    context.supabase.from('living_books')
      .select('id,space_id,owner_user_id,recipient_participant_id,title,description,cover_asset_id,status,approval_policy,created_at')
      .eq('space_id',spaceId).order('created_at',{ascending:false}).limit(80),
    context.supabase.from('living_book_cards')
      .select('book_id,target_count,reward_title').eq('space_id',spaceId),
    context.supabase.from('living_book_givers').select('book_id')
      .eq('space_id',spaceId).eq('user_id',context.user.id),
  ])
  if(response.error || cardResponse.error || giverResponse.error) throw new Error('Cannot load Living V3 collections and giver permissions')
  const byBook=new Map((cardResponse.data??[]).map(card=>[card.book_id,card]))
  return {books:(response.data??[]).map(book=>({
    ...book,card:byBook.get(book.id)??null,
  })) as LivingBook[],people,context,
    giverBookIds:(giverResponse.data??[]).map(row=>row.book_id) as string[]}
}

/** A detail page must never scan the entire Room shelf to open one known book. */
export async function loadLivingBookDetail(spaceId:string,bookId:string) {
  const [context,people]=await Promise.all([
    getSpaceContext(spaceId),
    getSpaceParticipants(spaceId,{includeArchived:true}),
  ])
  const [bookResult,cardResult]=await Promise.all([
    context.supabase.from('living_books')
      .select('id,space_id,owner_user_id,recipient_participant_id,title,description,cover_asset_id,status,approval_policy,created_at')
      .eq('id',bookId).eq('space_id',spaceId).maybeSingle(),
    context.supabase.from('living_book_cards')
      .select('target_count,reward_title').eq('book_id',bookId).eq('space_id',spaceId).maybeSingle(),
  ])
  if(bookResult.error||cardResult.error)throw new Error('Cannot load Living Book')
  if(!bookResult.data)notFound()
  return {
    context,people:people as Participant[],
    book:{...bookResult.data,card:cardResult.data??null} as LivingBook,
  }
}

import type { EditorElement,LivingEditorPage } from './editor-model'
import {photoBucket,type LivingStampMark,type LivingStampRequest} from './stamp-model'

/**
 * Fetch page metadata in batches instead of trusting the default PostgREST 1000-row
 * cap. M05 will virtualize thumbnails; M02 does not impose a lifetime page limit.
 */
export async function loadLivingEditorData(spaceId:string,bookId:string,
  requestedPageId?:string) {
  const {supabase}=await getSpaceContext(spaceId)
  const pages:LivingEditorPage[]=[]
  let offset=0
  for(;;) {
    const {data,error}=await supabase.from('living_book_pages')
      .select('id,book_id,space_id,page_order,title,background_style,version')
      .eq('book_id',bookId).eq('space_id',spaceId)
      .order('page_order',{ascending:true}).range(offset,offset+299)
    if(error)throw new Error('Cannot list Living Book pages')
    const batch=(data??[]) as LivingEditorPage[]
    pages.push(...batch)
    if(batch.length<300)break
    offset+=batch.length
  }
  const page=pages.find(p=>p.id===requestedPageId)??pages[0]
  if(!page)notFound()
  const elements:EditorElement[]=[]
  offset=0
  for(;;){
    const {data,error}=await supabase.from('living_book_elements')
      .select('id,book_id,page_id,element_type,payload,position_x,position_y,width,height,rotation_deg,opacity,z_index,version')
      .eq('book_id',bookId).eq('page_id',page.id)
      .is('deleted_at',null).order('z_index',{ascending:true}).range(offset,offset+299)
    if(error)throw new Error('Cannot load Living Book page decorations')
    const batch=(data??[]) as EditorElement[]
    elements.push(...batch)
    if(batch.length<300)break
    offset+=batch.length
  }
  return {pages,page,elements}
}

/**
 * Ledger and giver checks are independent: read concurrently rather than
 * chaining three round trips. The page decoration fetch already has photo
 * storage paths, so never fetch the same elements a second time.
 */
export async function loadLivingPageMedia(spaceId:string,bookId:string,pageId:string,
  pageElements:EditorElement[]=[]){
  const {supabase,user}=await getSpaceContext(spaceId)
  const marksPromise=(async()=>{
    const rows:LivingStampMark[]=[]
    for(let offset=0;;offset+=300){
      const {data,error}=await supabase.from('living_stamp_marks')
        .select('id,request_id,book_id,page_id,recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,rotation_deg,scale_factor,state,version,granted_at,peeled_at,reserved_at,redeemed_at,redemption_id')
        .eq('book_id',bookId).eq('page_id',pageId)
        .order('granted_at').order('id').range(offset,offset+299)
      if(error)throw new Error('Cannot load Living Stamp marks')
      rows.push(...(data??[]) as LivingStampMark[])
      if((data??[]).length<300)break
    }
    return rows
  })()
  const requestsPromise=(async()=>{
    const rows:LivingStampRequest[]=[]
    for(let offset=0;;offset+=300){
      const {data,error}=await supabase.from('living_stamp_requests')
        .select('id,page_id,book_id,recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,rotation_deg,scale_factor,status,created_at')
        .eq('book_id',bookId).eq('page_id',pageId).eq('status','pending')
        .order('created_at').order('id').range(offset,offset+299)
      if(error)throw new Error('Cannot load Living Stamp requests')
      rows.push(...(data??[]) as LivingStampRequest[])
      if((data??[]).length<300)break
    }
    return rows
  })()
  const giverPromise=supabase.from('living_book_givers').select('user_id')
    .eq('book_id',bookId).eq('user_id',user.id).maybeSingle()
  const photosPromise=(async()=>{
    const photos=pageElements.filter(item=>item.element_type==='image')
    const urls:Record<string,string>={}
    // Signed photo URLs are private and expire in 20 minutes. Limit concurrent
    // Storage calls rather than making N requests sequentially.
    for(let index=0;index<photos.length;index+=8){
      await Promise.all(photos.slice(index,index+8).map(async item=>{
        const storagePath=(item.payload as {storagePath?:string}).storagePath
        if(typeof storagePath!=='string')return
        const signed=await supabase.storage.from(photoBucket).createSignedUrl(storagePath,20*60)
        if(!signed.error&&signed.data?.signedUrl)urls[item.id]=signed.data.signedUrl
      }))
    }
    return urls
  })()
  const [marks,requests,giverResult,imageUrls]=await Promise.all([
    marksPromise,requestsPromise,giverPromise,photosPromise,
  ])
  if(giverResult.error)throw new Error('Cannot verify Living Book stamp giver')
  return {marks,requests,imageUrls,canGive:!!giverResult.data}
}
