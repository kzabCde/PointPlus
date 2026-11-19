# Point+ Database v3 — Official asset mapping and test criteria

**Scope:** Exactly 18 collectible Stamps and 12 permanent Badges, using existing GitHub IDs and original images. This is not proof of a live database migration.

## All 18 stamps

| Collection | Asset ID | Thai title | Earning rule |
| --- | --- | --- | --- |
| couple | `couple-heart` | หัวใจแทนความใส่ใจ | Approved mission; card target 5 |
| couple | `couple-letter` | ส่งข้อความดี ๆ ให้กัน | Approved mission; card target 5 |
| couple | `couple-cheers` | ใช้เวลาคุณภาพด้วยกัน | Approved mission; card target 5 |
| couple | `couple-flowers` | สร้างเซอร์ไพรส์เล็ก ๆ | Approved mission; card target 5 |
| couple | `couple-cake` | ฉลองโอกาสพิเศษ | Approved mission; card target 5 |
| couple | `couple-lock` | ดูแลและรักษาคำมั่นสัญญา | Approved mission; card target 5 |
| family | `family-star` | ทำภารกิจได้สำเร็จ | Approved mission; card target 5 |
| family | `family-books` | อ่านหนังสือ | Approved mission; card target 5 |
| family | `family-home` | ช่วยดูแลบ้าน | Approved mission; card target 5 |
| family | `family-paint` | ทำกิจกรรมสร้างสรรค์ | Approved mission; card target 5 |
| family | `family-sprout` | เรียนรู้สิ่งใหม่ | Approved mission; card target 5 |
| family | `family-bear` | แบ่งปันและมีน้ำใจ | Approved mission; card target 5 |
| personal | `personal-sunrise` | เริ่มต้นวันตามเป้าหมาย | Approved mission; card target 5 |
| personal | `personal-dumbbell` | ออกกำลังกาย | Approved mission; card target 5 |
| personal | `personal-open-book` | เรียนรู้ทุกวัน | Approved mission; card target 5 |
| personal | `personal-target` | ตั้งเป้าหมายและลงมือทำ | Approved mission; card target 5 |
| personal | `personal-mountain` | ก้าวข้ามความท้าทาย | Approved mission; card target 5 |
| personal | `personal-trophy` | ทำสถิติของตัวเอง | Approved mission; card target 5 |

## All 12 badges

| Collection | Asset ID | Thai title | Visual rarity | v1 earning rule |
| --- | --- | --- | --- | --- |
| couple | `couple-caring-heart` | ใจดีต่อกัน | bronze | 1 approved stamps in `couple-heart` |
| couple | `couple-love-notes` | ส่งกำลังใจกันสม่ำเสมอ | silver | 3 approved stamps in `couple-letter` |
| couple | `couple-moment-maker` | สร้างความทรงจำร่วมกัน | gold | 5 approved stamps in `couple-cheers` |
| couple | `couple-forever-team` | ผ่านภารกิจสำคัญร่วมกัน | diamond | At least one approved stamp from each of 6 official categories |
| family | `family-first-star` | สำเร็จภารกิจแรก | bronze | 1 approved stamps in `family-star` |
| family | `family-book-explorer` | อ่านหนังสืออย่างต่อเนื่อง | silver | 3 approved stamps in `family-books` |
| family | `family-creative-hero` | ทำกิจกรรมสร้างสรรค์ | gold | 5 approved stamps in `family-paint` |
| family | `family-growth-champion` | พิชิตเป้าหมายการเรียนรู้ | diamond | At least one approved stamp from each of 6 official categories |
| personal | `personal-fresh-start` | เริ่มสร้างนิสัยใหม่ | bronze | 1 approved stamps in `personal-sunrise` |
| personal | `personal-active-streak` | เคลื่อนไหวอย่างต่อเนื่อง | silver | 3 approved stamps in `personal-dumbbell` |
| personal | `personal-goal-chaser` | ทำเป้าหมายสำคัญสำเร็จ | gold | 5 approved stamps in `personal-target` |
| personal | `personal-personal-legend` | พิชิตความสำเร็จใหญ่ | diamond | At least one approved stamp from each of 6 official categories |

## Core behavior

- Every stamp award needs a real `mission_submissions.status='approved'` event with matching `space_id`, participant and card.
- Badges are permanent and unique per participant/definition. Never delete unlocked badges.
- Artwork rarity bronze/silver/gold/diamond maps explicitly to database rarity common/rare/epic/legendary.
- The Group Room uses the personal collection independently for each participant; existing private Personal Spaces remain untouched.
- UUIDs from `stamp_cards` and `badge_definitions` must not be confused with immutable asset IDs.
- The v1 badge `personal-active-streak` requires 3 approved Move More stamps, not 3 consecutive days. The v1 `couple-forever-team` requires 6 categories per participant, not proven mutual completion. Rename product claims or create a separately versioned stricter rule before asserting either behavior.

## End-to-end acceptance scenarios

1. Couple: account A invites account B; a third account is rejected; each account earns an official stamp only from approved submissions.
2. Family: guardian can act for child, unrelated adults cannot view child proof/wallet/badges.
3. Group: three distinct members earn the personal collection independently with no cross-room/participant leakage.
4. For every one of the 18 Stamp IDs, run an approved mission, verify one authorized stamp award, and check cycle completion at target 5.
5. For every one of the 12 Badge IDs, satisfy threshold and verify exactly one permanent participant badge.
6. Replay submission/review and redemption idempotency keys. No double points, stamps, badges, refunds or redeemed stock.
7. As non-privileged Room manager, try editing official badge criteria/stamp card targets: trigger must reject changes.
8. RLS tests with two real auth sessions, and post-migration verification SQL return zero anomalies.

**Unverified until correct Supabase access:** migration SQL execution, RLS adversarial tests and real award behavior.
