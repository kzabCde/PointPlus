import type { SpaceKind, SpaceRole } from '@/features/spaces/data'

export const roomKindLabels: Record<SpaceKind, string> = {
  personal: 'ส่วนตัว',
  couple: 'คู่รัก',
  family: 'ครอบครัว',
  group: 'เพื่อนและกลุ่ม',
}

export const roomRoleLabels: Record<SpaceRole, string> = {
  owner: 'เจ้าของห้อง',
  admin: 'ผู้ดูแล',
  member: 'สมาชิก',
}

export const roomArt: Record<SpaceKind, string> = {
  personal: '/point-plus/stamps/personal/sunrise.png',
  couple: '/point-plus/stamps/couple/heart.png',
  family: '/point-plus/stamps/family/bear.png',
  group: '/point-plus/stamps/family/star.png',
}
