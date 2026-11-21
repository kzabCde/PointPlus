import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const actions=read('features/living-books/fast-stamp-actions.ts')
const placement=read('features/living-books/fast-stamp-placement.ts')
const shelf=read('features/living-books/shelf.tsx')
const data=read('features/living-books/data.ts')
const quick=read('features/living-books/fast-stamp-button.tsx')
const sql=read('supabase/stamp-book-first/18_living_stampbook_v3_m03_photos_stamps.sql')
const cards=read('supabase/stamp-book-first/23_living_v3_stamp_cards.sql')
const uuid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111'
const compile=source=>ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
}}).outputText
function loadModule(source,mocks={}){
  const module={exports:{}}
  new Function('require','module','exports',compile(source))(
    name=>{if(!(name in mocks))throw Error('unexpected import '+name);return mocks[name]},
    module,module.exports)
  return module.exports
}
const math=loadModule(placement)

function harness({allowed=true,cardTarget=6,occupied=[2]}={}){
  const calls=[],revalidated=[]
  const room=uuid(1),book=uuid(2),page=uuid(3),user=uuid(4)
  const rows={
    living_books:{status:'active'},
    living_book_givers:allowed?{user_id:user}:null,
    living_book_pages:{id:page},
    living_book_cards:cardTarget?{target_count:cardTarget}:null,
    living_stamp_requests:cardTarget
      ?occupied.map(card_slot=>({card_slot,status:'pending'}))
      :[{position_x:.5,position_y:.5}],
    living_stamp_marks:[{position_x:.2,position_y:.3}],
  }
  function table(name){
    const chain={
      select:()=>chain,eq:()=>chain,order:()=>chain,in:()=>chain,
      not:()=>chain,
      maybeSingle:async()=>({data:rows[name]??null,error:null}),
      limit:async()=>({data:rows[name]??[],error:null}),
    }
    return chain
  }
  const ctx={user:{id:user},supabase:{from:table}}
  const act=loadModule(actions,{
    'next/cache':{revalidatePath:path=>revalidated.push(path)},
    '@/lib/auth/validation':{isUuid:value=>typeof value==='string'&&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)},
    '@/features/spaces/data':{getSpaceContext:async()=>ctx},
    './m03-actions':{giveLivingStamp:async input=>{
      calls.push(input)
      return {ok:true,data:{request_id:uuid(5),mark_id:uuid(6),status:'approved'},
        message:'ประทับแสตมป์แล้ว'}
    }},
    './fast-stamp-placement':math,
    './stamp-model':{validPlacement:(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&
      x>=0&&x<=1&&y>=0&&y<=1},
  })
  return {act,calls,revalidated,room,book,page}
}

test('shelf exposes Quick Stamp only for eligible active givers; editor is not imported',()=>{
  assert.match(data,/living_book_givers/)
  assert.match(data,/\.eq\('user_id',context\.user\.id\)/)
  assert.match(shelf,/book\.status==='active'&&canGive\.has\(book\.id\)/)
  assert.match(shelf,/FastStampButton/)
  assert.match(quick,/loadFastStampOptions\(/)
  assert.match(quick,/submitFastStamp\(/)
  assert.doesNotMatch(quick,/paper-editor|LivingPaperEditor|LivingBookStudio/)
  assert.match(read('app/(protected)/s/[spaceId]/page.tsx'),/giverBookIds=\{giverBookIds\}/)
  assert.match(read('app/(protected)/s/[spaceId]/stamp-books/page.tsx'),/giverBookIds=\{giverBookIds\}/)
})

test('card coordinates exactly follow existing fixed-slot layout and invalid slots are denied',()=>{
  assert.deepEqual(math.cardStampPosition(4,6),{x:.1667,y:.75})
  assert.equal(math.cardStampPosition(7,6),null)
  assert.equal(math.cardStampPosition(0,6),null)
  assert.equal(math.cardStampPosition(1,0),null)
  assert.match(cards,/living_card_occupied_slot_unique/)
  assert.match(cards,/living_card_slot_guard/)
})

test('Quick Stamp options check giver membership and do not initialize full editor',async()=>{
  const yes=harness()
  const granted=await yes.act.loadFastStampOptions({spaceId:yes.room,bookId:yes.book})
  assert.equal(granted.ok,true)
  assert.equal(granted.data.kind,'card')
  assert.deepEqual(granted.data.occupiedSlots,[2])
  const no=harness({allowed:false})
  const denied=await no.act.loadFastStampOptions({spaceId:no.room,bookId:no.book})
  assert.equal(denied.ok,false)
  assert.doesNotMatch(actions,/loadLivingEditorData|loadLivingPageMedia|uploadLivingPhoto/)
})

test('Quick Stamp submission reuses authorized give action and stable coordinates across retries',async()=>{
  const h=harness()
  const payload={spaceId:h.room,bookId:h.book,pageId:h.page,
    assetId:'couple-heart',note:'Nice',key:uuid(7),cardSlot:4}
  const a=await h.act.submitFastStamp(payload)
  const b=await h.act.submitFastStamp(payload)
  assert.equal(a.ok,true)
  assert.equal(b.ok,true)
  assert.equal(h.calls.length,2)
  assert.deepEqual(h.calls[0],h.calls[1])
  assert.equal(h.calls[0].x,.1667)
  assert.equal(h.calls[0].y,.75)
  assert.equal(h.calls[0].key,payload.key)
  assert.ok(h.revalidated.includes('/s/'+h.room+'/stamp-books'))
})

test('free book placement prefers open positions and preserves exact retry payload',async()=>{
  const h=harness({cardTarget:null})
  const options=await h.act.loadFastStampOptions({spaceId:h.room,bookId:h.book})
  assert.equal(options.data.kind,'book')
  const position=math.freeStampPosition(uuid(9),options.data.occupiedPositions)
  assert.ok(position.x>=0&&position.x<=1)
  assert.ok(position.y>=0&&position.y<=1)
  assert.deepEqual(position,math.freeStampPosition(uuid(9),options.data.occupiedPositions))
  const p={spaceId:h.room,bookId:h.book,pageId:h.page,assetId:'couple-heart',
    note:'',key:uuid(9),placement:position}
  assert.equal((await h.act.submitFastStamp(p)).ok,true)
  assert.equal(h.calls.length,1)
  assert.deepEqual([h.calls[0].x,h.calls[0].y],[position.x,position.y])
  assert.equal((await h.act.submitFastStamp({...p,cardSlot:1})).ok,false)
  assert.equal(h.calls.length,1)
})

test('database RPC owns authorization, transaction idempotency, marks and approval',()=>{
  assert.match(actions,/giveLivingStamp\(/)
  assert.doesNotMatch(actions,/\.insert\(|\.update\(|\.delete\(|service_role/)
  assert.match(sql,/UNIQUE\(book_id,giver_user_id,idempotency_key\)/)
  assert.match(sql,/WHERE id=p_book FOR UPDATE/)
  assert.match(sql,/living_book_givers/)
  assert.match(sql,/Idempotency key used with different stamp input/)
  assert.match(sql,/approval_required/)
  assert.match(sql,/IF v_status='approved' THEN/)
  assert.match(quick,/sessionStorage\.setItem\(storageKey,JSON\.stringify\(command\)\)/)
  assert.match(quick,/sessionStorage\.removeItem\(storageKey\)/)
  assert.doesNotMatch(quick,/router\.refresh\(/)
})
