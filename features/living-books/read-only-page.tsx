import Image from 'next/image'
import Link from 'next/link'
import type {CSSProperties} from 'react'
import {pointPlusStamps} from '@/lib/point-plus/assets'
import type {EditorDrawing,EditorElement,EditorImage,EditorText,LivingEditorPage} from './editor-model'
import type {LivingStampMark,LivingStampRequest} from './stamp-model'

type ReaderProps={
  spaceId:string;bookId:string;page:LivingEditorPage
  elements:EditorElement[];marks:LivingStampMark[];requests:LivingStampRequest[]
  imageUrls:Record<string,string>;card:{target_count:number;reward_title:string}|null
  previous:string|null;next:string|null;pageNumber:number;pageCount:number
}

const artwork=new Map(pointPlusStamps.map(item=>[item.id,item]))
const slotNumber=(x:number,y:number,target:number)=>{
  const columns=Math.min(5,Math.ceil(Math.sqrt(target)))
  const rows=Math.ceil(target/columns)
  const col=Math.floor(x*columns),row=Math.floor(y*rows)
  const slot=row*columns+col+1
  return slot>=1&&slot<=target?slot:null
}

function PaperDecoration({item,photoSrc}:{item:EditorElement;photoSrc?:string}){
  const style:CSSProperties={
    left:item.position_x*100+'%',top:item.position_y*100+'%',
    width:item.width*100+'%',height:item.height*100+'%',
    transform:'rotate('+item.rotation_deg+'deg)',
    opacity:item.opacity,zIndex:item.z_index+1000000,
  }
  if(item.element_type==='text'){
    const p=item.payload as EditorText
    const fontFamily=p.fontFamily==='serif'?'Georgia,serif':
      p.fontFamily==='mono'?'monospace':'system-ui,sans-serif'
    return <div className="living-paper-object living-paper-object--text" style={style}>
      <div className="living-paper-object__text" style={{
        color:p.color,fontSize:p.fontSize,fontFamily,textAlign:p.align,
        fontWeight:p.bold?'bold':'normal',fontStyle:p.italic?'italic':'normal',
      }}>{p.text}</div>
    </div>
  }
  if(item.element_type==='image'){
    const p=item.payload as EditorImage
    const crop=p.crop
    return <div className="living-paper-object living-paper-object--image" style={style}>
      <div className="living-paper-object__photo-frame">
        {photoSrc?<img src={photoSrc} alt="ภาพความทรงจำ" loading="lazy"
          draggable={false} style={{position:'absolute',width:100/crop.width+'%',
            height:100/crop.height+'%',left:-100*crop.x/crop.width+'%',
            top:-100*crop.y/crop.height+'%'}}/>:
          <span className="living-paper-object__missing">ภาพไม่พร้อมแสดง</span>}
      </div>
    </div>
  }
  const p=item.payload as EditorDrawing
  return <div className="living-paper-object living-paper-object--drawing" style={style}>
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
      <polyline points={p.points.map(point=>
        Math.round(point.x*1000)+','+Math.round(point.y*1000)).join(' ')}
        fill="none" stroke={p.color} strokeWidth={p.strokeWidth*5}
        strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  </div>
}

function StampPreview({mark}:{mark:LivingStampMark}){
  const art=artwork.get(mark.asset_id)
  const peeled=mark.state==='peeled',reserved=mark.state==='reserved'
  const redeemed=mark.state==='redeemed'
  return <div className="living-real-stamp living-reading-stamp"
    key={mark.id} data-peeled={peeled} data-used={redeemed}
    data-reserved={reserved} title={mark.note??art?.nameTh??'แสตมป์'}
    aria-label={art?.nameTh??'แสตมป์'} style={{
      left:mark.position_x*100+'%',top:mark.position_y*100+'%',
      width:12*mark.scale_factor+'%',
      transform:'translate(-50%,-50%) rotate('+mark.rotation_deg+'deg)',
    }}>
    {art&&<Image src={art.png} alt="" width={128} height={128}
      className="living-real-stamp__image"/>}
    {peeled&&<span className="living-real-stamp__trace">ลอกแล้ว</span>}
    {redeemed&&<span className="living-real-stamp__used">แลกแล้ว</span>}
    {reserved&&<span className="living-real-stamp__reserved">จองไว้</span>}
  </div>
}

