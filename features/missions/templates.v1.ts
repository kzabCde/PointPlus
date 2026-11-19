import type { PointPlusMode } from '@/lib/point-plus/assets'
import type { MissionFrequency } from './data'
export type MissionTemplate = Readonly<{
  version: 1
  mode: PointPlusMode
  stampAssetId: string
  title: string
  description: string
  frequency: MissionFrequency
}>
/** Curated copy only, never progress or earned-state data. Each entry maps
 *  to a database stamp_card.image_key after the official v1 catalog migration. */
export const officialMissionTemplatesV1: readonly MissionTemplate[] = [
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-heart",
    "title": "บอกสิ่งดี ๆ ที่ชอบเกี่ยวกับกันและกัน",
    "description": "แสดงความใส่ใจด้วยคำพูดหรือการกระทำเล็ก ๆ ที่อีกฝ่ายรับรู้ได้",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-letter",
    "title": "เขียนข้อความให้กำลังใจกัน",
    "description": "เขียนข้อความที่ตั้งใจส่งกำลังใจให้อีกฝ่ายอย่างน้อยหนึ่งประโยค",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-cheers",
    "title": "ใช้เวลาคุณภาพร่วมกัน 30 นาที",
    "description": "วางมือถือและทำกิจกรรมหรือพูดคุยกันอย่างตั้งใจ 30 นาที",
    "frequency": "weekly"
  },
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-flowers",
    "title": "สร้างเซอร์ไพรส์เล็ก ๆ",
    "description": "ทำสิ่งน่ารักโดยไม่คาดหวังของตอบแทน เช่น โน้ตหรือของทำมือ",
    "frequency": "once"
  },
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-cake",
    "title": "ฉลองวันสำคัญร่วมกัน",
    "description": "ร่วมกันทำกิจกรรมเพื่อฉลองวันหรือเหตุการณ์ที่มีความหมาย",
    "frequency": "once"
  },
  {
    "version": 1,
    "mode": "couple",
    "stampAssetId": "couple-lock",
    "title": "รักษาคำมั่นที่ให้กัน",
    "description": "ทำสิ่งที่ตกลงหรือสัญญากันไว้ด้วยความรับผิดชอบ",
    "frequency": "weekly"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-star",
    "title": "ทำภารกิจเล็ก ๆ ให้สำเร็จ",
    "description": "ตั้งเป้าหมายที่เหมาะกับวัยและทำให้สำเร็จโดยได้รับกำลังใจจากครอบครัว",
    "frequency": "once"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-books",
    "title": "อ่านหนังสืออย่างน้อย 15 นาที",
    "description": "อ่านหนังสือด้วยตัวเองหรืออ่านร่วมกับผู้ดูแลตามความเหมาะสม",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-home",
    "title": "ช่วยงานบ้านที่เหมาะกับวัย",
    "description": "ร่วมกันดูแลพื้นที่ใช้สอยหรือช่วยงานบ้านอย่างปลอดภัย",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-paint",
    "title": "สร้างงานศิลปะหนึ่งชิ้น",
    "description": "วาดภาพ ระบายสี หรือประดิษฐ์สิ่งของด้วยความคิดสร้างสรรค์",
    "frequency": "weekly"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-sprout",
    "title": "เรียนรู้สิ่งใหม่ร่วมกัน",
    "description": "ค้นคว้าหรือฝึกทักษะใหม่ที่เหมาะสมกับวัยร่วมกัน",
    "frequency": "weekly"
  },
  {
    "version": 1,
    "mode": "family",
    "stampAssetId": "family-bear",
    "title": "ทำความดีและแบ่งปัน",
    "description": "แสดงน้ำใจและช่วยเหลือผู้อื่นโดยสมัครใจ",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-sunrise",
    "title": "เริ่มวันด้วยกิจวัตรที่ตั้งใจ",
    "description": "ทำกิจวัตรตอนเช้าที่ตั้งไว้ให้สำเร็จ",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-dumbbell",
    "title": "เคลื่อนไหวร่างกาย 20 นาที",
    "description": "ออกกำลังกายหรือขยับร่างกายตามความเหมาะสมของตนเอง",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-open-book",
    "title": "เรียนรู้เรื่องใหม่ 20 นาที",
    "description": "อ่านบทความ หนังสือ หรือทบทวนความรู้ใหม่อย่างตั้งใจ",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-target",
    "title": "ลงมือทำตามเป้าหมายหนึ่งข้อ",
    "description": "กำหนดงานเล็ก ๆ ที่สำคัญและทำให้สำเร็จภายในวัน",
    "frequency": "daily"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-mountain",
    "title": "ก้าวข้ามความท้าทายหนึ่งอย่าง",
    "description": "ลองทักษะหรืองานที่ท้าทายโดยคำนึงถึงความปลอดภัย",
    "frequency": "weekly"
  },
  {
    "version": 1,
    "mode": "personal",
    "stampAssetId": "personal-trophy",
    "title": "บันทึกความก้าวหน้าของตนเอง",
    "description": "สะท้อนผลและบันทึกสถิติหรือความสำเร็จของตนเอง",
    "frequency": "once"
  }
] as const
