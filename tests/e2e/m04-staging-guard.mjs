/**
 * Validate isolated Staging configuration BEFORE any browser login or DB write.
 * This check is reused by the M04 guarded browser harness and contract tests.
 */
const forbiddenSupabase=new Set(['gczribbtkfvhpzzupqre.supabase.co'])
const forbiddenHosts=new Set([
  'pointpluss.vercel.app','pointplus-nowheredev.vercel.app',
  'pointplus-git-main-nowheredev.vercel.app',
  'pointplus-gpq1retfc-nowheredev.vercel.app',
  'pointplus-5lfs8rt8n-nowheredev.vercel.app',
  'pointplus-l8hsuz1le-nowheredev.vercel.app',
])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateM04Staging(env){
  const required=[
    'POINTPLUS_E2E_STAGING_ONLY','POINTPLUS_E2E_PREVIEW_VERIFIED',
    'POINTPLUS_E2E_STAGING_APP_URL','POINTPLUS_E2E_SUPABASE_URL',
    'POINTPLUS_E2E_PUBLISHABLE_KEY',
    'POINTPLUS_E2E_A_EMAIL','POINTPLUS_E2E_A_PASSWORD',
    'POINTPLUS_E2E_B_EMAIL','POINTPLUS_E2E_B_PASSWORD',
    'POINTPLUS_E2E_ROOM_ID','POINTPLUS_PLAYWRIGHT_CORE',
    'POINTPLUS_E2E_VERIFIED_COMMIT_SHA',
  ]
  const missing=required.filter(key=>!env[key])
  if(missing.length)throw Error('M04 isolated Staging prerequisites missing: '+missing.join(', '))
  if(env.POINTPLUS_E2E_STAGING_ONLY!=='1'||env.POINTPLUS_E2E_PREVIEW_VERIFIED!=='1')
    throw Error('M04 requires explicit isolated Staging and preview verification')
  const app=new URL(env.POINTPLUS_E2E_STAGING_APP_URL)
  const supabase=new URL(env.POINTPLUS_E2E_SUPABASE_URL)
  if(app.protocol!=='https:'||supabase.protocol!=='https:'||
    app.pathname!=='/'||supabase.pathname!=='/'||
    app.username||app.password||supabase.username||supabase.password)
    throw Error('M04 needs clean HTTPS origins (no credentials or paths)')
  if(!/^[a-z0-9-]+\.supabase\.co$/.test(supabase.hostname)||
    forbiddenSupabase.has(supabase.hostname))
    throw Error('Production/non-Supabase database is forbidden')
  if(forbiddenHosts.has(app.hostname)||app.hostname.startsWith('pointplus-git-main-')||
    app.hostname==='localhost'||app.hostname==='127.0.0.1')
    throw Error('Production or local app host is forbidden')
  if(!uuid.test(env.POINTPLUS_E2E_ROOM_ID))throw Error('Invalid isolated Room ID')
  if(!/^[0-9a-f]{40}$/i.test(env.POINTPLUS_E2E_VERIFIED_COMMIT_SHA))
    throw Error('Verified exact Staging commit SHA must be supplied')
  if(env.POINTPLUS_E2E_A_EMAIL===env.POINTPLUS_E2E_B_EMAIL)
    throw Error('M04 requires two distinct accounts')
  return {appOrigin:app.origin,supabaseOrigin:supabase.origin,
    room:env.POINTPLUS_E2E_ROOM_ID,
    expectedCommit:env.POINTPLUS_E2E_VERIFIED_COMMIT_SHA}
}
