import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

const memberId = '11111111-1111-4111-8111-111111111111'
const newId = '22222222-2222-4222-8222-222222222222'
const registeredId = '33333333-3333-4333-8333-333333333333'
export const roomId = '44444444-4444-4444-8444-444444444444'
export const invite = 'ab'.repeat(32)
export const password = 'fixture-password'
export const member = 'member@example.test'
export const newcomer = 'newcomer@example.test'
export const registered = 'registered@example.test'

const now = '2025-06-01T10:00:00.000Z'
const jwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const user = (id, email, displayName) => ({
  id, email, aud: 'authenticated', role: 'authenticated', created_at: now,
  app_metadata: {}, user_metadata: { display_name: displayName },
})

export async function startAuthFixture(port = 0) {
  const accounts = new Map([
    [member, user(memberId, member, 'มะลิ')],
    [newcomer, user(newId, newcomer, 'Member')],
  ])
  const profiles = new Map([
    [memberId, { id: memberId, display_name: 'มะลิ', timezone: 'Asia/Bangkok', locale: 'th', avatar_path: null }],
    [newId, { id: newId, display_name: 'Member', timezone: 'Asia/Bangkok', locale: 'th', avatar_path: null }],
  ])
  const room = { id: roomId, kind: 'couple', owner_id: memberId, name: 'สมุดของมะลิ', timezone: 'Asia/Bangkok', created_at: now }
  const usersByToken = new Map()
  const barriers = new Map()
  const observed = { password: 0, signup: [], recovery: [], verified: [], accepted: 0 }
  let invited = false

  function issueSession(identity, { expired = false } = {}) {
    const expiry = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600)
    const token = jwtPart({ alg: 'HS256', typ: 'JWT' }) + '.' +
      jwtPart({ aud: 'authenticated', sub: identity.id, exp: expiry, role: 'authenticated' })
    const access_token = token + '.' + createHmac('sha256', 'local-fixture-only').update(token).digest('base64url')
    if (!expired) usersByToken.set(access_token, identity)
    return { access_token, token_type: 'bearer', expires_in: expired ? 0 : 3600,
      expires_at: expiry, refresh_token: 'fixture-expired-refresh', user: identity }
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1')
      const { pathname, searchParams } = url
      const { method } = request
      const caller = usersByToken.get(request.headers.authorization?.replace(/^Bearer /, ''))
      const json = (body, status = 200) => {
        response.writeHead(status, { 'content-type': 'application/json' })
        response.end(JSON.stringify(body))
      }
      const ok = () => { response.writeHead(204); response.end() }
      const read = async () => {
        let body = ''
        for await (const chunk of request) body += chunk
        return JSON.parse(body || '{}')
      }

      if (pathname === '/auth/v1/token' && method === 'POST') {
        if (searchParams.get('grant_type') !== 'password') return json({ code: 'refresh_token_not_found', msg: 'Fixture session expired' }, 400)
        observed.password++
        const credentials = await read()
        await barriers.get('password')
        const identity = accounts.get(credentials.email)
        if (!identity || credentials.password !== password) return json({ code: 'invalid_credentials', msg: 'Invalid credentials' }, 400)
        return json(issueSession(identity))
      }
      if (pathname === '/auth/v1/user' && caller) return json(caller)
      if (pathname === '/auth/v1/logout' && caller) {
        usersByToken.delete(request.headers.authorization.replace(/^Bearer /, ''))
        return ok()
      }
      if (pathname === '/auth/v1/signup') {
        const { email, data } = await read()
        if (email !== registered) return json({ msg: 'Unsupported fixture account' }, 400)
        const identity = user(registeredId, email, data.display_name)
        accounts.set(email, identity)
        profiles.set(registeredId, { id: registeredId, display_name: 'Member', locale: 'th', timezone: 'Asia/Bangkok' })
        observed.signup.push({ email, name: data.display_name, redirect: searchParams.get('redirect_to') })
        return json(identity)
      }
      if (pathname === '/auth/v1/recover') {
        observed.recovery.push({ email: (await read()).email, redirect: searchParams.get('redirect_to') })
        return json({})
      }
      if (pathname === '/auth/v1/verify') {
        const { type, token_hash } = await read()
        if (type === 'signup' && token_hash === 'confirmed-fixture') {
          observed.verified.push(type)
          return json(issueSession(accounts.get(registered)))
        }
        if (type === 'recovery' && token_hash === 'recovery-fixture') {
          observed.verified.push(type)
          return json(issueSession(accounts.get(member)))
        }
        return json({ code: 'otp_expired', msg: 'Expired confirmation' }, 403)
      }
      if (!caller) return json({ code: 'bad_jwt', msg: 'Fixture authentication required' }, 401)

      if (pathname === '/rest/v1/rpc/pointplus_accept_invite') {
        const { p_token } = await read()
        if (p_token !== invite || invited) return json({ message: 'Invite unavailable' }, 400)
        invited = true
        observed.accepted++
        return json(roomId)
      }

      const table = pathname.split('/').at(-1)
      const membership = { space_id: roomId, user_id: caller.id, role: caller.id === memberId ? 'owner' : 'member', joined_at: now }
      let rows
      if (table === 'profiles') {
        rows = [profiles.get(caller.id)]
      } else if (table === 'space_members') {
        await barriers.get('memberships')
        rows = caller.id === memberId || invited ? [membership] : []
      } else if (table === 'spaces') {
        rows = [room]
      } else {
        return json({ message: 'Unsupported fixture request' }, 404)
      }
      for (const [field, filter] of searchParams) {
        if (filter.startsWith('eq.')) rows = rows.filter(row => String(row[field]) === filter.slice(3))
        if (filter.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[field]))
        if (filter.startsWith('neq.')) rows = rows.filter(row => String(row[field]) !== filter.slice(4))
      }
      if (method === 'PATCH') {
        const change = await read()
        for (const row of rows) Object.assign(row, change)
        return ok()
      }
      return json(request.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows)
    } catch {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    }
  })

  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  return {
    observed,
    origin: 'http://127.0.0.1:' + server.address().port,
    hold(name) {
      let release
      barriers.set(name, new Promise(resolve => { release = resolve }))
      return () => { barriers.delete(name); release() }
    },
    expiredCookie(origin) {
      const encoded = jwtPart(issueSession(accounts.get(member), { expired: true }))
      return { name: 'sb-127-auth-token', value: 'base64-' + encoded, url: origin }
    },
    async close() {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    },
  }
}
