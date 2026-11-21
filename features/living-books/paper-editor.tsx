'use client'

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { deleteLivingElement,saveLivingElement } from './editor-actions'
import {
  clamp,isHexColor,makeStrokeElement,normalizePoint,normalizeRotation,textDefault,
  type EditorElement,type EditorTool,type EditorText,type EditorDrawing,type LivingEditorPage,type Point,
} from './editor-model'

type EditorProps={
  spaceId:string;bookId:string;page:LivingEditorPage;initialElements:EditorElement[]
  editable:boolean
}
type Gesture={
  id:number;mode:'draw'|'move'|'hand';startX:number;startY:number
  points?:Point[];original?:EditorElement;next?:EditorElement
  scrollX?:number;scrollY?:number
}
const defaultColor='#b76872'
const toolLabels:{tool:EditorTool;label:string}[]=[
  {tool:'select',label:'เลือก / ย้าย'},{tool:'text',label:'ข้อความ'},
  {tool:'pen',label:'ปากกา'},{tool:'eraser',label:'ยางลบ'},
  {tool:'hand',label:'เลื่อนกระดาษ'},
]
const strokePoints=(points:Point[])=>points.map(p=>
  Math.round(p.x*1000)+','+Math.round(p.y*1000)).join(' ')

function PaperObject({item,selected,editable}:{
  item:EditorElement;selected:boolean;editable:boolean
}){
  const style:CSSProperties={
    left:(item.position_x*100)+'%',top:(item.position_y*100)+'%',
    width:(item.width*100)+'%',height:(item.height*100)+'%',
    transform:'rotate('+item.rotation_deg+'deg)',opacity:item.opacity,
    zIndex:item.z_index,
  }
  if(item.element_type==='text') {
    const p=item.payload as EditorText
    const fontFamily=p.fontFamily==='serif'?'Georgia,serif':
      p.fontFamily==='mono'?'monospace':'system-ui,sans-serif'
    return <div className="living-paper-object living-paper-object--text"
      data-editor-id={item.id} data-selected={selected} style={style}
      role={editable?'button':undefined} tabIndex={editable?0:undefined}
      aria-label={editable?'เลือกข้อความเพื่อแก้ไข: '+p.text.slice(0,60):undefined}>
      <div className="living-paper-object__text" style={{
        color:p.color,fontSize:p.fontSize,fontFamily,textAlign:p.align,
        fontWeight:p.bold?'bold':'normal',fontStyle:p.italic?'italic',
      }}>{p.text}</div>
    </div>
  }
  const p=item.payload as EditorDrawing
  return <div className="living-paper-object living-paper-object--drawing"
    data-editor-id={item.id} data-selected={selected} style={style}
    role={editable?'button':undefined} tabIndex={editable?0:undefined}
    aria-label={editable?'เลือกเส้นวาดเพื่อจัดตำแหน่งหรือลบ':undefined}>
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none"
      width="100%" height="100%" aria-hidden="true">
      <polyline points={strokePoints(p.points)} fill="none" stroke={p.color}
        strokeWidth={p.strokeWidth*5} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  </div>
}

