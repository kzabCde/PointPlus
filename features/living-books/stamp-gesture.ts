import {clamp,normalizeRotation,type Point} from './editor-model'
import {validPlacement} from './stamp-model'

/** An unissued visual draft. It is NEVER a LivingStampMark or a ledger entry. */
export type StampDraft={
  artId:string;x:number;y:number;rotation:number;scale:number
}
export function moveStampDraft(draft:StampDraft,dx:number,dy:number,
  box:{width:number;height:number}):StampDraft{
  if(box.width<=0||box.height<=0)return draft
  return {...draft,x:clamp(draft.x+dx/box.width,0,1),
    y:clamp(draft.y+dy/box.height,0,1)}
}
export function rotateStampDraft(draft:StampDraft,degrees:number):StampDraft{
  return {...draft,rotation:normalizeRotation(draft.rotation+degrees)}
}
export function scaleStampDraft(draft:StampDraft,factor:number):StampDraft{
  if(!Number.isFinite(factor)||factor<=0)return draft
  return {...draft,scale:Math.round(clamp(draft.scale*factor,.3,3)*100)/100}
}
export function pointStampDraft(draft:StampDraft,point:Point):StampDraft{
  return {...draft,x:clamp(point.x,0,1),y:clamp(point.y,0,1)}
}
export function stampDraftValid(draft:StampDraft):boolean {
  return !!draft.artId&&validPlacement(draft.x,draft.y,draft.rotation,draft.scale)
}
export function reorderPageIds(ids:string[],fromId:string,toId:string):string[]|null{
  const from=ids.indexOf(fromId),to=ids.indexOf(toId)
  if(from<0||to<0||from===to)return null
  const next=[...ids]
  const [moving]=next.splice(from,1)
  next.splice(to,0,moving)
  return next
}
