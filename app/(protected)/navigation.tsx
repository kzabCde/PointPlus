'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Destination = { href: string; label: string; section?: string; nested?: boolean }

export function Navigation({ label, className, destinations }: {
  label: string
  className: string
  destinations: Destination[]
}) {
  const pathname = usePathname()
  return <nav aria-label={label} className={className}>
    {destinations.map(({ href, label, section = href, nested }) => {
      const current = pathname === href
      const selected = current || (nested && pathname.startsWith(section + '/'))
      return <Link key={href} href={href} aria-current={current ? 'page' : selected ? 'location' : undefined}>{label}</Link>
    })}
  </nav>
}
