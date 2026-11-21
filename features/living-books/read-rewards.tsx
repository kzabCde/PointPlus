'use client'

import {useState} from 'react'
import dynamic from 'next/dynamic'

// The entire reward workflow (including recent history and art previews)
// is not downloaded or queried until this disclosure is opened.
const LivingRewardsOnDemand=dynamic(
  ()=>import('./rewards-on-demand').then(mod=>mod.LivingRewardsOnDemand),
  {ssr:false,loading:()=> <p role="status">กำลังเปิดประวัติรางวัล…</p>}
)

export function LivingReaderRewards({spaceId,bookId,availableStamps,pendingRewards,
  canRequest,canFulfill,isActive,card}:{
  spaceId:string;bookId:string;availableStamps:number;pendingRewards:number
  canRequest:boolean;canFulfill:boolean;isActive:boolean
  card:{target_count:number;reward_title:string}|null
}){
  const [open,setOpen]=useState(false)
  return <details className="living-reading-rewards"
    onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>แสตมป์พร้อมใช้ {availableStamps.toLocaleString('th-TH')} ดวง
      {pendingRewards>0&&' · คำขอแลกรางวัล '+pendingRewards+' รายการ'}
      <span aria-hidden="true"> ⌄</span>
    </summary>
    {open&&<div className="living-reading-rewards-content">
      <LivingRewardsOnDemand spaceId={spaceId} bookId={bookId}
        availableStamps={availableStamps} pendingRewards={pendingRewards}
        canRequest={canRequest} canFulfill={canFulfill} isActive={isActive}
        card={card??undefined}/>
    </div>}
  </details>
}
