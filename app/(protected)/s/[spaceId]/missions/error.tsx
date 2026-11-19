'use client'
import { Button } from '@/components/ui/button'
export default function MissionsError({ reset }: { error: Error; reset: () => void }) {
  return <div className="card" role="alert"><h2>ไม่สามารถโหลดภารกิจได้</h2>
    <p>กรุณาลองอีกครั้งหรือตรวจสอบการเชื่อมต่อ Supabase</p><Button onClick={reset}>ลองอีกครั้ง</Button></div>
}
