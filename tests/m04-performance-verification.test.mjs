import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {summarizeSamples,compareSummaries} from '../scripts/m04-performance-summary.mjs'
import {validateM04Staging} from './e2e/m04-staging-guard.mjs'

const sha='a'.repeat(40),older='b'.repeat(40)
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const script=read('tests/e2e/fast-stamp-m04-staging.mjs')
const cardE2e=read('tests/e2e/living-v3-card-buttonless-browser.mjs')
const rewardsE2e=read('tests/e2e/living-v3-ux04-browser.mjs')
const full=read('.github/workflows/ci.yml')

function input(commit=sha,samples=[],conditions={network:'normal',device:'desktop'}){
  return {environment:'staging',commit,conditions,samples}
}
test('M04 metrics aggregate only actual numbers, with correct median and nearest-rank p95',()=>{
  const vals=Array.from({length:20},(_,i)=>i+1)
  const record=summarizeSamples(input(sha,vals.map(ms=>({
    scenario:'reader_ready',device:'desktop',ms,
  }))))
  assert.deepEqual(record.metrics['reader_ready/desktop'],{
    n:20,median_ms:10.5,p95_ms:19,min_ms:1,max_ms:20,
  })
  const small=summarizeSamples(input(sha,[1,2,3].map(ms=>({
    scenario:'fast_stamp_confirmed',device:'mobile',ms,
  }))))
  assert.deepEqual(small.metrics['fast_stamp_confirmed/mobile'],{
    n:3,median_ms:2,p95_ms:null,min_ms:1,max_ms:3,
  })
})

test('M04 cannot invent performance samples, baseline or an unmatched comparison',()=>{
  assert.throws(()=>summarizeSamples(input('invalid',[])))
  assert.throws(()=>summarizeSamples({...input(),environment:'production'}))
  assert.throws(()=>summarizeSamples(input(sha,[{scenario:'reader_ready',
    device:'desktop',ms:NaN}])))
  assert.throws(()=>summarizeSamples(input(sha,[{scenario:'reader_ready',
    device:'desktop',ms:-10}])))
  assert.throws(()=>summarizeSamples(input(sha,[{scenario:'unknown',
    device:'desktop',ms:10}])))
  const before=summarizeSamples(input(older,[{scenario:'reader_ready',
    device:'desktop',ms:200}]))
  const after=summarizeSamples(input(sha,[{scenario:'reader_ready',
    device:'desktop',ms:100}]))
  assert.equal(compareSummaries(before,after).metrics['reader_ready/desktop'].delta_pct,-50)
  const different=summarizeSamples({...input(sha,[{scenario:'reader_ready',
    device:'desktop',ms:100}]),conditions:{network:'slow'}})
  assert.equal(compareSummaries(before,different).metrics['reader_ready/desktop'].delta_pct,null)
  assert.equal(compareSummaries(null,after).baseline_comparable,false)
})

const fake={
  POINTPLUS_E2E_STAGING_ONLY:'1',POINTPLUS_E2E_PREVIEW_VERIFIED:'1',
  POINTPLUS_E2E_STAGING_APP_URL:'https://pointplus-staging.example.org',
  POINTPLUS_E2E_SUPABASE_URL:'https://isolatedm04test.supabase.co',
  POINTPLUS_E2E_PUBLISHABLE_KEY:'test-public',
  POINTPLUS_E2E_A_EMAIL:'a@example.org',POINTPLUS_E2E_A_PASSWORD:'a',
  POINTPLUS_E2E_B_EMAIL:'b@example.org',POINTPLUS_E2E_B_PASSWORD:'b',
  POINTPLUS_E2E_ROOM_ID:'11111111-1111-4111-8111-111111111111',
  POINTPLUS_PLAYWRIGHT_CORE:'/tmp/playwright/index.mjs',
  POINTPLUS_E2E_VERIFIED_COMMIT_SHA:sha,
}
test('M04 staging guard rejects Production URLs, flag bypass and unverified commit',()=>{
  assert.equal(validateM04Staging(fake).expectedCommit,sha)
  for(const candidate of [
    {...fake,POINTPLUS_E2E_STAGING_ONLY:'0'},
    {...fake,POINTPLUS_E2E_PREVIEW_VERIFIED:'0'},
    {...fake,POINTPLUS_E2E_SUPABASE_URL:'https://gczribbtkfvhpzzupqre.supabase.co'},
    {...fake,POINTPLUS_E2E_STAGING_APP_URL:'https://pointpluss.vercel.app'},
    {...fake,POINTPLUS_E2E_STAGING_APP_URL:'https://pointplus-nowheredev.vercel.app'},
    {...fake,POINTPLUS_E2E_STAGING_APP_URL:'https://pointplus-gpq1retfc-nowheredev.vercel.app'},
    {...fake,POINTPLUS_E2E_STAGING_APP_URL:'http://localhost:3000'},
    {...fake,POINTPLUS_E2E_A_EMAIL:'b@example.org'},
    {...fake,POINTPLUS_E2E_VERIFIED_COMMIT_SHA:'mismatch'},
    {...fake,POINTPLUS_E2E_ROOM_ID:'unknown'},
  ])assert.throws(()=>validateM04Staging(candidate))
  assert.throws(()=>validateM04Staging({...fake,POINTPLUS_E2E_A_EMAIL:''}))
})

test('Staging script uses two authenticated accounts, audit SQL and real browser timings',()=>{
  for(const match of [
    /validateM04Staging\(process\.env\)/,
    /execFileSync\('git',\['rev-parse','HEAD'\]/,
    /browser\.newContext\(/,
    /auth\.signInWithPassword/,
    /create_book_confirmed/,
    /create_card_confirmed/,
    /fast_stamp_confirmed/,
    /reader_ready/,
    /editor_ready/,
    /card_ready/,
    /shelf_ready/,
    /creation_form_ready/,
    /pointplus_request_living_stamp_redemption/,
    /pointplus_fulfill_living_stamp_redemption/,
    /pointplus_give_living_stamp/,
    /assert\.equal\(results\.filter\(item=>!item\.error\)\.length,1\)/,
    /summarizeSamples\(output\)/,
  ])assert.match(script,match)
  assert.doesNotMatch(script,/process\.env\.[A-Z_]*SERVICE_ROLE|\.delete\(|\.remove\(/)
  assert.match(cardE2e,/const deep=.*'\?mode=edit'/)
  assert.match(rewardsE2e,/const deep=.*'\?mode=edit'/)
  assert.match(full,/tests\/fast-stamp-m01\.test\.mjs/)
  assert.match(full,/tests\/fast-stamp-m02-reader\.test\.mjs/)
  assert.match(full,/tests\/fast-stamp-m03-creation\.test\.mjs/)
})
