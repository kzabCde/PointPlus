import type { Metadata } from 'next'
import { getSpaceContext } from '@/features/spaces/data'
import { EditSpaceForm } from '@/features/spaces/space-form'

export const metadata: Metadata = { title: 'ตั้งค่าพื้นที่' }
export default async function SettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const { space, user } = await getSpaceContext(spaceId)
  return (
    <>
      <h2>ตั้งค่าพื้นที่</h2>
      {space.owner_id === user.id
        ? <EditSpaceForm space={space} />
        : <div className="card">คุณสามารถดูข้อมูลพื้นที่ได้ แต่เจ้าของพื้นที่เท่านั้นที่แก้ไขชื่อและเขตเวลาได้</div>}
    </>
  )
}
