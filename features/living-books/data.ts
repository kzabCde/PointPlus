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
