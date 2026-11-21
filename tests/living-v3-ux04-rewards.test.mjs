import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url)
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const panelSource=read('features/living-books/redemption-panel.tsx')
const studioSource=read('features/living-books/editor-studio.tsx')
const pageSource=read('app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx')
const css=read('app/(protected)/s/[spaceId]/stamp-books/stamp-books.css')
const assets=new Map([['heart',{nameTh:'หัวใจ',png:'/test/heart.webp'}]])
const img=({src,alt='',width,height,...rest})=>React.createElement('img',{
  src,alt,width,height,...rest,
})
const link=({href,children,...rest})=>React.createElement('a',{href,...rest},children)
function importComponent(path,stubs){
 const compiled=ts.transpileModule(read(path),{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.CommonJS,esModuleInterop:true,
 }}).outputText
 const mod={exports:{}}
 const dependencies={
  react:require('react'),
  'react/jsx-runtime':require('react/jsx-runtime'),
  ...stubs,
 }
 new Function('module','exports','require',compiled)(
  mod,mod.exports,name=>{
   if(!(name in dependencies))throw new Error('Unexpected runtime dependency: '+name)
   return dependencies[name]
  })
 return mod.exports
}
const {LivingRedemptionPanel}=importComponent('features/living-books/redemption-panel.tsx',{
 'next/navigation':{useRouter:()=>({refresh(){}})},
 'next/image':img,'./stamp-model':{stampArtwork:assets},
 './paper-sound':{emitPaperCue(){}},
 './redemption-actions':{
  requestLivingRedemption(){},fulfillLivingRedemption(){},cancelLivingRedemption(){},
 },
})
const {LivingBookStudio}=importComponent('features/living-books/editor-studio.tsx',{
 'next/navigation':{useRouter:()=>({refresh(){}})},
 'next/link':link,'./paper-sound':{usePaperSound:()=>({enabled:false,toggle(){}})},
})
const req=(id,status,quantity,rewardMessage)=>({
 id,book_id:'book',space_id:'room',recipient_participant_id:'recipient',
 requested_by:'recipient',requested_quantity:quantity,reward_message:rewardMessage,
 status,requested_at:'2026-11-21T07:00:00Z',
 fulfilled_at:status==='fulfilled'?'2026-11-21T07:01:00Z':null,
 fulfilled_by:null,canceled_at:null,canceled_by:null,
})
const pending=req('pending-1','requested',3,'พาไปดูดอกไม้')
const fulfilled=req('fulfilled-1','fulfilled',2,'ไปปิกนิกกัน')
const canceled=req('canceled-1','canceled',1,'ดูหนังด้วยกัน')
const defaults={
 spaceId:'room',bookId:'book',
 balance:{total:12,available:6,reserved:3,redeemed:2,peeled:1},
 history:[pending,fulfilled,canceled],
 candidates:[{id:'stamp-1',asset_id:'heart',page_id:'page',
  state:'available',granted_at:'2026-11-21T07:00:00Z'}],
 associations:[{redemption_id:'fulfilled-1',mark_id:'stamp-2'}],
 knownStamps:[{id:'stamp-2',asset_id:'heart',page_id:'page',
  state:'redeemed',granted_at:'2026-11-21T06:00:00Z'}],
 isActive:true,
}
const renderPanel=props=>renderToStaticMarkup(React.createElement(
 LivingRedemptionPanel,{...defaults,...props},
))
test('UX04 actual React SSR: recipient sees compact three balances, quantity and text; no owner actions',()=>{
 const html=renderPanel({canRequest:true,canFulfill:false})
 assert.match(html,/aria-label="สถานะแสตมป์"/)
 assert.match(html,/aria-label="เลื่อนเพื่อเลือกจำนวนแสตมป์"/)
 assert.match(html,/id="living-redeem-quantity"/)
 assert.match(html,/id="living-redeem-reward"/)
 assert.match(html,/ส่งคำขอแลกรางวัล/)
 assert.match(html,/พาไปดูดอกไม้/)
 assert.match(html,/กำลังรอการยืนยัน/)
 assert.match(html,/ประวัติการแลกรางวัล/)
 assert.match(html,/ไปปิกนิกกัน/)
 assert.match(html,/แสตมป์ที่ใช้แล้วมีรอยตำหนิถาวร/)
 assert.doesNotMatch(html,/ยืนยันให้รางวัลแล้ว/)
 assert.doesNotMatch(html,/ยืนยันยกเลิกคำขอ/)
 assert.equal((html.match(/class="living-redemption-balance"/g)||[]).length,3)
})
test('UX04 actual React SSR: owner sees pending fulfil/cancel controls but not recipient claim form',()=>{
 const html=renderPanel({canRequest:false,canFulfill:true})
 assert.match(html,/คำขอที่รอคุณตอบรับ/)
 assert.match(html,/ยืนยันให้รางวัลแล้ว/)
 assert.match(html,/ยกเลิกและคืนแสตมป์/)
 assert.match(html,/aria-expanded="false"/)
 assert.doesNotMatch(html,/id="living-redeem-quantity"/)
 assert.doesNotMatch(html,/ส่งคำขอแลกรางวัล/)
})
test('UX04 actual React SSR: readonly visitor cannot claim or fulfill',()=>{
 const html=renderPanel({canRequest:false,canFulfill:false,isActive:false})
 assert.doesNotMatch(html,/ยืนยันให้รางวัลแล้ว/)
 assert.doesNotMatch(html,/ส่งคำขอแลกรางวัล/)
 assert.match(html,/แลกแล้ว/)
 assert.match(html,/รอยตำหนิถาวร/)
})
test('UX04 actual React SSR: zero available prevents a valid claim and retains history',()=>{
 const html=renderPanel({canRequest:true,canFulfill:false,
  balance:{total:6,available:0,reserved:0,redeemed:6,peeled:0},candidates:[]})
 assert.match(html,/ยังไม่มีแสตมป์พร้อมใช้/)
 assert.match(html,/id="living-redeem-quantity"[^>]*disabled/)
 assert.match(html,/ประวัติการแลกรางวัล/)
})
test('UX04 actual React SSR: dialog is hidden initially and focus/label semantics are present',()=>{
 const panel=React.createElement(LivingRedemptionPanel,{
  ...defaults,canRequest:true,canFulfill:false,
 })
 const html=renderToStaticMarkup(React.createElement(LivingBookStudio,{
  title:'Our Memories',backHref:'/s/room/stamp-books',status:'active',
  availableStamps:6,pendingRewards:2,rewardPanel:panel,
 },React.createElement('div',{'data-testid':'paper'},'Paper')))
 assert.match(html,/aria-haspopup="dialog"/)
 assert.match(html,/aria-expanded="false"/)
 assert.match(html,/aria-controls="living-reader-rewards"/)
 assert.match(html,/class="living-reader-reward-overlay" hidden=""/)
 assert.match(html,/role="dialog" aria-modal="true"/)
 assert.match(html,/aria-labelledby="living-reader-rewards-title"/)
 assert.match(html,/aria-label="ปิดแผงแลกรางวัล"/)
 assert.match(html,/Our Memories/)
 assert.match(html,/data-testid="paper"/)
 assert.match(html,/>2<\/span>/)
})
test('UX04 focus trap, Escape, background scroll lock, restoration and muted sound are present',()=>{
 for(const str of [
  "document.addEventListener('keydown',onKey,true)",
  "document.removeEventListener('keydown',onKey,true)",
  "document.body.style.overflow='hidden'",
  'document.body.style.overflow=previousOverflow',
  "event.key==='Escape'","event.key!=='Tab'",
  'rewardTriggerRef.current?.focus()',
  'dialog?.focus()','node.getClientRects().length>0',
  'aria-haspopup="dialog"','role="dialog" aria-modal="true"',
  'usePaperSound()','aria-pressed={enabled}',
 ])assert.ok(studioSource.includes(str),'Missing accessible focus behavior: '+str)
})
test('UX04 request/resolution uses exact authorized RPCs and immutable idempotent retry',()=>{
 for(const str of [
  'requestLivingRedemption(', 'fulfillLivingRedemption(', 'cancelLivingRedemption(',
  'requestLock.current=true','actionLock.current=true',
  'idempotencyKey:key','requestSnapshot.current',
  '...requestSnapshot.current','confirmAction?.id!==id',
  "setConfirmAction({id:item.id,fulfill:true})",
  "setConfirmAction({id:item.id,fulfill:false})",
  'role="group"','aria-label="ยืนยันการดำเนินการกับคำขอ"',
  'จองแสตมป์แล้ว','จำนวนแสตมป์ที่ต้องการแลก',
 ])assert.ok(panelSource.includes(str),'Missing reward integrity: '+str)
 assert.match(pageSource,/pendingRewards=\{owner\?history\.filter/)
 assert.doesNotMatch(panelSource,/supabase\.from\(|\.rpc\(/)
})
test('UX04 paper motion remains restrained, optional audio and reduced motion accessible',()=>{
 for(const str of [
  '.living-reader-reward-overlay[hidden]',
  '.living-reader-reward-backdrop',
  '.living-reader-pending-count',
  '.living-redemption-panel--focused',
  '.living-redemption-quantity-slider',
  '@keyframes living-reward-sheet-in',
  '@media(prefers-reduced-motion:reduce)',
  '.living-reader-reward-overlay .living-reader-reward-sheet',
  'min-height:44px',
 ])assert.ok(css.includes(str),'Missing UX04 CSS '+str)
 assert.match(read('features/living-books/paper-sound.ts'),/useState\(false\)/)
 assert.match(css,/@keyframes living-book-paper-reveal/)
 assert.match(css,/@keyframes living-stamp-impact/)
 assert.match(css,/@keyframes living-stamp-ink-left/)
 assert.match(css,/@keyframes living-redeemed-mark/)
})
