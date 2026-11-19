import type { Metadata } from 'next'
import { Brand } from '@/components/brand/pointplus-mark'
import { JoinForm } from '@/features/invitations/join-form'

export const metadata: Metadata = { title: 'เข้าร่วมพื้นที่', robots: { index: false, follow: false } }
export default function JoinPage() {
  return <main id="main-content" className="auth-layout">
    <div className="auth-layout__inner"><Brand /><JoinForm /></div>
  </main>
}
