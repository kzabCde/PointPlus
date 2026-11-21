export type PaperBackground = 'cream' | 'white' | 'lined' | 'grid' | 'kraft'
export type EditorTool = 'select' | 'text' | 'pen' | 'eraser' | 'hand' | 'stamp'
export type Point = {x:number;y:number}
export type EditorText = {
  text:string;fontSize:number;color:string;fontFamily:'sans'|'serif'|'mono'
  align:'left'|'center'|'right';bold:boolean;italic:boolean
}
export type EditorDrawing = {points:Point[];strokeWidth:number;color:string}
export type EditorImage = {
  storagePath:string;mime:'image/png'|'image/jpeg'|'image/webp';
  pixelWidth:number;pixelHeight:number;
  crop:{x:number;y:number;width:number;height:number}
}
export type EditorPayload = EditorText | EditorDrawing | EditorImage
export type EditorElement = {
  id:string;book_id:string;page_id:string;element_type:'text'|'drawing'|'image'
  payload:EditorPayload;position_x:number;position_y:number;width:number;height:number
  rotation_deg:number;opacity:number;z_index:number;version:number
}
export type LivingEditorPage = {
  id:string;book_id:string;space_id:string;page_order:number;title:string|null
  background_style:PaperBackground;version:number
}
export const backgrounds:PaperBackground[] = ['cream','white','lined','grid','kraft']
export const textDefault:EditorText = {
  text:'เขียนความทรงจำของคุณ',fontSize:24,color:'#704b47',
  fontFamily:'sans',align:'left',bold:false,italic:false,
}
export const isHexColor = (value:unknown):value is string =>
  typeof value==='string' && /^#[0-9a-fA-F]{6}$/.test(value)
export const clamp = (v:number,min:number,max:number) =>
  Number.isFinite(v) ? Math.max(min,Math.min(max,v)) : min
export function normalizePoint(clientX:number,clientY:number,
  box:{left:number;top:number;width:number;height:number}):Point|null {
  if(![clientX,clientY,box.left,box.top,box.width,box.height].every(Number.isFinite) ||
    box.width<=0 || box.height<=0) return null
  return {x:clamp((clientX-box.left)/box.width,0,1),
    y:clamp((clientY-box.top)/box.height,0,1)}
}
export function normalizeRotation(deg:number) {
  if(!Number.isFinite(deg)) return 0
  return ((deg+180)%360+360)%360-180
}
export function makeStrokeElement(points:Point[], color:string, strokeWidth:number):
  Pick<EditorElement,'position_x'|'position_y'|'width'|'height'|'payload'|'element_type'> | null {
  if(points.length<2 || !isHexColor(color) || !Number.isFinite(strokeWidth))return null
  const xMin=Math.min(...points.map(p=>p.x))
  const yMin=Math.min(...points.map(p=>p.y))
  const xMax=Math.max(...points.map(p=>p.x))
  const yMax=Math.max(...points.map(p=>p.y))
  const width=Math.max(.005,xMax-xMin),height=Math.max(.005,yMax-yMin)
  if(![xMin,yMin,xMax,yMax].every(Number.isFinite))return null
  const path=points.slice(0,1200).map(p=>({
    x:clamp((p.x-xMin)/width,0,1),y:clamp((p.y-yMin)/height,0,1),
  }))
  return {element_type:'drawing',position_x:clamp(xMin,0,1),position_y:clamp(yMin,0,1),
    width:clamp(width,.005,1),height:clamp(height,.005,1),
    payload:{points:path,strokeWidth:clamp(strokeWidth,1,30),color}}
}
export function validPayload(type:EditorElement['element_type'],payload:unknown):payload is EditorPayload {
  if(!payload || typeof payload!=='object')return false
  const o=payload as Record<string,unknown>
  if(type==='text')return typeof o.text==='string'&&o.text.length<=5000 &&
    typeof o.fontSize==='number'&&o.fontSize>=12&&o.fontSize<=120 &&
    isHexColor(o.color)&&['sans','serif','mono'].includes(String(o.fontFamily))&&
    ['left','center','right'].includes(String(o.align))&&
    typeof o.bold==='boolean'&&typeof o.italic==='boolean'
  if(type==='drawing')return Array.isArray(o.points)&&o.points.length>=2&&o.points.length<=1200&&
    isHexColor(o.color)&&typeof o.strokeWidth==='number'&&o.strokeWidth>=1&&o.strokeWidth<=30 &&
    o.points.every((p:unknown)=>p!==null&&typeof p==='object'&&
      typeof (p as Point).x==='number'&&Number.isFinite((p as Point).x)&&
      (p as Point).x>=0&&(p as Point).x<=1&&
      typeof (p as Point).y==='number'&&Number.isFinite((p as Point).y)&&
      (p as Point).y>=0&&(p as Point).y<=1)
  return false
}
export function orderedPageIds(pages:LivingEditorPage[],pageId:string,direction:-1|1):string[]|null {
  const ids=pages.map(page=>page.id)
  const at=ids.indexOf(pageId)
  const to=at+direction
  if(at<0||to<0||to>=ids.length)return null
  ;[ids[at],ids[to]]=[ids[to],ids[at]]
  return ids
}
