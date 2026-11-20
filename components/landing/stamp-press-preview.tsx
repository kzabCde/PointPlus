'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { heartStamp } from './illustrative-stamps'

export function StampPressPreview() {
  const [pressed, setPressed] = useState(false)

  return <figure className="stamp-preview">
    <figcaption>ตัวอย่างการให้แสตมป์</figcaption>
    <div className="stamp-preview__paper">
      <span className="stamp-preview__slot" aria-hidden="true">
        {pressed && <Image src={heartStamp} width={104} height={104} alt=""/>}
      </span>
      <div className="stamp-preview__note">
        <strong>จากนที ถึงเตย</strong>
        <p>ขอบคุณที่ทำให้วันนี้เป็นวันที่ดี</p>
      </div>
    </div>
    <Button variant="secondary" onClick={() => setPressed(value => !value)}>
      {pressed ? 'ล้างแสตมป์ตัวอย่าง' : 'ลองประทับแสตมป์'}
    </Button>
    <span className="sr-only" role="status">{pressed ? 'ประทับแสตมป์ในตัวอย่างแล้ว' : ''}</span>
  </figure>
}
