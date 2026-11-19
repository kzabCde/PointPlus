import Link from 'next/link'
import Image from 'next/image'

export function PointPlusMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <Image
        src="/icons/icon-192x192.png"
        width={45}
        height={45}
        alt=""
      />
    </span>
  )
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Point+ — หน้าหลัก">
      <PointPlusMark />
      <span>Point<span className="brand__plus">+</span></span>
    </Link>
  )
}
