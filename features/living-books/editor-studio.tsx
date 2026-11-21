'use client'

import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react'
import {useRouter} from 'next/navigation'
import {usePaperSound} from './paper-sound'

type EditorStudioContext={
  paperUnsaved:boolean;pageUnsaved:boolean;
  setPaperUnsaved:(value:boolean)=>void;setPageUnsaved:(value:boolean)=>void;
}
const studioContext=createContext<EditorStudioContext|null>(null)

export function useLivingEditorStudio(){
  return useContext(studioContext)
}

/**
 * Parent stays mounted for the current Living Book while page query changes.
 * Sound follows a user-controlled preference; unsaved edits block page navigation.
 */
export function LivingBookStudio({children}:{children:ReactNode}){
  const [paperUnsaved,setPaperUnsaved]=useState(false)
  const [pageUnsaved,setPageUnsaved]=useState(false)
  const {enabled,toggle}=usePaperSound()
  const router=useRouter()
  useEffect(()=>{
    const block=(event:BeforeUnloadEvent)=>{
      if(paperUnsaved||pageUnsaved){event.preventDefault();event.returnValue=''}
    }
    window.addEventListener('beforeunload',block)
    // Renew private photo signed URLs before their 20-minute expiry when idle.
    const urlRefresh=window.setInterval(()=>{
      if(!paperUnsaved&&!pageUnsaved&&document.visibilityState==='visible')
        router.refresh()
    },14*60*1000)
    return ()=>{
      window.removeEventListener('beforeunload',block)
      window.clearInterval(urlRefresh)
    }
  },[paperUnsaved,pageUnsaved,router])
  const state=useMemo(()=>({
    paperUnsaved,pageUnsaved,setPaperUnsaved,setPageUnsaved,
  }),[paperUnsaved,pageUnsaved])
  return <studioContext.Provider value={state}>
    <div className="living-workspace">
      <div className="living-studio-controls">
        <span>สมุดกระดาษจริง · แตะ พลิกหน้า และจดความทรงจำ</span>
        <button type="button" className="button button--secondary"
          aria-pressed={enabled}
          onClick={toggle} aria-label={enabled?'ปิดเสียงสมุด':'เปิดเสียงสมุด'}>
          {enabled?'🔊 เสียงเปิดอยู่':'🔇 เปิดเสียงกระดาษ'}
        </button>
      </div>
      {children}
    </div>
  </studioContext.Provider>
}
