/** Shared deterministic placement math. Database ledger remains authoritative. */
export type StampPoint = {x:number;y:number}

export function cardStampPosition(slot:number,target:number):StampPoint|null {
  if(!Number.isSafeInteger(target)||target<1||target>100||
    !Number.isSafeInteger(slot)||slot<1||slot>target)return null
  const columns=Math.min(5,Math.ceil(Math.sqrt(target)))
  const rows=Math.ceil(target/columns)
  const index=slot-1
  return {
    x:Number(((index%columns+.5)/columns).toFixed(4)),
    y:Number(((Math.floor(index/columns)+.5)/rows).toFixed(4)),
  }
}

/** Best-effort paper placement only: never represents a collision-proof reservation. */
export function freeStampPosition(key:string,occupied:StampPoint[]):StampPoint {
  const cols=7,rows=9,count=cols*rows
  const seed=Number.parseInt(key.replaceAll('-','').slice(0,8),16)||0
  const start=seed%count
  let fallback:StampPoint={x:.5,y:.5}
  for(let offset=0;offset<count;offset++){
    const index=(start+offset)%count
    const candidate={
      x:Number((((index%cols)+.5)/cols).toFixed(4)),
      y:Number(((Math.floor(index/cols)+.5)/rows).toFixed(4)),
    }
    if(offset===0)fallback=candidate
    if(occupied.every(point=>
      (point.x-candidate.x)**2+(point.y-candidate.y)**2>.012))return candidate
  }
  return fallback
}
