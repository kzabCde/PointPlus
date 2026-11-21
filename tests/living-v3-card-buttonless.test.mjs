import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source=read('features/living-books/card-board.tsx')
const css=read('app/(protected)/s/[spaceId]/stamp-books/stamp-books.css')
const artwork=JSON.parse(read('assets/point-plus/manifest/stamps.json'))

function compile(){
  const mod={exports:{}}
  const js=ts.transpileModule(source,{compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  }}).outputText
  const deps={
    react:React,'react/jsx-runtime':require('react/jsx-runtime'),
    'next/image':({src,alt='',width,height})=>React.createElement('img',{src,alt,width,height}),
    'next/navigation':{useRouter:()=>({refresh(){}})},
    '@/lib/point-plus/assets':{pointPlusStamps:artwork},
    './m03-actions':{
      giveLivingStamp(){throw Error('Must not mutate ledger during render')},
      reviewLivingStamp(){throw Error('Must not approve during render')},
      cancelLivingStampRequest(){throw Error('Must not cancel during render')},
    },
  }
  new Function('module','exports','require',js)(mod,mod.exports,
    name=>{if(!(name in deps))throw Error('Unexpected import '+name);return deps[name]})
  return mod.exports
}
const {LivingCardBoard,cardGrid}=compile()
const defaults={
  spaceId:'room',bookId:'book',pageId:'page',target:6,
  reward:'ออกไปเที่ยวด้วยกัน',marks:[],requests:[],userId:'owner',
  canGive:true,canReview:false,active:true,
}
const render=props=>renderToStaticMarkup(React.createElement(
  LivingCardBoard,{...defaults,...props}))

test('V3 card initially renders only tappable paper slots, not permanent stamp forms',()=>{
  const html=render()
  assert.equal((html.match(/class="living-card-slot"/g)||[]).length,6)
  assert.match(html,/role="group" aria-label="ช่องสะสมแสตมป์"/)
  assert.match(html,/aria-label="ช่อง 1: ว่าง"/)
  assert.match(html,/aria-label="ช่อง 6: ว่าง"/)
  assert.match(html,/ครบแล้วแลก/)
  assert.doesNotMatch(html,/aria-modal="true"/)
  assert.doesNotMatch(html,/living-card-art-tray/)
  assert.doesNotMatch(html,/<select\b/)
  assert.doesNotMatch(html,/ยืนยันให้แสตมป์/)
})
test('V3 slot grid matches SQL target geometry for small and large cards',()=>{
  assert.deepEqual(cardGrid(4),{columns:2,rows:2})
  assert.deepEqual(cardGrid(6),{columns:3,rows:2})
  assert.deepEqual(cardGrid(100),{columns:5,rows:20})
  assert.match(source,/toFixed\(4\)/)
  assert.match(source,/rotation:0,scale:0\.7/)
  assert.match(source,/giveLivingStamp\(\{/)
  assert.match(source,/pointPlusStamps\.map/)
})
test('Readonly and spent real stamps cannot be issued twice from slot controls',()=>{
  const mark={id:'m1',asset_id:artwork[0].id,page_id:'page',
    position_x:.1667,position_y:.25,state:'redeemed'}
  const html=render({marks:[mark],canGive:false})
  assert.match(html,/aria-label="ช่อง 1: แลกแล้ว"/)
  assert.match(html,/aria-label="ช่อง 2: ว่าง"[^>]*disabled/)
  assert.doesNotMatch(html,/ยืนยันให้แสตมป์/)
})
test('Pending approval is in an optional disclosure, not a persistent action toolbar',()=>{
  const pending={id:'r1',giver_user_id:'owner',asset_id:artwork[0].id,
    position_x:.1667,position_y:.25}
  const html=render({requests:[pending],canReview:true})
  assert.match(html,/<details class="living-card-requests">/)
  assert.match(html,/รออนุมัติ/)
  assert.match(html,/อนุมัติ/)
  assert.match(html,/ปฏิเสธ/)
  assert.match(html,/คำขอแสตมป์ที่รออนุมัติ/)
  assert.doesNotMatch(html,/aria-modal="true"/)
})
test('Contextual tray retains explicit confirmation, retry key and accessible keyboard dismissal',()=>{
  for(const pattern of [
    /role="dialog" aria-modal="true"/,
    /aria-labelledby="living-card-dialog-heading"/,
    /submitLock\.current=true/,
    /submitLock\.current=false/,
    /if\(!active\|\|!canGive/,
    /event\.key==='Escape'/,
    /event\.key==='Tab'/,
    /document\.body\.style\.overflow='hidden'/,
    /document\.addEventListener\('keydown',onKey,true\)/,
    /disabled=\{busy\|\|attempted\}/,
    /setKey\(crypto\.randomUUID\(\)\)/,
    /ยืนยันให้แสตมป์/,
    /ลองยืนยันคำขอเดิม/,
  ]) assert.match(source,pattern)
})
test('Paper card is responsive, accessible and reduced-motion aware',()=>{
  for(const pattern of [
    /\.living-card-sheet/,
    /\.living-card-slot:focus-visible/,
    /\.living-card-art-choice:focus-visible/,
    /@media\(max-width:410px\)/,
    /@media\(prefers-reduced-motion:reduce\)/,
    /\.living-card-overlay/,
    /\.living-card-tray/,
  ]) assert.match(css,pattern)
  assert.match(source,/className="living-card-art-choice"/)
  assert.match(source,/min-width:0|aria-pressed=\{asset===art\.id\}/)
})
