import type {EditorElement} from './editor-model'
import {clamp,normalizeRotation} from './editor-model'

export type ResizeCorner='nw'|'ne'|'sw'|'se'
type Box={width:number;height:number}

const validCanvas=(box:Box)=>box.width>0&&box.height>0&&
  Number.isFinite(box.width)&&Number.isFinite(box.height)

/** Keep editable objects on paper; all positions/dimensions use 0..1 page coordinates. */
export function moveDecoration(item:EditorElement,dx:number,dy:number,box:Box):EditorElement{
  if(!validCanvas(box))return item
  return {...item,
    position_x:clamp(item.position_x+dx/box.width,0,Math.max(0,1-item.width)),
    position_y:clamp(item.position_y+dy/box.height,0,Math.max(0,1-item.height))}
}

/** Resize in the object's local rotated axes, anchoring the opposite corner.
 * Images preserve their crop frame aspect ratio; text/drawings can stretch freely.
 */
export function resizeDecoration(item:EditorElement,corner:ResizeCorner,
  dx:number,dy:number,box:Box,keepAspect=item.element_type==='image'):EditorElement {
  if(!validCanvas(box))return item
  const radians=item.rotation_deg*Math.PI/180
  const cos=Math.cos(radians),sin=Math.sin(radians)
  const localX=dx*cos+dy*sin
  const localY=-dx*sin+dy*cos
  const sx=corner.endsWith('e')?1:-1
  const sy=corner.startsWith('s')?1:-1
  const oldW=item.width*box.width,oldH=item.height*box.height
  let w=clamp(oldW+sx*localX,box.width*.005,box.width)
  let h=clamp(oldH+sy*localY,box.height*.005,box.height)
  if(keepAspect){
    const wx=localX*sx/Math.max(oldW,1)
    const hy=localY*sy/Math.max(oldH,1)
    const ratio=1+(Math.abs(wx)>Math.abs(hy)?wx:hy)
    const factor=clamp(ratio,
      Math.max(box.width*.005/oldW,box.height*.005/oldH),
      Math.min(box.width/oldW,box.height/oldH))
    w=oldW*factor;h=oldH*factor
  }
  const dw=w-oldW,dh=h-oldH
  const cx=item.position_x*box.width+oldW/2
  const cy=item.position_y*box.height+oldH/2
  const nextCx=cx+(sx*dw*cos-sy*dh*sin)/2
  const nextCy=cy+(sx*dw*sin+sy*dh*cos)/2
  return {...item,
    width:clamp(w/box.width,.005,1),height:clamp(h/box.height,.005,1),
    position_x:clamp((nextCx-w/2)/box.width,0,Math.max(0,1-w/box.width)),
    position_y:clamp((nextCy-h/2)/box.height,0,Math.max(0,1-h/box.height))}
}

/** Rotate about the CSS transform-origin center, including already rotated objects. */
export function rotateDecoration(item:EditorElement,
  start:{x:number;y:number},now:{x:number;y:number},box:Box):EditorElement {
  if(!validCanvas(box))return item
  const cx=(item.position_x+item.width/2)*box.width
  const cy=(item.position_y+item.height/2)*box.height
  const a=Math.atan2(start.y-cy,start.x-cx)
  const b=Math.atan2(now.y-cy,now.x-cx)
  return {...item,rotation_deg:normalizeRotation(item.rotation_deg+(b-a)*180/Math.PI)}
}

/** For a two-finger gesture on the SAME selected object, scale about its center. */
export function pinchDecoration(item:EditorElement,factor:number,box:Box):EditorElement {
  if(!validCanvas(box)||!Number.isFinite(factor)||factor<=0)return item
  const maxFactor=Math.min(1/item.width,1/item.height)
  const minFactor=Math.max(.005/item.width,.005/item.height)
  const scale=clamp(factor,minFactor,maxFactor)
  const width=item.width*scale,height=item.height*scale
  const cx=item.position_x+item.width/2,cy=item.position_y+item.height/2
  return {...item,width,height,
    position_x:clamp(cx-width/2,0,Math.max(0,1-width)),
    position_y:clamp(cy-height/2,0,Math.max(0,1-height))}
}
