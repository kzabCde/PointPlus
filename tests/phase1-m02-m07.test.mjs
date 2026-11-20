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

test('invitation and auth site origin uses the configured public domain, not a deployment hostname', async () => {
  const ts = await import('typescript')
  const js = ts.transpileModule(read('lib/auth/redirects.ts'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const { siteOrigin } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
  const keys = ['NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_SITE_URL','VERCEL_PROJECT_PRODUCTION_URL','VERCEL_URL','NODE_ENV']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pointpluss.vercel.app/'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://old.example.com/'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'pointpluss.vercel.app'
    process.env.VERCEL_URL = 'pointplus-deployment-id.vercel.app'
    assert.equal(siteOrigin(), 'https://pointpluss.vercel.app')

    delete process.env.NEXT_PUBLIC_APP_URL
    assert.equal(siteOrigin(), 'https://old.example.com')

    delete process.env.NEXT_PUBLIC_SITE_URL
    assert.equal(siteOrigin(), 'https://pointpluss.vercel.app')

    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    assert.equal(siteOrigin(), 'https://pointplus-deployment-id.vercel.app')

    delete process.env.VERCEL_URL
    process.env.NODE_ENV = 'development'
    assert.equal(siteOrigin(), 'http://localhost:3000')
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})

test('createInviteAction returns a one-time token only in a canonical /join URL fragment', async () => {
  const ts = await import('typescript')
  const file = 'features/invitations/actions.ts'
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  })
  const token = 'a'.repeat(64)
  const roomId = '11111111-1111-4111-8111-111111111111'
  const seen = []
  const stubs = {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { requireUser() { throw Error('Unexpected authentication lookup') } },
    '@/lib/auth/validation': {
      field: (form,key) => String(form.get(key) ?? '').trim(),
      isUuid: input => input === roomId,
    },
    '@/lib/auth/redirects': { siteOrigin: () => 'https://pointpluss.vercel.app' },
    '@/features/spaces/data': {
      canManage: role => role === 'owner' || role === 'admin',
      getSpaceContext: async () => ({
        space: {kind: 'couple'}, member: {role: 'owner'},
        supabase: {rpc: async (name,args) => {
          seen.push({name,args})
          return {data: token,error: null}
        }},
      }),
    },
  }
  const mod = {exports: {}}
  new Function('require','module','exports',compiled.outputText)(
    id => {if (!(id in stubs)) throw Error('Unexpected import: '+id);return stubs[id]},
    mod,mod.exports,
  )
  const form = new FormData()
  form.set('space_id',roomId)
  form.set('role','member')
  form.set('days','7')
  const result = await mod.exports.createInviteAction({status:'idle',message:''},form)
  assert.equal(result.status,'success')
  assert.equal(result.link,'https://pointpluss.vercel.app/join#token='+token)
  assert.deepEqual(seen,[{name:'pointplus_create_invite',args:{
    p_space:roomId,p_role:'member',p_days:7,
  }}])
})
