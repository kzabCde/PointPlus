import Image from 'next/image'
import { pointPlusStamps } from '@/lib/point-plus/assets'

/** Shared visual artwork for the new unlimited Living Stampbook only. */
export function LivingBookCover({assetId,eager=false}:{
  assetId:string|null;eager?:boolean
}){
  const art=pointPlusStamps.find(item=>item.id===assetId)
  return <span className="book-cover-art" data-theme={art?.mode}>
    <Image src={art?.png??'/point-plus/stamps/couple/heart.png'} alt=""
      width={88} height={88} loading={eager?'eager':'lazy'}/>
  </span>
}
