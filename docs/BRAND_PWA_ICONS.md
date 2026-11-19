# Point+ official heart icon integration

The official user-supplied PNGs are stored in `public/icons/` without resizing or re-encoding. All 14 files were imported from `PointPlus_PWA_PNG_32-512.zip` and keep their original names.

- Browser favicon: `/icons/icon-32x32.png`, configured via root Next.js metadata.
- Apple Touch Icon: `/icons/icon-180x180.png`.
- PWA icons: `/icons/icon-192x192.png` and `/icons/icon-512x512.png`.
- PWA manifest: `app/manifest.ts`, served by Next.js at `/manifest.webmanifest`.
- Shared visual branding: `components/brand/pointplus-mark.tsx`, used in the public header, prepared auth layout, and protected sidebar.

The PNGs are declared with `purpose: 'any'` because the source artwork has not been verified for safe-area requirements of maskable icons. No service worker was added or reset. A manifest alone does not implement offline support.

The app still follows the non-commercial, person-to-person mission and encouragement scope. Login and registration pages do not exist yet in the current M01 repo; their shared auth layout will display this logo when those routes are added.

## Checks

```bash
npm ci
npm run test:foundation
npm run typecheck
npm run build
```

If the app was installed before this branding update, the browser or operating system may cache its previous icon. Revisit the website and, if needed, reinstall the app after the new deployment.
