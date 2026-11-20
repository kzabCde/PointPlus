import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary'

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={'button button--' + variant + ' ' + className} {...props} />
}

export function ButtonLink({
  href,
  variant = 'primary',
  children,
  prefetch,
}: { href: string; variant?: Variant; children: ReactNode; prefetch?: boolean }) {
  return <Link href={href} prefetch={prefetch} className={'button button--' + variant}>{children}</Link>
}