export function LivingPaperEditor({spaceId,bookId,page,initialElements,editable}:EditorProps){
  const router=useRouter()
  const canvas=useRef<HTMLDivElement>(null)
  const viewport=useRef<HTMLDivElement>(null)
  const gesture=useRef<Gesture|null>(null)
  const locked=useRef(false)
  const [items,setItems]=useState<EditorElement[]>(initialElements)
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const [tool,setTool]=useState<EditorTool>('select')
  const [zoom,setZoom]=useState(1)
  const [penColor,setPenColor]=useState(defaultColor)
  const [strokeWidth,setStrokeWidth]=useState(3)
  const [draft,setDraft]=useState<Point[]>([])
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const selected=items.find(item=>item.id===selectedId)
  const selectedText=selected?.element_type==='text'?selected.payload as EditorText:null

  async function saveObject(element:EditorElement,revert?:EditorElement){
    if(!editable||locked.current)return
    locked.current=true;setBusy(true);setNotice('กำลังบันทึก…')
    try{
      const result=await saveLivingElement({
        spaceId,bookId,pageId:page.id,element,expectedVersion:element.version,
      })
      if(result.ok&&result.data) {
        const version=result.data.version
        setItems(prev=>[...prev.filter(item=>item.id!==element.id),
          {...element,version}].sort((a,b)=>a.z_index-b.z_index||a.id.localeCompare(b.id)))
        setSelectedId(element.id)
        setDirty(false);setNotice('บันทึกลงสมุดแล้ว')
      } else {
        if(revert) setItems(prev=>prev.map(item=>item.id===revert.id?revert:item))
        setNotice(result.error??'ไม่สามารถบันทึกวัตถุ')
        if(result.conflict) router.refresh()
      }
    }catch{
      if(revert)setItems(prev=>prev.map(item=>item.id===revert.id?revert:item))
      setNotice('การเชื่อมต่อขัดข้อง ยังไม่ได้บันทึก โปรดลองอีกครั้ง')
    }finally{locked.current=false;setBusy(false)}
  }

  function patchSelected(changes:Partial<EditorElement>){
    if(!editable||!selected||locked.current)return
    setItems(prev=>prev.map(item=>item.id===selected.id?{...item,...changes}:item))
    setDirty(true);setNotice('มีการเปลี่ยนแปลงที่ยังไม่บันทึก')
  }
  function patchText(changes:Partial<EditorText>){
    if(!selectedText)return
    patchSelected({payload:{...selectedText,...changes}})
  }

  function newText(x:number,y:number) {
    if(!editable||locked.current)return
    const element:EditorElement={
      id:crypto.randomUUID(),book_id:bookId,page_id:page.id,
      element_type:'text',payload:{...textDefault,color:penColor},
      position_x:x,position_y:y,width:.34,height:.15,rotation_deg:0,opacity:1,
      z_index:Math.min(1000000,items.reduce((n,e)=>Math.max(n,e.z_index),0)+1),
      version:0,
    }
    void saveObject(element)
    setTool('select')
  }

  function begin(event:PointerEvent<HTMLDivElement>){
    if(!editable||locked.current||event.button>0||!canvas.current)return
    const target=(event.target as Element).closest<HTMLElement>('[data-editor-id]')
    const element=items.find(item=>item.id===target?.dataset.editorId)
    if(tool==='eraser'&&element?.element_type==='drawing') {
      setSelectedId(element.id)
      void remove(element)
      return
    }
    const bound=event.currentTarget.getBoundingClientRect()
    const p=normalizePoint(event.clientX,event.clientY,bound)
    if(!p)return
    if(tool==='text'){if(!element)newText(p.x,p.y);return}
    if(tool==='select'){
      setSelectedId(element?.id??null)
      if(!element)return
      gesture.current={mode:'move',id:event.pointerId,startX:event.clientX,
        startY:event.clientY,original:element,next:element}
    }else if(tool==='pen'){
      gesture.current={mode:'draw',id:event.pointerId,startX:event.clientX,
        startY:event.clientY,points:[p]}
      setDraft([p])
    }else if(tool==='hand') {
      gesture.current={mode:'hand',id:event.pointerId,startX:event.clientX,
        startY:event.clientY,scrollX:viewport.current?.scrollLeft??0,
        scrollY:viewport.current?.scrollTop??0}
    }else return
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{/* browser fallback */}
  }
  function move(event:PointerEvent<HTMLDivElement>){
    const g=gesture.current
    if(!g||g.id!==event.pointerId||!canvas.current)return
    if(g.mode==='hand'){
      if(viewport.current){
        viewport.current.scrollLeft=(g.scrollX??0)-(event.clientX-g.startX)
        viewport.current.scrollTop=(g.scrollY??0)-(event.clientY-g.startY)
      }
      return
    }
    const bound=canvas.current.getBoundingClientRect()
    if(g.mode==='draw'){
      const p=normalizePoint(event.clientX,event.clientY,bound)
      if(!p||!g.points||g.points.length>=1199)return
      const last=g.points[g.points.length-1]
      if(Math.hypot(last.x-p.x,last.y-p.y)<.0015)return
      g.points=[...g.points,p]
      setDraft(g.points)
    }else if(g.mode==='move'&&g.original){
      const dx=(event.clientX-g.startX)/bound.width
      const dy=(event.clientY-g.startY)/bound.height
      const next={...g.original,
        position_x:clamp(g.original.position_x+dx,0,1),
        position_y:clamp(g.original.position_y+dy,0,1)}
      g.next=next
      setItems(prev=>prev.map(item=>item.id===next.id?next:item))
    }
  }
  function finish(event:PointerEvent<HTMLDivElement>){
    const g=gesture.current
    if(!g||g.id!==event.pointerId)return
    gesture.current=null
    if(g.mode==='draw'){
      setDraft([])
      const points=g.points??[]
      if(points.length===1)points.push({x:clamp(points[0].x+.002,0,1),y:clamp(points[0].y+.002,0,1)})
      const stroke=makeStrokeElement(points,penColor,strokeWidth)
      if(!stroke)return
      const element:EditorElement={
        id:crypto.randomUUID(),book_id:bookId,page_id:page.id,...stroke,
        rotation_deg:0,opacity:1,z_index:Math.min(1000000,items.reduce((n,e)=>Math.max(n,e.z_index),0)+1),
        version:0,
      }
      void saveObject(element)
    }else if(g.mode==='move'&&g.original&&g.next &&
      (g.next.position_x!==g.original.position_x||g.next.position_y!==g.original.position_y))
      void saveObject(g.next,g.original)
  }
  function cancel(){
    const g=gesture.current;gesture.current=null;setDraft([])
    if(g?.mode==='move'&&g.original)
      setItems(prev=>prev.map(item=>item.id===g.original?.id?g.original:item) as EditorElement[])
  }
  async function remove(item:EditorElement){
    if(!editable||locked.current||item.version===0)return
    locked.current=true;setBusy(true);setNotice('กำลังลบ…')
    try{
      const result=await deleteLivingElement({
        spaceId,bookId,pageId:page.id,elementId:item.id,expectedVersion:item.version,
      })
      if(result.ok) {
        setItems(prev=>prev.filter(e=>e.id!==item.id))
        setSelectedId(null);setDirty(false);setNotice('ลบวัตถุจากหน้ากระดาษแล้ว')
      }else{setNotice(result.error??'ไม่สามารถลบวัตถุ');if(result.conflict)router.refresh()}
    }catch{setNotice('การเชื่อมต่อขัดข้อง ไม่สามารถลบวัตถุ')}
    finally{locked.current=false;setBusy(false)}
  }
  function handleKey(event:KeyboardEvent<HTMLDivElement>){
    if(!editable||!selected||locked.current)return
    if((event.target as HTMLElement).closest('textarea,input,select'))return
    if(event.key==='Escape'){setSelectedId(null);return}
    if(event.key==='Delete'||event.key==='Backspace'){
      event.preventDefault()
      void remove(selected)
      return
    }
    const shifts:Record<string,[number,number]>={
      ArrowLeft:[-.01,0],ArrowRight:[.01,0],
      ArrowUp:[0,-.01],ArrowDown:[0,.01],
    }
    const step=shifts[event.key]
    if(step){
      event.preventDefault()
      patchSelected({position_x:clamp(selected.position_x+step[0],0,1),
        position_y:clamp(selected.position_y+step[1],0,1)})
    }
  }
  const top=Math.max(0,...items.map(e=>e.z_index))
  const bottom=Math.min(0,...items.map(e=>e.z_index))
  return <section className="living-editor" aria-label="เครื่องมือแก้ไขกระดาษ">
    <div className="living-editor-toolbar">
      {editable&&<div className="living-editor-toolset" role="group" aria-label="เลือกเครื่องมือ">
        {toolLabels.map(item=><button key={item.tool} type="button"
          className="button button--secondary" aria-pressed={tool===item.tool}
          disabled={busy} onClick={()=>{setTool(item.tool);setSelectedId(null)}}>
          {item.label}
        </button>)}
      </div>}
      <div className="living-editor-zoom" role="group" aria-label="ขยายและเลื่อนหน้ากระดาษ">
        <button type="button" className="button button--secondary" disabled={zoom<=.6}
          onClick={()=>setZoom(prev=>clamp(Math.round((prev-.1)*10)/10,.6,1.8))}>−</button>
        <span>{Math.round(zoom*100)}%</span>
        <button type="button" className="button button--secondary" disabled={zoom>=1.8}
          onClick={()=>setZoom(prev=>clamp(Math.round((prev+.1)*10)/10,.6,1.8))}>+</button>
      </div>
      {editable&&(tool==='pen'||tool==='text')&&<div className="living-editor-pen-settings">
        <label>สี <input type="color" aria-label="สีปากกาหรือข้อความ" value={penColor}
          disabled={busy} onChange={e=>{if(isHexColor(e.target.value))setPenColor(e.target.value)}}/></label>
        {tool==='pen'&&<label>ขนาดเส้น {strokeWidth}px
          <input type="range" min="1" max="30" value={strokeWidth} disabled={busy}
            onChange={e=>setStrokeWidth(Number(e.target.value))}/>
        </label>}
        {tool==='text'&&<button className="button button--secondary" type="button"
          disabled={busy} onClick={()=>newText(.24,.3)}>เพิ่มข้อความกลางหน้า</button>}
      </div>}
    </div>
    <div ref={viewport} className="living-editor-viewport">
      <div ref={canvas} className="living-editor-paper" data-background={page.background_style}
        data-tool={tool} data-editable={editable}
        style={{width:(zoom*100)+'%'}}
        role="group" tabIndex={editable?0:undefined}
        aria-label={editable?'หน้ากระดาษ: แตะเพื่อเขียน หรือเลือกข้อความและเส้นวาด กดลูกศรเพื่อย้าย': 'หน้ากระดาษสำหรับอ่าน'}
        onPointerDown={begin} onPointerMove={move} onPointerUp={finish}
        onPointerCancel={cancel} onKeyDown={handleKey}>
        {items.map(item=><PaperObject key={item.id} item={item}
          selected={selectedId===item.id} editable={editable}/>)}
        {draft.length>0&&<svg className="living-editor-draft" viewBox="0 0 1000 1000"
          preserveAspectRatio="none" aria-hidden="true">
          <polyline points={strokePoints(draft)} stroke={penColor}
            strokeWidth={strokeWidth*5} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>}
      </div>
    </div>
    {editable&&selected&&<div className="living-editor-properties">
      <h3>ปรับแต่ง{selected.element_type==='text'?'ข้อความ':'เส้นวาด'}</h3>
      {selectedText&&<>
        <label className="living-editor-properties__wide">ข้อความ
          <textarea value={selectedText.text} maxLength={5000} rows={3} className="input"
            disabled={busy} onChange={e=>patchText({text:e.target.value})}/>
        </label>
        <label>ฟอนต์
          <select className="input" value={selectedText.fontFamily} disabled={busy}
            onChange={e=>patchText({fontFamily:e.target.value as EditorText['fontFamily']})}>
            <option value="sans">Sans</option><option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <label>การจัดข้อความ
          <select className="input" value={selectedText.align} disabled={busy}
            onChange={e=>patchText({align:e.target.value as EditorText['align']})}>
            <option value="left">ซ้าย</option><option value="center">กลาง</option>
            <option value="right">ขวา</option>
          </select>
        </label>
        <label>ขนาดอักษร {selectedText.fontSize}px
          <input type="range" min="12" max="120" value={selectedText.fontSize}
            disabled={busy} onChange={e=>patchText({fontSize:Number(e.target.value)})}/>
        </label>
        <label>ตัวหนา <input type="checkbox" checked={selectedText.bold}
          disabled={busy} onChange={e=>patchText({bold:e.target.checked})}/></label>
        <label>ตัวเอียง <input type="checkbox" checked={selectedText.italic}
          disabled={busy} onChange={e=>patchText({italic:e.target.checked})}/></label>
      </>}
      <label>สี
        <input type="color" disabled={busy}
          value={(selected.payload as EditorText|EditorDrawing).color}
          onChange={e=>{
            const color=e.target.value
            if(isHexColor(color))patchSelected({payload:{...selected.payload,color}})
          }}/>
      </label>
      {selected.element_type==='drawing'&&<label>ความหนาเส้น {(selected.payload as EditorDrawing).strokeWidth}px
        <input type="range" min="1" max="30" disabled={busy}
          value={(selected.payload as EditorDrawing).strokeWidth}
          onChange={e=>patchSelected({payload:{
            ...selected.payload,strokeWidth:Number(e.target.value),
          }})}/>
      </label>}
      <label>ขนาดแนวนอน {Math.round(selected.width*100)}%
        <input type="range" min=".5" max="100" step=".5" disabled={busy}
          value={selected.width*100}
          onChange={e=>patchSelected({width:clamp(Number(e.target.value)/100,.005,1)})}/>
      </label>
      <label>ขนาดแนวตั้ง {Math.round(selected.height*100)}%
        <input type="range" min=".5" max="100" step=".5" disabled={busy}
          value={selected.height*100}
          onChange={e=>patchSelected({height:clamp(Number(e.target.value)/100,.005,1)})}/>
      </label>
      <label>หมุน {selected.rotation_deg}°
        <input type="range" min="-180" max="180" step="1" disabled={busy}
          value={selected.rotation_deg}
          onChange={e=>patchSelected({rotation_deg:normalizeRotation(Number(e.target.value))})}/>
      </label>
      <label>ความทึบ {Math.round(selected.opacity*100)}%
        <input type="range" min="5" max="100" step="5" disabled={busy}
          value={selected.opacity*100}
          onChange={e=>patchSelected({opacity:Number(e.target.value)/100})}/>
      </label>
      <div className="living-editor-layer-actions">
        <button type="button" className="button button--secondary" disabled={busy||top>=1000000}
          onClick={()=>patchSelected({z_index:top+1})}>นำมาด้านหน้า</button>
        <button type="button" className="button button--secondary" disabled={busy||bottom<=-1000000}
          onClick={()=>patchSelected({z_index:bottom-1})}>ส่งไปด้านหลัง</button>
        <button type="button" className="button button--primary" disabled={busy||!dirty}
          onClick={()=>void saveObject(selected)}>
          {busy?'กำลังบันทึก…':'บันทึกการแก้ไข'}
        </button>
        <button type="button" className="button button--secondary" disabled={busy}
          onClick={()=>{if(window.confirm('ลบวัตถุนี้ออกจากหน้า?'))void remove(selected)}}>ลบวัตถุ</button>
      </div>
    </div>}
    {editable&&<p className="living-editor-hint">
      เลือกเครื่องมือแล้วแตะบนกระดาษ · ปากกาบันทึกเป็นเส้นเวกเตอร์ · ลากเพื่อย้ายวัตถุ
      · ใช้ลูกศรเพื่อขยับตำแหน่ง · แก้ไขคุณสมบัติแล้วกดบันทึก
    </p>}
    {notice&&<p className="living-editor-feedback" role="status">{notice}</p>}
  </section>
}