function PendingPreview({request}:{request:LivingStampRequest}){
  const art=artwork.get(request.asset_id)
  return <div className="living-real-stamp living-real-stamp--pending living-reading-stamp"
    aria-label="แสตมป์รออนุมัติ ไม่เพิ่มยอดสะสม"
    style={{left:request.position_x*100+'%',top:request.position_y*100+'%',
      width:12*request.scale_factor+'%',
      transform:'translate(-50%,-50%) rotate('+request.rotation_deg+'deg)'}}>
    {art&&<Image src={art.png} alt="" width={128} height={128}/>}
    <span>รออนุมัติ</span>
  </div>
}

function ReadOnlyCard({target,reward,marks,requests}:{
  target:number;reward:string;marks:LivingStampMark[];requests:LivingStampRequest[]
}){
  const columns=Math.min(5,Math.ceil(Math.sqrt(target)))
  const bySlot=new Map<number,LivingStampMark>()
  for(const mark of marks){
    const slot=slotNumber(Number(mark.position_x),Number(mark.position_y),target)
    if(slot)bySlot.set(slot,mark)
  }
  const pending=new Set(requests.map(r=>slotNumber(Number(r.position_x),Number(r.position_y),target)))
  return <section className="living-card-sheet living-reading-card" aria-label="การ์ดสะสม">
    <header className="living-card-heading">
      <p className="living-card-progress"><strong>{bySlot.size}</strong> / {target} ดวง</p>
      <p className="living-card-reward">ครบแล้วแลก: <strong>{reward}</strong></p>
    </header>
    <div className="living-card-slots" role="list" aria-label="ช่องสะสมแสตมป์"
      style={{gridTemplateColumns:'repeat('+columns+',minmax(0,1fr))'}}>
      {Array.from({length:target},(_,index)=>{
        const n=index+1,mark=bySlot.get(n),waiting=pending.has(n)
        const art=mark&&artwork.get(mark.asset_id)
        const state=mark?.state??(waiting?'pending':'empty')
        const label=mark?'ช่อง '+n+': '+(
          mark.state==='peeled'?'ลอกแล้ว':mark.state==='reserved'?'จองไว้':
          mark.state==='redeemed'?'แลกแล้ว':'ได้รับแสตมป์'):
          'ช่อง '+n+': '+(waiting?'รออนุมัติ':'ว่าง')
        return <div key={n} role="listitem" className="living-card-slot"
          data-state={state} aria-label={label}>
          <span className="living-card-slot-number" aria-hidden="true">{n}</span>
          {art?<Image src={art.png} alt="" width={62} height={62}/>:
            <span className="living-card-empty-glyph" aria-hidden="true">{waiting?'⌛':'✳'}</span>}
          {mark&&mark.state!=='available'&&
            <small className="living-card-slot-state">{mark.state==='peeled'?'ลอกแล้ว':
              mark.state==='reserved'?'จองไว้':'แลกแล้ว'}</small>}
          {waiting&&<small className="living-card-slot-state">รออนุมัติ</small>}
        </div>
      })}
    </div>
    {requests.length>0&&<p className="living-reading-pending">
      คำขอรออนุมัติ {requests.length} รายการ · เปิดโหมดจัดการแสตมป์เพื่ออนุมัติ
    </p>}
  </section>
}

export function LivingReadOnlyPage(props:ReaderProps){
  const {spaceId,bookId,page,elements,marks,requests,imageUrls,card,
    previous,next,pageNumber,pageCount}=props
  const base='/s/'+spaceId+'/stamp-books/living/'+bookId
  return <div className="living-reading-body">
    {card?
      <ReadOnlyCard target={card.target_count} reward={card.reward_title}
        marks={marks} requests={requests}/>:
      <section className="living-reading-canvas" aria-label={'หน้าสมุด '+pageNumber}>
        {page.title&&<h2 className="living-reading-page-title">{page.title}</h2>}
        <div className="living-editor-paper living-reading-paper"
          data-background={page.background_style}>
          {elements.map(element=><PaperDecoration key={element.id} item={element}
            photoSrc={imageUrls[element.id]}/>)}
          {marks.map(mark=><StampPreview key={mark.id} mark={mark}/>)}
          {requests.map(request=><PendingPreview key={request.id} request={request}/>)}
        </div>
      </section>}
    {!card&&<nav className="living-reading-pagination" aria-label="เปลี่ยนหน้าสมุด">
      {previous?<Link href={base+'?page='+previous} prefetch={false}
        className="button button--secondary">← ก่อนหน้า</Link>:
        <span aria-hidden="true"/>}
      <span aria-live="polite">หน้า {pageNumber} / {pageCount}</span>
      {next?<Link href={base+'?page='+next} prefetch={false}
        className="button button--secondary">ถัดไป →</Link>:<span aria-hidden="true"/>}
    </nav>}
  </div>
}
