import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = p => existsSync(new URL('../' + p, import.meta.url))

test('M02: authentication routes, server actions and safe redirect', () => {
  for (const p of [
    'app/(auth)/login/page.tsx', 'app/(auth)/register/page.tsx',
    'app/(auth)/forgot-password/page.tsx', 'app/(auth)/auth/reset-password/page.tsx',
    'app/auth/callback/route.ts',
  ]) assert.ok(exists(p), p)
  assert.ok(read('app/auth/callback/route.ts').includes('exchangeCodeForSession'))
  assert.ok(read('features/auth/actions.ts').includes('resetPasswordForEmail'))
  assert.ok(read('features/auth/actions.ts').includes('signOut()'))
  assert.ok(read('lib/auth/redirects.ts').includes('safeNextPath'))
})

test('M03: profiles use bootstrap records, not parallel insertion', () => {
  assert.ok(read('features/profiles/data.ts').includes("from('profiles')"))
  assert.ok(read('features/profiles/data.ts').includes("from('participants')"))
  assert.ok(!read('features/profiles/actions.ts').includes('.insert('))
})

test('M04: space creation and isolation remain server-authorized', () => {
  assert.ok(read('features/spaces/actions.ts').includes("kind !== 'couple' && kind !== 'family'"))
  assert.ok(read('features/spaces/actions.ts').includes('owner_id: user.id'))
  assert.ok(read('features/spaces/data.ts').includes("eq('user_id', user.id)"))
  assert.ok(read('features/spaces/data.ts').includes("eq('space_id', id)"))
})

test('M05: invite RPCs; token in URL hash, not query', () => {
  const a = read('features/invitations/actions.ts')
  assert.ok(a.includes('pointplus_create_invite'))
  assert.ok(a.includes('pointplus_accept_invite'))
  assert.ok(a.includes('/join#token='))
  assert.ok(read('features/invitations/join-form.tsx').includes('location.hash'))
})

test('M06: child creation uses family-only RPC', () => {
  const a = read('features/participants/actions.ts')
  assert.ok(a.includes('pointplus_create_child'))
  assert.ok(a.includes("space.kind !== 'family'"))
  assert.ok(!a.includes(".from('participants').insert"))
})

test('M07: Space and participant filters on real mission tables', () => {
  const d = read('features/missions/data.ts')
  assert.ok(d.includes("from('missions')"))
  assert.ok(d.includes("eq('space_id',spaceId)"))
  assert.ok(d.includes('assigned.has(m.id)'))
  assert.ok(d.includes('getSpaceParticipants'))
  assert.ok(!read('app/(protected)/s/[spaceId]/missions/page.tsx').includes('awardPoints'))
})

test('redirect validator enforces application-only navigation at runtime', async () => {
  const ts = await import('typescript')
  const source = read('lib/auth/redirects.ts')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const { safeNextPath } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
  assert.equal(safeNextPath('https://attacker.example'), '/rooms')
  assert.equal(safeNextPath('//attacker.example'), '/rooms')
  assert.equal(safeNextPath('/\\\\attacker.example'), '/rooms')
  assert.equal(safeNextPath('/unrecognized'), '/rooms')
  assert.equal(safeNextPath('/auth/reset-password'), '/auth/reset-password')
  assert.equal(safeNextPath('/join#token=abc'), '/join#token=abc')
  assert.equal(safeNextPath('/spaces'), '/spaces')
  assert.equal(safeNextPath('/rooms'), '/rooms')
  assert.equal(safeNextPath('/dashboard'), '/dashboard')
})
