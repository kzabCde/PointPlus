import {notFound} from 'next/navigation'
import {isUuid} from '@/lib/auth/validation'
import {getSpaceContext} from '@/features/spaces/data'
import type {EditorElement,LivingEditorPage} from './editor-model'

/** Lightweight, read-only path: resolve one page without listing all editor pages. */
export async function loadLivingReadPage(spaceId:string,bookId:string,requestedPageId?:string){
  if(!isUuid(spaceId)||!isUuid(bookId)||
    (requestedPageId!==undefined&&!isUuid(requestedPageId)))notFound()
  const {supabase}=await getSpaceContext(spaceId)
  const base=supabase.from('living_book_pages')
    .select('id,book_id,space_id,page_order,title,background_style,version')
    .eq('book_id',bookId).eq('space_id',spaceId)
  const pageResult=requestedPageId
    ?await base.eq('id',requestedPageId).maybeSingle()
    :await base.order('page_order',{ascending:true}).limit(1).maybeSingle()
  if(pageResult.error)throw new Error('Cannot load Living Book reader page')
  if(!pageResult.data)notFound()
  const page=pageResult.data as LivingEditorPage

  const [before,after,totalResult,indexResult]=await Promise.all([
    supabase.from('living_book_pages').select('id')
      .eq('book_id',bookId).eq('space_id',spaceId)
      .lt('page_order',page.page_order).order('page_order',{ascending:false})
      .limit(1).maybeSingle(),
    supabase.from('living_book_pages').select('id')
      .eq('book_id',bookId).eq('space_id',spaceId)
      .gt('page_order',page.page_order).order('page_order',{ascending:true})
      .limit(1).maybeSingle(),
    supabase.from('living_book_pages').select('id',{count:'exact',head:true})
      .eq('book_id',bookId).eq('space_id',spaceId),
    supabase.from('living_book_pages').select('id',{count:'exact',head:true})
      .eq('book_id',bookId).eq('space_id',spaceId).lt('page_order',page.page_order),
  ])
  if(before.error||after.error||totalResult.error||indexResult.error)
    throw new Error('Cannot load Living Book reader navigation')

  // Fetch only decorations on the currently visible page. Retain bounded
  // PostgREST ranges; no unrelated pages, photo bucket list or editor init.
  const elements:EditorElement[]=[]
  for(let offset=0;;offset+=200){
    const {data,error}=await supabase.from('living_book_elements')
      .select('id,book_id,page_id,element_type,payload,position_x,position_y,width,height,rotation_deg,opacity,z_index,version')
      .eq('book_id',bookId).eq('page_id',page.id).eq('space_id',spaceId)
      .is('deleted_at',null).order('z_index',{ascending:true})
      .order('id',{ascending:true}).range(offset,offset+199)
    if(error)throw new Error('Cannot load Living Book reader decorations')
    elements.push(...(data??[]) as EditorElement[])
    if((data??[]).length<200)break
  }
  return {page,elements,previous:before.data?.id??null,next:after.data?.id??null,
    pageNumber:(indexResult.count??0)+1,pageCount:totalResult.count??1}
}
