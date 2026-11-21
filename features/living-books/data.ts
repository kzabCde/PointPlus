import { notFound } from 'next/navigation'
import { getSpaceContext, getSpaceParticipants, type Participant } from '@/features/spaces/data'

export type LivingBook = {
  id: string; space_id: string; owner_user_id: string; recipient_participant_id: string
  title: string; description: string | null; cover_asset_id: string | null
  status: 'active' | 'paused' | 'archived'
  approval_policy: 'direct' | 'approval_required'; created_at: string
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
  const [people,response]=await Promise.all([
    getSpaceParticipants(spaceId,{includeArchived:true}),
    context.supabase.from('living_books')
      .select('id,space_id,owner_user_id,recipient_participant_id,title,description,cover_asset_id,status,approval_policy,created_at')
      .eq('space_id',spaceId).order('created_at',{ascending:false}).limit(80),
  ])
  if(response.error) throw new Error('Cannot load Living Books; M01 migration must be installed before enabling this feature')
  return {books:(response.data??[]) as LivingBook[],people,context}
}

export async function loadLivingBookDetail(spaceId:string,bookId:string) {
  const {context,people}=await loadLivingBookShelf(spaceId)
  const {data:book,error}=await context.supabase.from('living_books')
    .select('id,space_id,owner_user_id,recipient_participant_id,title,description,cover_asset_id,status,approval_policy,created_at')
    .eq('id',bookId).eq('space_id',spaceId).maybeSingle()
  if(error) throw new Error('Cannot load Living Book')
  if(!book) notFound()
  const [summary,last]=await Promise.all([
    context.supabase.rpc('pointplus_get_living_book_summary',{p_book:bookId}),
    context.supabase.from('living_book_pages')
      .select('id,book_id,space_id,page_order,title,background_style,version')
      .eq('book_id',bookId).eq('space_id',spaceId).order('page_order',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(summary.error || !summary.data || last.error) throw new Error('Cannot load Living Book summary')
  return {
    context,people:people as Participant[],book:book as LivingBook,
    summary:summary.data as LivingSummary,lastPage:last.data as LivingPage|null,
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

/** Load current-page ledger, including arbitrarily many marks across batches. */
export async function loadLivingPageMedia(spaceId:string,bookId:string,pageId:string){
  const {supabase,user}=await getSpaceContext(spaceId)
  const marks:LivingStampMark[]=[]
  const requests:LivingStampRequest[]=[]
  for(let offset=0;;offset+=300){
    const {data,error}=await supabase.from('living_stamp_marks')
      .select('id,request_id,book_id,page_id,recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,rotation_deg,scale_factor,state,version,granted_at,peeled_at')
      .eq('book_id',bookId).eq('page_id',pageId)
      .order('granted_at').order('id').range(offset,offset+299)
    if(error)throw new Error('Cannot load Living Stamp marks')
    marks.push(...(data??[]) as LivingStampMark[])
    if((data??[]).length<300)break
  }
  for(let offset=0;;offset+=300){
    const {data,error}=await supabase.from('living_stamp_requests')
      .select('id,page_id,book_id,recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,rotation_deg,scale_factor,status,created_at')
      .eq('book_id',bookId).eq('page_id',pageId).eq('status','pending')
      .order('created_at').order('id').range(offset,offset+299)
    if(error)throw new Error('Cannot load Living Stamp requests')
    requests.push(...(data??[]) as LivingStampRequest[])
    if((data??[]).length<300)break
  }
  const [giverResult,elementResult]=await Promise.all([
    supabase.from('living_book_givers').select('user_id')
      .eq('book_id',bookId).eq('user_id',user.id).maybeSingle(),
    supabase.from('living_book_elements').select('id,payload')
      .eq('book_id',bookId).eq('page_id',pageId)
      .eq('element_type','image').is('deleted_at',null),
  ])
  if(giverResult.error||elementResult.error)
    throw new Error('Cannot load Living Book private page media')
  const imageUrls:Record<string,string>={}
  await Promise.all((elementResult.data??[]).map(async element=>{
    const storagePath=element.payload?.storagePath
    if(typeof storagePath!=='string')return
    const signed=await supabase.storage.from(photoBucket).createSignedUrl(storagePath,20*60)
    if(!signed.error&&signed.data?.signedUrl)imageUrls[element.id]=signed.data.signedUrl
  }))
  return {marks,requests,imageUrls,canGive:!!giverResult.data}
}
