'use server'

import {isUuid} from '@/lib/auth/validation'
import {saveLivingElement} from './editor-actions'
import {transformLivingPhoto} from './m03-actions'
import type {EditorElement,EditorImage} from './editor-model'

/**
 * One browser roundtrip for up to 8 independent decoration writes.
 *
 * Authorization, optimistic version checks and RLS are delegated to the same
 * existing server actions that handle individual edits. A failed item never
 * marks its local draft as saved; results are returned per element.
 *
 * Real stamps, reward ledgers, deletions and photo uploads are NEVER batched.
 */
export async function saveLivingPaperBatch(input:{
  spaceId:string;bookId:string;pageId:string
  drafts:Array<{element:EditorElement;expectedVersion:number}>
}):Promise<Array<{id:string;ok:boolean;version?:number;error?:string;conflict?:boolean}>>{
  if(!isUuid(input.spaceId)||!isUuid(input.bookId)||!isUuid(input.pageId)||
    !Array.isArray(input.drafts)||input.drafts.length<1||input.drafts.length>8||
    input.drafts.some(item=>!item||!item.element||
      !isUuid(item.element.id)||item.element.book_id!==input.bookId||
      item.element.page_id!==input.pageId||
      !Number.isSafeInteger(item.expectedVersion)||item.expectedVersion<0)||
    new Set(input.drafts.map(item=>item.element.id)).size!==input.drafts.length)
    throw new Error('Invalid paper draft batch')
  return Promise.all(input.drafts.map(async({element,expectedVersion})=>{
    try{
      if(!['image','text','drawing'].includes(element.element_type))
        return {id:element.id,ok:false,error:'ประเภทวัตถุไม่ถูกต้อง'}
      const result=element.element_type==='image'
        ?await transformLivingPhoto({
          spaceId:input.spaceId,bookId:input.bookId,pageId:input.pageId,
          elementId:element.id,expectedVersion,
          x:element.position_x,y:element.position_y,
          width:element.width,height:element.height,
          rotation:element.rotation_deg,opacity:element.opacity,
          zIndex:element.z_index,crop:(element.payload as EditorImage).crop,
        })
        :await saveLivingElement({
          spaceId:input.spaceId,bookId:input.bookId,pageId:input.pageId,
          element,expectedVersion,
        })
      return {id:element.id,ok:result.ok,version:result.data?.version,
        error:result.ok?undefined:('error' in result?result.error:result.message),
        conflict:result.conflict}
    }catch{
      return {id:element.id,ok:false,
        error:'ไม่ทราบผลการบันทึก กรุณาตรวจสอบหน้าและลองอีกครั้ง'}
    }
  }))
}
