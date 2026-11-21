import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('register collects display name alongside email and password',()=>{
 const form=read('features/auth/auth-form.tsx')
 const actions=read('features/auth/actions.ts')
 assert.match(form,/name="display_name"/)
 assert.match(actions,/data: \{ display_name: displayName \}/)
 assert.match(actions,/callback\?next=\/rooms/)
})

test('timezone is not an editable field or a required value in the onboarding flow',()=>{
 for(const path of ['features/profiles/profile-form.tsx','features/spaces/space-form.tsx']){
  const source=read(path)
  assert.doesNotMatch(source,/name="timezone"/)
  assert.doesNotMatch(source,/เขตเวลา/)
 }
 for(const path of ['features/profiles/actions.ts','features/spaces/actions.ts']){
  const source=read(path)
  assert.doesNotMatch(source,/field\(form, 'timezone'\)/)
  assert.doesNotMatch(source,/allowedTimezone/)
 }
 assert.match(read('features/spaces/actions.ts'),/\.insert\(\{ id: spaceId, kind, name, owner_id: user\.id \}\)/)
})

test('room creation opens room home and Living Book needs only title, recipient, and cover',()=>{
 const rooms=read('features/spaces/space-form.tsx')
 assert.match(rooms,/router\.push\('\/s\/' \+ state\.spaceId\)/)
 const form=read('features/living-books/forms.tsx')
 assert.match(form,/export function CreateLivingBookForm/)
 assert.match(form,/name="recipient_id"/)
 assert.match(form,/name="approval_policy" value="direct"/)
 assert.match(form,/name="cover_asset_id"/)
 assert.match(form,/name="idempotency_key"/)
 assert.doesNotMatch(form,/name="target_count"|cardOnly|CreateCoupleStampBookForm|CreateStampBookForm/)
 const page=read('app/(protected)/s/[spaceId]/stamp-books/new/page.tsx')
 assert.match(page,/space\.kind!=='couple'/)
 assert.match(page,/CreateLivingBookForm/)
})

test('timezone is not selected or modeled by the active Room/Profile data loaders',()=>{
 for(const p of ['features/spaces/data.ts','features/profiles/data.ts']){
  const src=read(p)
  assert.doesNotMatch(src,/timezone/)
 }
 assert.doesNotMatch(read('lib/auth/validation.ts'),/allowedTimezone/)
})
