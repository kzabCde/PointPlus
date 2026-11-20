import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const sheet = read('supabase/stamp-book-first/14_restore_stamp_card_choice.sql')
const form = read('features/stamp-books/forms.tsx')
const journal = read('features/stamp-books/journal.tsx')
const detail = read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx')
const card = read('features/stamp-books/card.tsx')
const actions = read('features/stamp-books/actions.ts')
const data = read('features/stamp-books/data.ts')

test('SQL introduces card as an additive variant, preserving book ledgers, old RPCs and all rewards', () => {
  assert.match(sheet, /layout_mode IN \('single_sheet','notebook','stamp_card'\)/)
  assert.match(sheet, /pointplus_create_paper_stamp_book/)
  assert.match(sheet, /public\.pointplus_create_stamp_book\(/)
  assert.match(sheet, /auth\.uid\(\) IS NULL/)
  assert.match(sheet, /REVOKE ALL ON FUNCTION public\.pointplus_create_paper_stamp_book/)
  assert.match(sheet, /GRANT EXECUTE ON FUNCTION public\.pointplus_create_paper_stamp_book/)
  assert.doesNotMatch(sheet, /\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM\b|\bUPDATE public\.stamp_book_marks\b/i)
  assert.match(sheet, /COMMIT;\s*$/)
})
test('both regular and couple creators choose card vs book explicitly', () => {
  const regular = form.slice(form.indexOf('export function CreateStampBookForm'),
    form.indexOf('export function GiveStampDialog'))
  const couple = form.slice(form.indexOf('export function CreateCoupleStampBookForm'))
  for(const block of [regular,couple]){
    assert.match(block, /name="layout_mode"/)
    assert.match(block, /setLayoutMode\('stamp_card'\)/)
    assert.match(block, /setLayoutMode\('notebook'\)/)
    assert.match(block, /value="card"/)
    assert.match(block, /value="book"/)
    assert.match(block, /single_sheet/)
  }
  assert.match(actions, /\['single_sheet','notebook','stamp_card'\]/)
  assert.match(actions, /pointplus_create_paper_stamp_book/)
})
test('fixed-slot cards restore the original sequential accumulation and confirmed marks only',()=>{
  assert.match(card, /Array\.from\(\{ length: count \}/)
  assert.match(card, /cycle\.marks\[index\]/)
  assert.match(card, /data-earned=\{!!mark\}/)
  assert.match(card, /status === 'pending'/)
  assert.match(journal, /layoutMode === 'stamp_card'/)
  assert.match(journal, /StampCollectionCard/)
  assert.match(journal, /StampPaper/)
  assert.match(journal, /rewardContent\[cycle\.id\]/)
  assert.match(detail, /ClaimCoupleMemoryForm/)
  assert.match(detail, /ClaimStampRewardForm/)
  assert.match(detail, /ReviewStampForm/)
  assert.match(detail, /ProcessBookRewardForm/)
  assert.match(data, /layout_mode:'single_sheet'\|'notebook'\|'stamp_card'/)
})
test('card giving uses the original authorized/idempotent RPC, without placement-only fields',()=>{
  const give = form.slice(form.indexOf('export function GiveStampDialog'),
    form.indexOf('export function ClaimStampRewardForm'))
  assert.match(detail, /GiveStampDialog/)
  assert.match(detail, /layout_mode === 'stamp_card'/)
  assert.match(give, /useBookAction\(giveStampAction\)/)
  assert.match(give, /idempotency_key/)
  assert.match(give, /recipient_id/)
  assert.match(give, /name="asset_id"/)
  assert.doesNotMatch(give, /name="position_x"|name="rotation_deg"/)
  assert.match(actions, /hasScale \? 'pointplus_give_stamp_freely' : hasPosition \? 'pointplus_give_stamp_at' : 'pointplus_give_stamp'/)
})
test('creating a stamp card dispatches unchanged creator parameters plus the chosen layout',async()=>{
  const compiled = ts.transpileModule(actions, {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText
  const calls=[]
  const id='11111111-1111-4111-8111-111111111111'
  const person='22222222-2222-4222-8222-222222222222'
  const space='33333333-3333-4333-8333-333333333333'
  const stamps=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
  const stubs={
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{
      field:(f,n)=>String(f.get(n)??'').trim(),
      isUuid:v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v),
    },
    '@/features/spaces/data':{
      getSpaceContext:async()=>({
        supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:id,error:null}}},
        member:{role:'owner'},space:{kind:'couple'},
      }),
      canManage:role=>role==='owner',
    },
    '@/lib/point-plus/assets':{pointPlusStamps:stamps},
  }
  const mod={exports:{}}
  new Function('require','module','exports',compiled)(
    name=>{if(!(name in stubs))throw Error('Unexpected '+name);return stubs[name]},
    mod,mod.exports)
  const f=new FormData()
  for(const [name,value] of Object.entries({
    space_id:space,title:'การ์ดความทรงจำ',description:'',target_count:'6',
    approval_policy:'direct',rewards:'รางวัลของเรา',layout_mode:'stamp_card',
  }))f.set(name,value)
  f.append('recipient_id',person)
  f.append('giver_id',id)
  f.append('asset_id',stamps[0].id)
  const result=await mod.exports.createStampBookAction({status:'idle',message:''},f)
  assert.equal(result.status,'success')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_create_paper_stamp_book')
  assert.equal(calls[0].args.p_layout,'stamp_card')
  assert.deepEqual(calls[0].args.p_recipients,[person])
  assert.deepEqual(calls[0].args.p_givers,[id])
  assert.deepEqual(calls[0].args.p_styles,[stamps[0].id])
  f.set('layout_mode','invalid')
  const bad=await mod.exports.createStampBookAction({status:'idle',message:''},f)
  assert.equal(bad.status,'error')
  assert.equal(calls.length,1)
})
