'use client'

import Image from 'next/image'
import { useState } from 'react'
import { StampPress } from '@/components/motion/stamp-press'
import { Button } from '@/components/ui/button'
import { HeartMascot } from './heart-mascot'
import { heartStamp } from './illustrative-stamps'

export function StampPressPreview() {
  const [pressed, setPressed] = useState(false)

  return <figure className="stamp-preview">
    <figcaption>ตัวอย่างการให้แสตมป์</figcaption>
    <div className="stamp-preview__paper" data-pressed={pressed}>
      <span className="stamp-preview__slot" aria-hidden="true">
        <StampPress pressed={pressed}>
          <Image src={heartStamp} width={104} height={104} alt=""/>
        </StampPress>
      </span>
      <div className="stamp-preview__note">
        <strong>จากคนสร้างสมุด ถึงคนสำคัญ</strong>
        <p>ขอบคุณที่ทำให้วันนี้เป็นวันที่ดี</p>
      </div>
      <span className="stamp-preview__cheer">{pressed && <HeartMascot/>}</span>
    </div>
    <Button variant="secondary" onClick={() => setPressed(value => !value)}>
      {pressed ? 'ล้างแสตมป์ตัวอย่าง' : 'ลองประทับแสตมป์'}
    </Button>
    <span className="sr-only" role="status">{pressed ? 'ประทับแสตมป์ในตัวอย่างแล้ว' : ''}</span>
  </figure>
}
