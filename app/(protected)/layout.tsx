import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand/pointplus-mark'
import { getClaims } from '@/lib/auth/session'
import { openingCookie } from '@/lib/auth/opening'
import { ClearOpeningHint } from '@/features/auth/clear-opening-hint'
import { signOutAction } from '@/features/auth/actions'
import { Navigation } from './navigation'
import { Button } from '@/components/ui/button'

const destinations = [
  { href: '/rooms', label: 'ห้องของฉัน', section: '/s', nested: true },
  { href: '/notifications', label: 'แจ้งเตือน' },
  { href: '/profile', label: 'โปรไฟล์' },
]

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const [{ data, error }, cookieStore] = await Promise.all([getClaims(), cookies()])
  if (error || !data?.claims?.sub) redirect('/login')
  const entering = cookieStore.get(openingCookie)?.value === '1'
  return <div className="app-layout" data-opening-entry={entering || undefined}>
    {entering && <ClearOpeningHint/>}
    <aside className="app-sidebar">
      <Brand href="/rooms" label="Point+ ห้องของฉัน"/>
      <Navigation label="เมนูหลัก" className="app-nav app-nav--desktop" destinations={destinations}/>
      <form action={signOutAction} className="app-sidebar__bottom">
        <Button type="submit" variant="secondary">ออกจากระบบ</Button>
      </form>
    </aside>
    <main className="app-main" id="main-content" tabIndex={-1}><div className="app-content">{children}</div></main>
    <Navigation label="เมนูหลัก" className="app-nav app-nav--mobile" destinations={destinations}/>
  </div>
}
