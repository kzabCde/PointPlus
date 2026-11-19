import Link from 'next/link'

export function PointPlusMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="20" fill="#E6F3E9" />
        <path d="M32 48C13 37 13 25 19 20c5-5 11-3 13 2 3-5 9-7 14-2 7 6 5 17-14 28Z" fill="#E77564" />
        <path d="M32 31v12M26 37h12" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="PointPlus — หน้าหลัก">
      <PointPlusMark />
      <span>Point<span className="brand__plus">+</span></span>
    </Link>
  )
}
