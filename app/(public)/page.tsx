import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Brand } from '@/components/brand/pointplus-mark'
import { LandingReveals } from '@/components/landing/landing-reveals'
import { InteractiveStampBook } from '@/components/landing/interactive-stamp-book'
import { flowersStamp, heartStamp, letterStamp } from '@/components/landing/illustrative-stamps'
import { StampPressPreview } from '@/components/landing/stamp-press-preview'
import { ButtonLink } from '@/components/ui/button'
import './landing.css'

export const metadata: Metadata = {
  title: 'สมุดสะสมแสตมป์ของคนสำคัญ',
}

export default function HomePage() {
  return <div className="living-landing">
    <LandingReveals/>
    <header className="site-header">
      <div className="container site-header__inner">
        <Brand/>
        <nav className="site-nav" aria-label="เมนูหน้าแรก">
          <a href="#how-it-works">วิธีใช้งาน</a>
          <Link href="/login" prefetch={false}>เข้าสู่ระบบ</Link>
        </nav>
      </div>
    </header>

    <main id="main-content" tabIndex={-1}>
      <section className="living-hero container" aria-labelledby="hero-heading">
        <div className="living-hero__copy">
          <p className="living-hero__eyebrow" lang="en">POINT+ · OUR LITTLE MOMENTS</p>
          <h1 id="hero-heading">เก็บทุกเรื่องราวดี ๆ <span>ไว้ในสมุดของเรา</span></h1>
          <p className="living-hero__description">สร้างสมุดสะสมแสตมป์ให้คนสำคัญ มอบความสุขเล็ก ๆ ให้กัน และเก็บทุกความทรงจำไว้ในแบบของเรา</p>
          <div className="living-actions">
            <ButtonLink href="/register" prefetch={false}>เริ่มสร้างสมุด <span aria-hidden="true">→</span></ButtonLink>
            <ButtonLink href="/login" prefetch={false} variant="secondary">เข้าสู่ระบบ</ButtonLink>
          </div>
          <p className="living-hero__message">ทุกแสตมป์ คือหนึ่งเรื่องราวที่มีความหมาย</p>
        </div>
        <InteractiveStampBook/>
      </section>

      <div className="living-stories" id="how-it-works">
        <section className="living-story" id="spaces" aria-labelledby="create-book-heading">
          <div className="container living-story__grid" data-living-reveal>
            <div className="living-story__copy">
              <h2 id="create-book-heading">เริ่มจากสมุดหนึ่งเล่ม</h2>
              <p>ตั้งชื่อสมุด เลือกลายบนปก และกำหนดจำนวนแสตมป์ที่อยากสะสม สมุดเล่มนี้มีไว้ให้คนสำคัญของคุณโดยเฉพาะ</p>
            </div>
            <figure className="sample-label">
              <div className="sample-label__cover">
                <Image src={flowersStamp} width={96} height={96} alt=""/>
              </div>
              <figcaption>
                <span className="sample-label__caption">สมุดตัวอย่าง</span>
                <strong>วันดี ๆ ของเรา</strong>
                <dl>
                  <div><dt>ผู้สะสม</dt><dd>เตย</dd></div>
                  <div><dt>เป้าหมาย</dt><dd>3 ดวง</dd></div>
                </dl>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="living-story living-story--stamp" aria-labelledby="give-stamp-heading">
          <div className="container living-story__grid" data-living-reveal>
            <div className="living-story__copy">
              <h2 id="give-stamp-heading">ให้แสตมป์แทนคำขอบคุณ</h2>
              <p>นทีให้แสตมป์ในสมุดของเตยได้ และเตยก็สร้างสมุดอีกเล่มไว้ให้แสตมป์นทีได้ ต่างคนต่างสะสมเรื่องราวในสมุดของตัวเอง</p>
              <div className="reciprocal-example" role="group" aria-label="ตัวอย่างการให้แสตมป์ทั้งสองทาง">
                <span>นที <span aria-hidden="true">→</span><span className="sr-only"> ให้ </span> เตย</span>
                <span>เตย <span aria-hidden="true">→</span><span className="sr-only"> ให้ </span> นที</span>
              </div>
            </div>
            <StampPressPreview/>
          </div>
        </section>

        <section className="living-story" aria-labelledby="memories-heading">
          <div className="container living-story__grid" data-living-reveal>
            <div className="living-story__copy">
              <h2 id="memories-heading">ครบเล่มแล้ว เก็บไว้เป็นความทรงจำ</h2>
              <p>เมื่อสมุดคู่รักสะสมครบ ผู้สะสมแลกรางวัลและเขียนข้อความถึงอีกคนได้ สมุดจะปิดและเก็บไว้ให้ทั้งคู่กลับมาเปิดอ่าน</p>
            </div>
            <figure className="sample-memory">
              <figcaption>ตัวอย่างสมุดที่เก็บแล้ว</figcaption>
              <div className="sample-memory__stamp-row" aria-hidden="true">
                {[heartStamp, flowersStamp, letterStamp].map(src => <Image key={src} src={src} width={64} height={64} alt=""/>)}
              </div>
              <blockquote>“ไว้ไปดูพระอาทิตย์ตกด้วยกันอีกนะ”</blockquote>
              <span>เตย · ผู้สะสม</span>
            </figure>
          </div>
        </section>
      </div>

      <section className="living-finale" aria-labelledby="start-heading">
        <div className="container">
          <h2 id="start-heading">เรื่องราวของเราควรมีที่เก็บพิเศษ</h2>
          <ButtonLink href="/register" prefetch={false}>เริ่มสร้างสมุด <span aria-hidden="true">→</span></ButtonLink>
        </div>
      </section>
    </main>

    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>© PointPlus · เรื่องราวระหว่างคน ไม่เกี่ยวกับการซื้อขายหรือธุรกิจ</span>
        <a className="text-link" href="#main-content">กลับขึ้นด้านบน</a>
      </div>
    </footer>
  </div>
}
