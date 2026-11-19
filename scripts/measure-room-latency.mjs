#!/usr/bin/env node
/**
 * Authenticated HTTP performance smoke/measurement script for a safe testing
 * environment. NEVER save a session cookie in git or print it in logs.
 *
 * Usage (outside production CI, with a test account only):
 * POINTPLUS_BASE_URL=https://test.example POINTPLUS_TEST_COOKIE='...' \
 * POINTPLUS_ROOM_ID=<authorized-uuid> node scripts/measure-room-latency.mjs
 */
import { performance } from 'node:perf_hooks'

const base = process.env.POINTPLUS_BASE_URL
const cookie = process.env.POINTPLUS_TEST_COOKIE
const room = process.env.POINTPLUS_ROOM_ID
const samples = Number(process.env.POINTPLUS_SAMPLES || 7)
if (!base || !cookie || !room || !/^[a-f0-9-]{36}$/i.test(room) ||
    !Number.isInteger(samples) || samples < 3 || samples > 100) {
  console.error('Missing safe test base URL, test session cookie, UUID or valid sample count (3-100)')
  process.exitCode = 1
} else {
  const root = new URL(base)
  if (root.protocol !== 'https:' && root.hostname !== 'localhost') {
    console.error('Use HTTPS (or localhost) for authenticated measurements')
    process.exitCode = 1
  } else {
    const paths = ['/rooms', `/s/${room}`, `/s/${room}/missions`, `/s/${room}/collection`]
    const percentile = (values, p) => values[Math.ceil(values.length*p)-1]
    for (const path of paths) {
      const latencies = []
      let failures = 0
      for (let i=0; i<samples; i++) {
        const start = performance.now()
        try {
          const r = await fetch(new URL(path,root),{
            method:'GET',redirect:'manual',
            headers:{cookie,accept:'text/html','cache-control':'no-cache'},
          })
          if (r.status !== 200) { failures++; continue }
          await r.arrayBuffer()
          latencies.push(Math.round(performance.now()-start))
        } catch { failures++ }
      }
      latencies.sort((a,b)=>a-b)
      const values = latencies.length ? {
        median_ms:percentile(latencies,.5),p95_ms:percentile(latencies,.95),
      } : {median_ms:null,p95_ms:null}
      console.log(JSON.stringify({path,samples,successful:latencies.length,failures,...values}))
      if (failures) process.exitCode = 1
    }
  }
}
