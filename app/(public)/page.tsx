import type { Metadata } from 'next'
import Image from 'next/image'
import { Brand } from '@/components/brand/pointplus-mark'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'สมุดสะสมแสตมป์ของคนสำคัญ',
}

const sampleStamps = [
  { src: '/point-plus/stamps/personal/sunrise.svg', alt: 'แสตมป์รูปพระอาทิตย์สำหรับเป้าหมายส่วนตัว' },
  { src: '/point-plus/stamps/couple/heart.svg', alt: 'แสตมป์หัวใจสำหรับกิจกรรมของคนรัก' },
  { src: '/point-plus/stamps/family/star.svg', alt: 'แสตมป์ดาวสำหรับกิจกรรมของครอบครัว' },
]

const spaceTypes = [
  {
    title: 'สำหรับตัวเอง',
    description: 'แบ่งเป้าหมายออกเป็นเรื่องเล็ก ๆ ที่ทำได้จริง และเห็นความพยายามของตัวเองอย่างเป็นรูปธรรม',
    stamp: '/point-plus/stamps/personal/target.svg',
    alt: 'แสตมป์รูปเป้าหมาย',
    accent: '',
  },
  {
    title: 'สำหรับคนรัก',
    description: 'ชวนกันทำเรื่องดี ๆ สร้างเวลาคุณภาพ และส่งกำลังใจให้กันในแบบของสองคน',
    stamp: '/point-plus/stamps/couple/heart.svg',
    alt: 'แสตมป์รูปหัวใจ',
    accent: 'feature-card__icon--coral',
  },
  {
    title: 'สำหรับครอบครัว',
    description: 'สร้างกิจกรรมร่วมกันอย่างอบอุ่น และให้กำลังใจเด็ก ๆ ผ่านภารกิจที่ผู้ใหญ่ช่วยดูแล',
    stamp: '/point-plus/stamps/family/books.svg',
    alt: 'แสตมป์รูปหนังสือ',
    accent: 'feature-card__icon--butter',
  },
]

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Brand />
          <nav className="site-nav" aria-label="เมนูหน้าแรก">
            <a href="#spaces">พื้นที่ของเรา</a>
            <a href="#how-it-works">วิธีใช้งาน</a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="container hero__grid">
            <div>
              <span className="eyebrow">ทำเรื่องเล็กให้มีความหมาย</span>
              <h1 id="hero-heading">ทุกความตั้งใจ<br />มีค่าเมื่อเรา<span>ทำไปด้วยกัน</span></h1>
              <p className="hero__text">
                PointPlus คือสมุดสะสมแสตมป์สำหรับคนสำคัญ สร้างสมุด เลือกลายแสตมป์ให้กัน แล้วเลือกรางวัลเมื่อครบจำนวน สำหรับคู่รัก ครอบครัว และเพื่อน โดยไม่เกี่ยวกับการซื้อขายหรือธุรกิจ
              </p>
              <div className="hero__actions">
                <ButtonLink href="/register">เริ่มใช้งาน PointPlus <span aria-hidden="true">→</span></ButtonLink>
                <ButtonLink href="/login" variant="secondary">เข้าสู่ระบบ</ButtonLink>
              </div>
              <span className="hero__note">สมัครสมาชิกและสร้างพื้นที่ส่วนตัวของคุณได้เลย</span>
            </div>

            <div className="hero-art">
              <div className="preview">
                <div className="preview__top">
                  <strong>สมุดสะสมความสุข</strong>
                  <small>เลือกภาพได้ทุกครั้ง</small>
                </div>
                <div className="preview__stamps">
                  {sampleStamps.map((stamp) => (
                    <div className="preview__stamp" key={stamp.src}>
                      <Image src={stamp.src} alt={stamp.alt} width={76} height={76} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--soft" id="spaces" aria-labelledby="spaces-title">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">พื้นที่ที่เหมาะกับเรา</span>
              <h2 id="spaces-title">ความสัมพันธ์แต่ละแบบ มีวิธีเติบโตที่ต่างกัน</h2>
              <p>สร้างสมุดสะสมในห้องของคุณ เลือกผู้รับและรางวัลได้เอง ทุกดวงเป็นเรื่องราวที่มีความหมาย</p>
            </div>
            <div className="feature-grid">
              {spaceTypes.map((space) => (
                <article className="feature-card" key={space.title}>
                  <div className={'feature-card__icon ' + space.accent}>
                    <Image src={space.stamp} alt={space.alt} width={67} height={67} />
                  </div>
                  <h3>{space.title}</h3>
                  <p>{space.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="steps-title">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">แนวคิดการใช้งาน</span>
              <h2 id="steps-title">สามขั้นตอน สร้างแรงใจได้ทุกวัน</h2>
              <p>ไม่จำเป็นต้องสร้างภารกิจก่อนให้แสตมป์ ทุกดวงมีผู้ให้และวันที่บันทึกชัดเจน</p>
            </div>
            <ol className="steps">
              <li>
                <span className="steps__number">1</span>
                <strong>สร้างสมุดสะสม</strong>
                <p>ตั้งชื่อสมุด เลือกจำนวนดวงและคนที่จะสะสม พร้อมเพิ่มตัวเลือกรางวัล</p>
              </li>
              <li>
                <span className="steps__number">2</span>
                <strong>เลือกแสตมป์ให้กัน</strong>
                <p>คนที่มีสิทธิ์เลือกลายแสตมป์จาก 18 แบบ และมอบให้ผู้สะสมทีละดวง</p>
              </li>
              <li>
                <span className="steps__number">3</span>
                <strong>สะสมครบแล้วเลือกรางวัล</strong>
                <p>เมื่อครบจำนวนที่กำหนด ผู้สะสมเลือกหนึ่งรางวัลที่ตกลงกัน โดยไม่หักแต้ม</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section section--soft" aria-label="หลักการของ PointPlus">
          <div className="container">
            <div className="bottom-note">
              <div>
                <h2 style={{ marginBottom: 0, fontSize: 22 }}>ความทรงจำและกำลังใจ ไม่จำเป็นต้องมีราคา</h2>
                <p>PointPlus สร้างเพื่อความสัมพันธ์ระหว่างคนกับคนเท่านั้น</p>
              </div>
              <ButtonLink href="#main-content" variant="secondary">กลับไปด้านบน</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <span>© PointPlus — เรื่องดี ๆ ที่เราแบ่งปันกัน</span>
          <a className="text-link" href="#main-content">กลับขึ้นด้านบน</a>
        </div>
      </footer>
    </>
  )
}
