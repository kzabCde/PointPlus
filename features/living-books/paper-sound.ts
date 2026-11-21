'use client'

import {useCallback,useEffect,useRef,useState} from 'react'

export type PaperCue='page'|'write'|'stamp'|'peel'|'reward'|'undo'|'error'
const key='pointplus:living-paper-sound:v1'

/** Generated WebAudio foley (no external music or copyrighted samples).
 * Muted by default; users opt in with a real button click.
 */
export function usePaperSound(){
  const [enabled,setEnabled]=useState(false)
  const contextRef=useRef<AudioContext|null>(null)
  const enabledRef=useRef(false)
  useEffect(()=>{
    try{
      const value=window.localStorage.getItem(key)==='enabled'
      enabledRef.current=value
      setEnabled(value)
    }catch{/* preference is optional in private browsing */}
    return ()=>{
      const current=contextRef.current
      contextRef.current=null
      if(current)void current.close().catch(()=>{})
    }
  },[])

  const toggle=useCallback(()=>{
    const next=!enabledRef.current
    enabledRef.current=next
    setEnabled(next)
    try{window.localStorage.setItem(key,next?'enabled':'muted')}
    catch{/* no permanent preference if localStorage disabled */}
    if(next){
      try{
        const context=contextRef.current??new AudioContext()
        contextRef.current=context
        void context.resume().catch(()=>{})
      }catch{/* WebAudio unavailable: remain silent */}
    }else if(contextRef.current){
      void contextRef.current.suspend().catch(()=>{})
    }
  },[])

  const play=useCallback((cue:PaperCue)=>{
    if(!enabledRef.current||typeof window==='undefined'||
      document.visibilityState==='hidden')return
    try{
      const ctx=contextRef.current??new AudioContext()
      contextRef.current=ctx
      if(ctx.state==='suspended')void ctx.resume().catch(()=>{})
      if(ctx.state==='closed')return
      const now=ctx.currentTime
      const span=cue==='page'?.14:cue==='peel'?.19:
        cue==='reward'?.24:cue==='stamp'?.13:.08
      const gain=ctx.createGain()
      const peak=cue==='error'?.012:.020
      gain.gain.setValueAtTime(.00001,now)
      gain.gain.exponentialRampToValueAtTime(peak,now+.012)
      gain.gain.exponentialRampToValueAtTime(.00001,now+span)
      gain.connect(ctx.destination)

      if(cue==='page'||cue==='peel'||cue==='write'){
        // Short filtered noise for friction of paper/sticker.
        const length=Math.max(1,Math.ceil(ctx.sampleRate*span))
        const buffer=ctx.createBuffer(1,length,ctx.sampleRate)
        const samples=buffer.getChannelData(0)
        for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*
          Math.pow(1-i/length,.7)
        const noise=ctx.createBufferSource()
        noise.buffer=buffer
        const filter=ctx.createBiquadFilter()
        filter.type='bandpass'
        filter.frequency.setValueAtTime(cue==='page'?700:cue==='peel'?1250:1800,now)
        filter.Q.value=.6
        noise.connect(filter);filter.connect(gain)
        noise.start(now);noise.stop(now+span)
        noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect()}
      }else{
        const oscillator=ctx.createOscillator()
        oscillator.type=cue==='reward'?'sine':'triangle'
        oscillator.frequency.setValueAtTime(
          cue==='stamp'?160:cue==='reward'?540:cue==='error'?160:360,now)
        oscillator.frequency.exponentialRampToValueAtTime(
          cue==='stamp'?86:cue==='reward'?760:cue==='error'?120:250,now+span)
        oscillator.connect(gain)
        oscillator.start(now);oscillator.stop(now+span)
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}
      }
    }catch{/* Safari/device with blocked audio must not break editing */}
  },[])
  return {enabled,toggle,play}
}
