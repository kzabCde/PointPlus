import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function load(path, imports = {}) {
  const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions }).outputText
  const exports = {}
  new Function('exports', 'require', output)(exports, specifier => {
    assert.ok(Object.hasOwn(imports, specifier), specifier)
    return imports[specifier]
  })
  return exports
}

const redirects = load('lib/auth/redirects.ts')
const opening = load('lib/auth/opening.ts')
const redirectSignal = new Error('redirected')

async function signIn({ next = '/rooms', hint = '1', name = 'มะลิ', denied = false } = {}) {
  const result = { cookie: null, redirect: null, profileReads: 0 }
  const client = {
    auth: {
      signInWithPassword: async () => ({ error: denied ? { message: 'Invalid credentials' } : null }),
      getUser: async () => ({ data: { user: { id: 'caller' } } }),
    },
    from(table) {
      assert.equal(table, 'profiles')
      result.profileReads++
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: name } }) }) }) }
    },
  }
  const { signInAction } = load('features/auth/actions.ts', {
    'next/headers': { cookies: async () => ({ set: (...args) => { result.cookie = args } }) },
    'next/navigation': {
      RedirectType: { replace: 'replace' },
      redirect: (path, kind) => { result.redirect = [path, kind]; throw redirectSignal },
    },
    '@/utils/supabase/server': { createClient: async () => client },
    '@/lib/auth/redirects': redirects,
    '@/lib/auth/opening': opening,
  })
  const data = new FormData()
  for (const [key, value] of Object.entries({ email: 'fixture@example.test', password: 'opaque fixture password', next, opening: hint })) {
    data.set(key, value)
  }
  try {
    result.state = await signInAction({ status: 'idle', message: '' }, data)
  } catch (error) {
    if (error !== redirectSignal) throw error
  }
  return result
}

test('credential failure cannot set the opening hint or redirect', async () => {
  const result = await signIn({ denied: true })
  assert.equal(result.state.status, 'error')
  assert.equal(result.cookie, null)
  assert.equal(result.redirect, null)
  assert.equal(result.profileReads, 0)
})

test('authorized login can add a bounded visual hint and still uses the existing onboarding decision', async () => {
  const result = await signIn({ name: 'Member' })
  assert.deepEqual(result.redirect, ['/onboarding', 'replace'])
  assert.deepEqual(result.cookie, [opening.openingCookie, '1', {
    maxAge: 45, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  }])
  assert.equal(result.profileReads, 1)
  const progressive = await signIn({ hint: '' })
  assert.deepEqual(progressive.redirect, ['/rooms', 'replace'])
  assert.equal(progressive.cookie, null)
})

test('the visual hint preserves approved deep links and leaves invitations and recovery outside the opening scene', async () => {
  const deepLink = '/s/44444444-4444-4444-8444-444444444444/settings?tab=cover#details'
  const result = await signIn({ next: deepLink, name: 'Member' })
  assert.deepEqual(result.redirect, [deepLink, 'replace'])
  assert.equal(result.profileReads, 0)
  for (const next of ['/join#token=local-fixture-value', '/auth/reset-password']) {
    const direct = await signIn({ next })
    assert.deepEqual(direct.redirect, [next, 'replace'])
    assert.equal(direct.cookie, null)
  }
  const unsafe = await signIn({ next: 'https://example.invalid/' })
  assert.deepEqual(unsafe.redirect, ['/rooms', 'replace'])
})

test('email callbacks stay on the browser origin and keep safe recovery destinations', async () => {
  const { GET } = load('app/auth/callback/route.ts', {
    'next/server': { NextResponse: Response },
    '@/utils/supabase/server': {
      createClient: async () => ({
        auth: {
          verifyOtp: async () => ({ error: null }),
          getUser: async () => ({ data: { user: null } }),
        },
      }),
    },
    '@/lib/auth/redirects': redirects,
  })
  for (const [next, expected] of [
    ['/auth/reset-password', '/auth/reset-password'],
    ['/s/44444444-4444-4444-8444-444444444444/settings?tab=cover', '/s/44444444-4444-4444-8444-444444444444/settings?tab=cover'],
    ['//example.invalid', '/dashboard'],
    ['/rooms/..//example.invalid', '/rooms'],
  ]) {
    const request = new Request('http://next-internal.invalid/auth/callback?token_hash=fixture&type=recovery&next=' + encodeURIComponent(next))
    const response = await GET(request)
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), expected)
  }
})
