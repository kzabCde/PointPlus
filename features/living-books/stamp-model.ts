import {pointPlusStamps} from '@/lib/point-plus/assets'
import type {EditorElement} from './editor-model'

export type LivingStampMark={
  id:string;request_id:string;book_id:string;page_id:string
  recipient_participant_id:string;giver_user_id:string;asset_id:string;note:string|null
  position_x:number;position_y:number;rotation_deg:number;scale_factor:number
  state:'available'|'peeled';version:number;granted_at:string;peeled_at:string|null
}
export type LivingStampRequest={
  id:string;page_id:string;book_id:string;recipient_participant_id:string
  giver_user_id:string;asset_id:string;note:string|null
  position_x:number;position_y:number;rotation_deg:number;scale_factor:number
  status:'pending'|'approved'|'rejected'|'canceled';created_at:string
}
export type ImageCrop={x:number;y:number;width:number;height:number}
export type LivingImagePayload={
  storagePath:string;mime:'image/jpeg'|'image/png'|'image/webp';
  pixelWidth:number;pixelHeight:number;crop:ImageCrop
}
export const photoBucket='pointplus-living-photos'
export const supportedPhotoMime=['image/png','image/jpeg','image/webp'] as const
export const photoMaxBytes=6*1024*1024
export const stampArtwork=new Map(pointPlusStamps.map(stamp=>[stamp.id,stamp]))
export function validPlacement(x:number,y:number,angle:number,scale:number){
  return [x,y,angle,scale].every(Number.isFinite)&&x>=0&&x<=1&&y>=0&&y<=1&&
    angle>=-180&&angle<=180&&scale>=.3&&scale<=3
}
export function validCrop(crop:ImageCrop):boolean {
  if(!crop)return false
  return [crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)&&
    crop.x>=0&&crop.y>=0&&crop.width>0&&crop.height>0&&
    crop.x+crop.width<=1.000000001&&crop.y+crop.height<=1.000000001
}
export function photoElement(element:EditorElement):element is EditorElement&{payload:LivingImagePayload}{
  return element.element_type==='image'&&
    typeof (element.payload as LivingImagePayload).storagePath==='string'
}
export function photoPath(spaceId:string,bookId:string,pageId:string,elementId:string,mime:string){
  const ext=mime==='image/png'?'png':mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':null
  return ext?spaceId+'/'+bookId+'/'+pageId+'/'+elementId+'.'+ext:null
}
