export type PointPlusMode = 'couple' | 'family' | 'personal';
export type BadgeRarity = 'bronze' | 'silver' | 'gold' | 'diamond';
export type StampDefinition = Readonly<{
  id: string;
  mode: PointPlusMode;
  name: string;
  nameTh: string;
  svg: string;
  png: string;
}>;
export type BadgeDefinition = StampDefinition & Readonly<{ rarity: BadgeRarity }>;

/** URLs assume the point-plus directory is copied into Next.js public/. */
export const pointPlusStamps: StampDefinition[] = [
  {
    "id": "couple-heart",
    "mode": "couple",
    "name": "Sweet Heart",
    "nameTh": "หัวใจแทนความใส่ใจ",
    "svg": "/point-plus/stamps/couple/heart.svg",
    "png": "/point-plus/stamps/couple/heart.png"
  },
  {
    "id": "couple-letter",
    "mode": "couple",
    "name": "Love Letter",
    "nameTh": "ส่งข้อความดี ๆ ให้กัน",
    "svg": "/point-plus/stamps/couple/letter.svg",
    "png": "/point-plus/stamps/couple/letter.png"
  },
  {
    "id": "couple-cheers",
    "mode": "couple",
    "name": "Together Time",
    "nameTh": "ใช้เวลาคุณภาพด้วยกัน",
    "svg": "/point-plus/stamps/couple/cheers.svg",
    "png": "/point-plus/stamps/couple/cheers.png"
  },
  {
    "id": "couple-flowers",
    "mode": "couple",
    "name": "Little Surprise",
    "nameTh": "สร้างเซอร์ไพรส์เล็ก ๆ",
    "svg": "/point-plus/stamps/couple/flowers.svg",
    "png": "/point-plus/stamps/couple/flowers.png"
  },
  {
    "id": "couple-cake",
    "mode": "couple",
    "name": "Special Day",
    "nameTh": "ฉลองโอกาสพิเศษ",
    "svg": "/point-plus/stamps/couple/cake.svg",
    "png": "/point-plus/stamps/couple/cake.png"
  },
  {
    "id": "couple-lock",
    "mode": "couple",
    "name": "Trust & Care",
    "nameTh": "ดูแลและรักษาคำมั่นสัญญา",
    "svg": "/point-plus/stamps/couple/lock.svg",
    "png": "/point-plus/stamps/couple/lock.png"
  },
  {
    "id": "family-star",
    "mode": "family",
    "name": "Little Star",
    "nameTh": "ทำภารกิจได้สำเร็จ",
    "svg": "/point-plus/stamps/family/star.svg",
    "png": "/point-plus/stamps/family/star.png"
  },
  {
    "id": "family-books",
    "mode": "family",
    "name": "Reading Time",
    "nameTh": "อ่านหนังสือ",
    "svg": "/point-plus/stamps/family/books.svg",
    "png": "/point-plus/stamps/family/books.png"
  },
  {
    "id": "family-home",
    "mode": "family",
    "name": "Tiny Helper",
    "nameTh": "ช่วยดูแลบ้าน",
    "svg": "/point-plus/stamps/family/home.svg",
    "png": "/point-plus/stamps/family/home.png"
  },
  {
    "id": "family-paint",
    "mode": "family",
    "name": "Creative Mind",
    "nameTh": "ทำกิจกรรมสร้างสรรค์",
    "svg": "/point-plus/stamps/family/paint.svg",
    "png": "/point-plus/stamps/family/paint.png"
  },
  {
    "id": "family-sprout",
    "mode": "family",
    "name": "Growing Together",
    "nameTh": "เรียนรู้สิ่งใหม่",
    "svg": "/point-plus/stamps/family/sprout.svg",
    "png": "/point-plus/stamps/family/sprout.png"
  },
  {
    "id": "family-bear",
    "mode": "family",
    "name": "Kindness",
    "nameTh": "แบ่งปันและมีน้ำใจ",
    "svg": "/point-plus/stamps/family/bear.svg",
    "png": "/point-plus/stamps/family/bear.png"
  },
  {
    "id": "personal-sunrise",
    "mode": "personal",
    "name": "Early Bird",
    "nameTh": "เริ่มต้นวันตามเป้าหมาย",
    "svg": "/point-plus/stamps/personal/sunrise.svg",
    "png": "/point-plus/stamps/personal/sunrise.png"
  },
  {
    "id": "personal-dumbbell",
    "mode": "personal",
    "name": "Move More",
    "nameTh": "ออกกำลังกาย",
    "svg": "/point-plus/stamps/personal/dumbbell.svg",
    "png": "/point-plus/stamps/personal/dumbbell.png"
  },
  {
    "id": "personal-open-book",
    "mode": "personal",
    "name": "Learn Daily",
    "nameTh": "เรียนรู้ทุกวัน",
    "svg": "/point-plus/stamps/personal/open-book.svg",
    "png": "/point-plus/stamps/personal/open-book.png"
  },
  {
    "id": "personal-target",
    "mode": "personal",
    "name": "Goal Setter",
    "nameTh": "ตั้งเป้าหมายและลงมือทำ",
    "svg": "/point-plus/stamps/personal/target.svg",
    "png": "/point-plus/stamps/personal/target.png"
  },
  {
    "id": "personal-mountain",
    "mode": "personal",
    "name": "New Milestone",
    "nameTh": "ก้าวข้ามความท้าทาย",
    "svg": "/point-plus/stamps/personal/mountain.svg",
    "png": "/point-plus/stamps/personal/mountain.png"
  },
  {
    "id": "personal-trophy",
    "mode": "personal",
    "name": "Personal Best",
    "nameTh": "ทำสถิติของตัวเอง",
    "svg": "/point-plus/stamps/personal/trophy.svg",
    "png": "/point-plus/stamps/personal/trophy.png"
  }
];
export const pointPlusBadges: BadgeDefinition[] = [
  {
    "id": "couple-caring-heart",
    "mode": "couple",
    "name": "Caring Heart",
    "nameTh": "ใจดีต่อกัน",
    "rarity": "bronze",
    "svg": "/point-plus/badges/couple/caring-heart.svg",
    "png": "/point-plus/badges/couple/caring-heart.png"
  },
  {
    "id": "couple-love-notes",
    "mode": "couple",
    "name": "Love Notes",
    "nameTh": "ส่งกำลังใจกันสม่ำเสมอ",
    "rarity": "silver",
    "svg": "/point-plus/badges/couple/love-notes.svg",
    "png": "/point-plus/badges/couple/love-notes.png"
  },
  {
    "id": "couple-moment-maker",
    "mode": "couple",
    "name": "Moment Maker",
    "nameTh": "สร้างความทรงจำร่วมกัน",
    "rarity": "gold",
    "svg": "/point-plus/badges/couple/moment-maker.svg",
    "png": "/point-plus/badges/couple/moment-maker.png"
  },
  {
    "id": "couple-forever-team",
    "mode": "couple",
    "name": "Forever Team",
    "nameTh": "ผ่านภารกิจสำคัญร่วมกัน",
    "rarity": "diamond",
    "svg": "/point-plus/badges/couple/forever-team.svg",
    "png": "/point-plus/badges/couple/forever-team.png"
  },
  {
    "id": "family-first-star",
    "mode": "family",
    "name": "First Star",
    "nameTh": "สำเร็จภารกิจแรก",
    "rarity": "bronze",
    "svg": "/point-plus/badges/family/first-star.svg",
    "png": "/point-plus/badges/family/first-star.png"
  },
  {
    "id": "family-book-explorer",
    "mode": "family",
    "name": "Book Explorer",
    "nameTh": "อ่านหนังสืออย่างต่อเนื่อง",
    "rarity": "silver",
    "svg": "/point-plus/badges/family/book-explorer.svg",
    "png": "/point-plus/badges/family/book-explorer.png"
  },
  {
    "id": "family-creative-hero",
    "mode": "family",
    "name": "Creative Hero",
    "nameTh": "ทำกิจกรรมสร้างสรรค์",
    "rarity": "gold",
    "svg": "/point-plus/badges/family/creative-hero.svg",
    "png": "/point-plus/badges/family/creative-hero.png"
  },
  {
    "id": "family-growth-champion",
    "mode": "family",
    "name": "Growth Champion",
    "nameTh": "พิชิตเป้าหมายการเรียนรู้",
    "rarity": "diamond",
    "svg": "/point-plus/badges/family/growth-champion.svg",
    "png": "/point-plus/badges/family/growth-champion.png"
  },
  {
    "id": "personal-fresh-start",
    "mode": "personal",
    "name": "Fresh Start",
    "nameTh": "เริ่มสร้างนิสัยใหม่",
    "rarity": "bronze",
    "svg": "/point-plus/badges/personal/fresh-start.svg",
    "png": "/point-plus/badges/personal/fresh-start.png"
  },
  {
    "id": "personal-active-streak",
    "mode": "personal",
    "name": "Active Streak",
    "nameTh": "เคลื่อนไหวอย่างต่อเนื่อง",
    "rarity": "silver",
    "svg": "/point-plus/badges/personal/active-streak.svg",
    "png": "/point-plus/badges/personal/active-streak.png"
  },
  {
    "id": "personal-goal-chaser",
    "mode": "personal",
    "name": "Goal Chaser",
    "nameTh": "ทำเป้าหมายสำคัญสำเร็จ",
    "rarity": "gold",
    "svg": "/point-plus/badges/personal/goal-chaser.svg",
    "png": "/point-plus/badges/personal/goal-chaser.png"
  },
  {
    "id": "personal-personal-legend",
    "mode": "personal",
    "name": "Personal Legend",
    "nameTh": "พิชิตความสำเร็จใหญ่",
    "rarity": "diamond",
    "svg": "/point-plus/badges/personal/personal-legend.svg",
    "png": "/point-plus/badges/personal/personal-legend.png"
  }
];
