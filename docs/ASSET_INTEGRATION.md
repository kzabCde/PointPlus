# PointPlus — Stamp & Achievement Badge Assets

## Scope and provenance

This imports the artwork and metadata from `Point_Plus_Stamps_Badges_WebApp_Kit(1).zip` (the supplied kit was uploaded as `(2).zip` in this conversation). It is **static asset preparation** for the future Phase 3 — Stamps & Achievements. It does not award stamps, unlock badges, query Supabase, change missions, or create screens.

The artwork was copied byte-for-byte from `Point_Plus_Stamps_Badges/public/point-plus/`. No artwork or filenames were changed. Do not commit the source ZIP; keep it outside the repository as the source for reference demo components.

## Directory structure

```text
public/point-plus/
  stamps/{couple,family,personal}/*.svg|*.png
  badges/{couple,family,personal}/*.svg|*.png
assets/point-plus/manifest/
  stamps.json
  badges.json
  collections.json
lib/point-plus/
  assets.ts
  utils.ts
scripts/
  validate-point-plus-assets.mjs
docs/
  ASSET_INTEGRATION.md
```

## Asset inventory

| Collection | Couple | Family | Personal | Total designs | Files |
|---|---:|---:|---:|---:|---:|
| Stamps | 6 | 6 | 6 | 18 | 36 |
| Achievement Badges | 4 | 4 | 4 | 12 | 24 |
| **Total** | **10** | **10** | **10** | **30** | **60** |

There are 30 SVG files (256 × 256 intrinsic size) and 30 PNG files (512 × 512, RGBA transparency). Badge rarities in this kit are `bronze`, `silver`, `gold`, and `diamond`.

## Next.js usage

All artwork is hosted by Next.js from `public` using root-relative URLs. Do **not** include `/public` in a URL:

```tsx
<img src="/point-plus/stamps/couple/heart.svg" alt="Sweet Heart" width={72} height={72} />
<img src="/point-plus/badges/family/first-star.png" alt="First Star" width={72} height={72} />
```

The original SVG remains the vector source, while the PNG is a raster fallback, useful when vector rendering is undesirable or unsupported. The PNG and SVG intentionally have different intrinsic pixel sizes; set rendered dimensions in components as needed. For user-facing images, derive accessible `alt` text from the localized names rather than a hardcoded filename.

```ts
import {
  pointPlusStamps,
  pointPlusBadges,
  type PointPlusMode,
  type BadgeRarity,
  type StampDefinition,
  type BadgeDefinition,
} from '@/lib/point-plus/assets'
import {
  findStampById,
  findBadgeById,
  listStampsByMode,
  listBadgesByMode,
  stampAssetUrl,
  badgeAssetUrl,
} from '@/lib/point-plus/utils'

const coupleStamps = listStampsByMode('couple')
const heart = findStampById('couple-heart')
const url = heart?.svg ?? stampAssetUrl('couple-heart')
```

The helper functions are synchronous, pure display-data lookups. They require **no** live database connection. Consumers may choose `nameTh` for Thai interfaces and `name` otherwise.

## Personal, Couple and Family

- `personal`: individual collection and achievement art.
- `couple`: art for shared couple experiences.
- `family`: family and child-focused art.

Each mode has its own subdirectory for both stamps and badges. The `mode` field and `collections.json` organize the catalog; they do not grant access to any particular space, user or reward.

## Future Phase 3 integration

Components may import the registry for static design names, modes, icon URLs and rarity. **Actual** completion or unlock state must come from authorized backend records; never infer it from manifest membership or demo state.

`id` in these manifests is a stable **asset ID**, **not** a Supabase row ID. When Phase 3 introduces authoritative reward definitions, store a reviewed explicit mapping such as `db_stamp_definition_id -> asset_id` or `db_badge_definition_id -> asset_id`, and verify that referenced asset IDs exist. Handle unmapped records gracefully with the provided fallback functions. Do not automatically insert manifest data into Supabase.

The original ZIP additionally includes `StampCard.tsx`, `BadgeGallery.tsx`, `pointPlus.css`, and `example-page.tsx` in its `nextjs/` directory. They are **reference UI demos with mock state**; they were not mounted in application routes or copied into active components. Obtain these examples from the original source package when Phase 3 work starts.

## Adding assets safely

1. Obtain approved original SVG and PNG files and preserve their exact names and images.
2. Place both formats under the correct `stamps` or `badges` and mode directory.
3. Add unique, stable, namespaced asset IDs and both image paths to the matching JSON manifest.
4. Keep `collections.json` in sync; reference each ID in its matching mode exactly once.
5. Update `lib/point-plus/assets.ts` as the one canonical typed registry; do not create a second registry.
6. Validate untrusted SVGs for scripts, JavaScript event attributes and external references; investigate warnings before merging.
7. Run `node scripts/validate-point-plus-assets.mjs`, `npm run typecheck`, and `npm run build` before merging.

The validation script also enforces the initial kit's fixed inventory (18 stamps and 12 badges). When adding approved new assets in a future release, intentionally update those expectations along with the catalog and tests.
