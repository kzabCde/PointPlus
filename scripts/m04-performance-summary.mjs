/**
 * M04 performance analysis (no fabricated timings).
 *
 * Input: {environment:"staging", commit:"<40 hex>", samples:[
 *   {scenario:"reader_ready", device:"desktop", ms:123.4}, ...
 * ]}
 * Do not write passwords, user IDs, email, page URLs, bearer tokens or traces.
 *
 * Run after isolated Staging measurement:
 *   node scripts/m04-performance-summary.mjs --after /tmp/m04-staging.json
 *     [--before /tmp/m04-baseline.json] [--output /tmp/m04-summary.json]
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

const allowed=new Set([
  'shelf_ready','reader_ready','card_ready','editor_ready',
  'creation_form_ready','create_book_confirmed','create_card_confirmed',
  'fast_stamp_sheet_ready','fast_stamp_confirmed','paper_save_confirmed',
])
const devices=new Set(['desktop','mobile'])
const sha=/^[0-9a-f]{40}$/i

function percentile(sorted,p){
  if(sorted.length===0)return null
  return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]
}
function median(sorted){
  if(!sorted.length)return null
  const mid=Math.floor(sorted.length/2)
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2
}
function round(n){return Number(n.toFixed(2))}

/** Returns summaries for *measured* samples only; p95 requires >= 20 samples. */
export function summarizeSamples(input){
  if(!input||input.environment!=='staging'||!sha.test(input.commit)||
    !Array.isArray(input.samples))throw Error('Need measured Staging samples and exact commit SHA')
  const buckets=new Map()
  for(const item of input.samples){
    if(!allowed.has(item.scenario)||!devices.has(item.device)||
      typeof item.ms!=='number'||!Number.isFinite(item.ms)||item.ms<0)
      throw Error('Invalid performance sample (scenario/device/ms)')
    const name=item.scenario+'/'+item.device
    if(!buckets.has(name))buckets.set(name,[])
    buckets.get(name).push(item.ms)
  }
  const measures={}
  for(const [name,times] of [...buckets].sort(([a],[b])=>a.localeCompare(b))){
    times.sort((a,b)=>a-b)
    measures[name]={
      n:times.length,median_ms:round(median(times)),
      p95_ms:times.length>=20?round(percentile(times,.95)):null,
      min_ms:round(times[0]),max_ms:round(times[times.length-1]),
    }
  }
  return {environment:'staging',commit:input.commit,
    measured_at:input.measured_at??null,
    conditions:input.conditions??null,metrics:measures}
}

/** Never infer percentage improvements across unmatched environments. */
export function compareSummaries(before,after){
  const comparable=before&&before.environment===after.environment&&
    before.conditions&&after.conditions&&
    JSON.stringify(before.conditions)===JSON.stringify(after.conditions)
  const comparison={}
  for(const [name,latest] of Object.entries(after.metrics)){
    const old=comparable?before.metrics[name]:null
    comparison[name]={...latest,baseline_median_ms:old?.median_ms??null,
      delta_pct:old?.median_ms>0?round((latest.median_ms-old.median_ms)/old.median_ms*100):null,
      baseline_p95_ms:old?.p95_ms??null}
  }
  return {...after,baseline_commit:comparable?before.commit:null,
    baseline_comparable:Boolean(comparable),metrics:comparison}
}

function readInput(path){
  const raw=JSON.parse(readFileSync(path,'utf8'))
  // Reject anything other than a small, anonymized performance fixture.
  const keys=Object.keys(raw)
  if(keys.some(k=>!['environment','commit','samples','measured_at','conditions'].includes(k)))
    throw Error('Input contains unsupported metadata; do not import raw browser traces')
  for(const item of raw.samples??[]){
    if(Object.keys(item).some(k=>!['scenario','device','ms'].includes(k)))
      throw Error('Sample has extra fields; remove URLs, users and credentials')
  }
  return summarizeSamples(raw)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2)
  const get=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined
  const path=get('--after')
  if(!path)throw Error('Supply --after <staging metrics JSON>')
  const after=readInput(path)
  const before=get('--before')?readInput(get('--before')):null
  const output=compareSummaries(before,after)
  if(get('--output'))writeFileSync(get('--output'),JSON.stringify(output,null,2)+'\n')
  process.stdout.write(JSON.stringify(output,null,2)+'\n')
}
