'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const key = (accountId:string) => 'pointplus:last-room:' + accountId

/** UX preference only. The server still authorizes every Room route via RLS. */
export function RememberRoom({ accountId, spaceId }: { accountId:string; spaceId:string }) {
  useEffect(()=>{
    try { window.localStorage.setItem(key(accountId),spaceId) } catch { /* storage disabled */ }
  },[accountId,spaceId])
  return null
}

export function ResumeRoom({ accountId, rooms }: {
  accountId: string; rooms: readonly { id:string; name:string }[]
}) {
  const [roomId,setRoomId] = useState<string | null>(null)
  useEffect(()=>{
    try {
      const saved=window.localStorage.getItem(key(accountId))
      // Never show a saved Room that isn't in the user's current authorized list.
      setRoomId(rooms.some(room=>room.id===saved) ? saved : null)
    } catch { setRoomId(null) }
  },[accountId,rooms])
  const room=rooms.find(x=>x.id===roomId)
  return room ? <Link href={'/s/' + room.id} className="button button--primary">
    กลับเข้าห้องล่าสุด: {room.name}
  </Link> : null
}
