import { cookies } from 'next/headers'
import { getClaims } from '@/lib/auth/session'
import { openingCookie } from '@/lib/auth/opening'
import { OpeningBookLoading } from '@/features/auth/opening-book-loading'

export default async function Loading() {
  if ((await cookies()).get(openingCookie)?.value === '1') {
    const { data, error } = await getClaims()
    if (!error && data?.claims?.sub) return <OpeningBookLoading/>
  }

  return <div className="card route-skeleton" role="status">
    กำลังโหลดข้อมูล…
    <span aria-hidden="true"/><span aria-hidden="true"/>
  </div>
}
