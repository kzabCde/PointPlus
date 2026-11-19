import type { MissionFrequency, AssignmentMode, MissionStatus } from './data'

export type MissionInput = {
  title: string
  description: string | null
  frequency: MissionFrequency
  assignment_mode: AssignmentMode
  verification_mode: 'approval'
  points_reward: number
  stamps_reward: number
  stamp_card_id: string | null
  campaign_id: string | null
  max_completions: number | null
  starts_at: string | null
  ends_at: string | null
}
export type Validation<T> = { value: T; error?: never } | { value?: never; error: string }
const get = (form: FormData, key: string) => {
  const input = form.get(key)
  return typeof input === 'string' ? input.trim() : ''
}
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
const integer = (s: string, min: number, max: number): number | null => {
  if (!/^\d{1,10}$/.test(s)) return null
  const num = Number(s)
  return Number.isSafeInteger(num) && num >= min && num <= max ? num : null
}

function partsInZone(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  const read = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return [read('year'),read('month'),read('day')].join('-') + 'T' +
    [read('hour'),read('minute')].join(':')
}
function offsetAt(timestamp: number, zone: string) {
  return Date.parse(partsInZone(timestamp, zone) + ':00Z') - timestamp
}

/** Convert a Space-local wall time to UTC. Refuse nonexistent/ambiguous DST instants. */
export function localToUtc(local: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const anchor = Date.parse(local + ':00Z')
  if (!Number.isFinite(anchor) || new Date(anchor).toISOString().slice(0,16) !== local) return null
  try {
    const candidates = new Set<number>()
    for (const t of [anchor - 86400000, anchor, anchor + 86400000]) {
      const offset = offsetAt(t, zone)
      const candidate = anchor - offset
      if (partsInZone(candidate, zone) === local) candidates.add(candidate)
    }
    if (candidates.size !== 1) return null
    return new Date([...candidates][0]).toISOString()
  } catch { return null }
}
export function utcToLocal(iso: string | null, zone: string): string {
  if (!iso) return ''
  try { return partsInZone(Date.parse(iso), zone) } catch { return '' }
}
export function parseTimeWindow(form: FormData, zone: string): Validation<{
  starts_at: string | null; ends_at: string | null
}> {
  const rawStart = get(form,'starts_at')
  const rawEnd = get(form,'ends_at')
  const starts_at = rawStart ? localToUtc(rawStart, zone) : null
  const ends_at = rawEnd ? localToUtc(rawEnd, zone) : null
  if ((rawStart && !starts_at) || (rawEnd && !ends_at))
    return { error: 'วันเวลาไม่ถูกต้องหรือกำกวมตามเขตเวลาของพื้นที่ (รวมกรณีเปลี่ยนเวลา DST)' }
  if (starts_at && ends_at && Date.parse(ends_at) <= Date.parse(starts_at))
    return { error: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น' }
  return { value: { starts_at, ends_at } }
}
export function parseMissionForm(form: FormData, zone: string): Validation<MissionInput> {
  const title = get(form,'title')
  const description = get(form,'description')
  const frequency = get(form,'frequency')
  const assignment_mode = get(form,'assignment_mode')
  const points_reward = integer(get(form,'points_reward'),0,1000000)
  const stamps_reward = integer(get(form,'stamps_reward'),0,100)
  const stamp_card_id = get(form,'stamp_card_id') || null
  const campaign_id = get(form,'campaign_id') || null
  const maxString = get(form,'max_completions')
  const max_completions = maxString ? integer(maxString,1,1000000) : null
  if (title.length < 1 || title.length > 160) return { error: 'ชื่อภารกิจต้องยาว 1–160 ตัวอักษร' }
  if (description.length > 4000) return { error: 'รายละเอียดต้องไม่เกิน 4,000 ตัวอักษร' }
  if (!['once','daily','weekly','repeatable'].includes(frequency)) return { error: 'ความถี่ไม่ถูกต้อง' }
  if (!['open','assigned'].includes(assignment_mode)) return { error: 'รูปแบบการมอบหมายไม่ถูกต้อง' }
  if (points_reward === null) return { error: 'แต้มต้องเป็นจำนวนเต็มระหว่าง 0–1,000,000' }
  if (stamps_reward === null) return { error: 'แสตมป์ต้องเป็นจำนวนเต็มระหว่าง 0–100' }
  if (maxString && max_completions === null) return { error: 'จำนวนครั้งสูงสุดต้องเป็นจำนวนเต็ม 1–1,000,000' }
  if (stamps_reward > 0 && (!stamp_card_id || !uuid(stamp_card_id)))
    return { error: 'เมื่อให้แสตมป์ ต้องเลือกบัตรสะสมในพื้นที่' }
  if (stamps_reward === 0 && stamp_card_id)
    return { error: 'ห้ามเลือกบัตรสะสมเมื่อจำนวนแสตมป์เท่ากับ 0' }
  if (campaign_id && !uuid(campaign_id)) return { error: 'ชุดภารกิจไม่ถูกต้อง' }
  const schedule = parseTimeWindow(form,zone)
  if (!schedule.value) return { error: schedule.error ?? 'ช่วงเวลาไม่ถูกต้อง' }
  return { value: {
    title, description: description || null,
    frequency: frequency as MissionFrequency,
    assignment_mode: assignment_mode as AssignmentMode,
    verification_mode:'approval', points_reward, stamps_reward,
    stamp_card_id, campaign_id, max_completions, ...schedule.value,
  } }
}
export function parseCreationStatus(form: FormData): Validation<Extract<MissionStatus,'draft'|'active'>> {
  const status = get(form,'status')
  return status === 'draft' || status === 'active'
    ? { value: status } : { error: 'สถานะเริ่มต้นต้องเป็นร่างหรือเปิดใช้งาน' }
}
