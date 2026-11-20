'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type SoundName = 'stamp' | 'page' | 'complete' | 'reward'
type BookSound = {
  enabled: boolean
  volume: number
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  unlock: () => void
  play: (name: SoundName) => void
}

const storageKey = 'pointplus:stampbook-sound:v1'
const Context = createContext<BookSound | null>(null)
const clampVolume = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .35

/** No audio assets, permissions, network traffic, or auto-playing sounds. */
export function BookSoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true)
  const [volume, setVolume] = useState(.35)
  const contextRef = useRef<AudioContext | null>(null)
  const preferences = useRef({ enabled: true, volume: .35 })
  preferences.current = { enabled, volume }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          const preferences = parsed as Record<string, unknown>
          if (typeof preferences.enabled === 'boolean') setEnabled(preferences.enabled)
          if (typeof preferences.volume === 'number') setVolume(clampVolume(preferences.volume))
        }
      }
    } catch { /* Disabled storage should not prevent stamping. */ }
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify({ enabled, volume })) }
    catch { /* Preferences are optional. */ }
  }, [enabled, volume])

  useEffect(() => () => { void contextRef.current?.close(); contextRef.current = null }, [])

  const unlock = useCallback(() => {
    if (!preferences.current.enabled || preferences.current.volume <= 0) return
    try {
      contextRef.current ??= new AudioContext()
      if (contextRef.current.state === 'suspended') void contextRef.current.resume().catch(() => {})
    } catch { /* Unsupported browser/audio policy -> silent fallback. */ }
  }, [])

  const play = useCallback((name: SoundName) => {
    if (!preferences.current.enabled || preferences.current.volume <= 0) return
    const ctx = contextRef.current
    if (!ctx || ctx.state !== 'running') return
    try {
      const start = ctx.currentTime
      const gainScale = preferences.current.volume * .16
      const tone = (freq: number, at: number, duration: number, strength: number, wave: OscillatorType = 'sine') => {
        const oscillator = ctx.createOscillator()
        const envelope = ctx.createGain()
        oscillator.type = wave
        oscillator.frequency.setValueAtTime(freq, at)
        envelope.gain.setValueAtTime(.0001, at)
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, gainScale * strength), at + .008)
        envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
        oscillator.connect(envelope).connect(ctx.destination)
        oscillator.start(at)
        oscillator.stop(at + duration + .008)
      }
      const paperNoise = (at: number, duration: number, strength: number) => {
        const frames = Math.max(1, Math.round(ctx.sampleRate * duration))
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
        const channel = buffer.getChannelData(0)
        for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1
        const source = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        const envelope = ctx.createGain()
        filter.type = 'lowpass'
        filter.frequency.value = name === 'page' ? 1800 : 760
        envelope.gain.setValueAtTime(Math.max(.0002, gainScale * strength), at)
        envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
        source.buffer = buffer
        source.connect(filter).connect(envelope).connect(ctx.destination)
        source.start(at)
        source.stop(at + duration)
      }
      switch (name) {
        case 'stamp':
          paperNoise(start, .085, .9)
          tone(126, start, .11, .85, 'triangle')
          tone(86, start + .025, .12, .35)
          break
        case 'page':
          paperNoise(start, .21, .34)
          tone(195, start + .05, .15, .12, 'triangle')
          break
        case 'complete':
          tone(523.25, start, .18, .32)
          tone(659.25, start + .1, .22, .28)
          tone(783.99, start + .22, .32, .25)
          break
        case 'reward':
          tone(392, start, .15, .24)
          tone(523.25, start + .12, .26, .35)
          break
      }
    } catch { /* Never fail the user's stamp action for audio. */ }
  }, [])

  return <Context.Provider value={{ enabled, volume, setEnabled, setVolume, unlock, play }}>
    {children}
  </Context.Provider>
}

export function useBookSound() { return useContext(Context) }

export function BookSoundControls() {
  const sound = useBookSound()
  if (!sound) return null
  return <div className="book-sound-controls" role="group" aria-label="เสียงสมุดสะสม">
    <button type="button" className="button button--secondary book-sound-toggle"
      aria-pressed={sound.enabled} onClick={() => { sound.setEnabled(!sound.enabled); if (!sound.enabled) sound.unlock() }}>
      {sound.enabled ? '🔊 เสียงเปิด' : '🔇 ปิดเสียง'}
    </button>
    {sound.enabled && <label className="book-sound-volume">ระดับเสียง
      <input type="range" min="0" max="100" step="5" aria-label="ระดับเสียงเอฟเฟกต์"
        value={Math.round(sound.volume * 100)}
        onChange={event => { sound.setVolume(clampVolume(Number(event.target.value) / 100)); sound.unlock() }}/>
      <span>{Math.round(sound.volume * 100)}%</span>
    </label>}
  </div>
}
