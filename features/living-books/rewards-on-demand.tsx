'use client'

import {useEffect,useState} from 'react'
import {LivingRedemptionPanel} from './redemption-panel'
import {loadLivingRewardsOnDemand} from './reward-loader-action'
import type {loadLivingRedemptionData} from './redemption-data'

type RewardData=Awaited<ReturnType<typeof loadLivingRedemptionData>>

export function LivingRewardsOnDemand({spaceId,bookId,canRequest,canFulfill,isActive,
  card,availableStamps,pendingRewards}:{
  spaceId:string;bookId:string;canRequest:boolean;canFulfill:boolean;isActive:boolean
  card?:{target_count:number;reward_title:string}|null
  availableStamps:number;pendingRewards:number
}){
  const [data,setData]=useState<RewardData|null>(null)
  const [error,setError]=useState(false)
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    setData(null);setError(false)
    void loadLivingRewardsOnDemand(spaceId,bookId).then(result=>{
      if(active)setData(result)
    }).catch(()=>{
      if(active)setError(true)
    })
    return ()=>{active=false}
  },[spaceId,bookId,availableStamps,pendingRewards,retry])
  if(error)return <div className="living-reader-rewards-loading" role="alert">
    ไม่สามารถโหลดรางวัลได้
    <button className="button button--secondary" type="button"
      onClick={()=>setRetry(value=>value+1)}>ลองอีกครั้ง</button>
  </div>
  if(!data)return <p className="living-reader-rewards-loading" role="status">
    กำลังเปิดรางวัล…
  </p>
  return <LivingRedemptionPanel spaceId={spaceId} bookId={bookId}
    balance={data.balance} history={data.history} pendingCount={data.pendingCount}
    candidates={data.candidates} associations={data.associations}
    knownStamps={data.knownStamps} canRequest={canRequest}
    canFulfill={canFulfill} isActive={isActive} card={card??undefined}/>
}
