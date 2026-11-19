import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand/pointplus-mark'
import { createClient } from '@/utils/supabase/server'
import { signOutAction } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) redirect('/login')
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Brand />
        <nav aria-label="เมนูในแอป" className="app-nav">
          <Link href="/dashboard">ภาพรวม</Link>
          <Link href="/activities/new">สร้างกิจกรรม</Link>
          <Link href="/profile">โปรไฟล์</Link>
          <Link href="/spaces">พื้นที่ของฉัน</Link>
        </nav>
        <form action={signOutAction} className="app-sidebar__bottom">
          <Button type="submit" variant="secondary">ออกจากระบบ</Button>
        </form>
      </aside>
      <main className="app-main" id="main-content">
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}
