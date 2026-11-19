import type { ReactNode } from 'react'
import { Brand } from '@/components/brand/pointplus-mark'

/**
 * M01 layout only. M02 will add sign-in, registration and recovery routes.
 * Do not add placeholder login forms or pretend authentication actions work.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="auth-layout">
      <div className="auth-layout__inner">
        <Brand />
        <div className="card">{children}</div>
      </div>
    </main>
  )
}
