import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand/pointplus-mark'
import { createClient } from '@/utils/supabase/server'

/**
 * Page access is enforced on the server, not only by hiding navigation.
 * M02 will add auth screens and a meaningful unauthenticated redirect.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) redirect('/')

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Brand />
        <nav aria-label="การนำทางภายในแอป" className="app-nav">
          <a aria-current="page" href="/dashboard">ภาพรวม</a>
          <a href="/">หน้าแรก</a>
        </nav>
        <span className="app-sidebar__bottom">พื้นที่ส่วนตัวสำหรับเรื่องสำคัญของคุณ</span>
      </aside>
      <main className="app-main" id="main-content">
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}
