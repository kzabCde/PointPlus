import Image from 'next/image'

export function HeartMascot() {
  return <span className="living-heart" aria-hidden="true">
    <Image src="/icons/icon-192x192.png" width={100} height={100} alt="" loading="eager" sizes="(max-width: 540px) 48px, (max-width: 1000px) 80px, 100px"/>
  </span>
}
