import {
  HOW_IT_WORKS, WHY_ONE_STREAM, DATA_STORY, BUILDERS, DEVKIT_BAND, WHY_NOW_TEASER, DEMO_VIDEO,
} from '../content/product';
import { DemoVideo, Fn, SiteFooter, TodoText } from '../site/chrome';

/** Everything after the 3D scroll track — opaque, DOM-first, SEO-real. */
export function AfterTrack() {
  return (
    <div id="after-track">
      <HowItWorks />
      <DemoSection />
      <WhyOneStream />
      <DataStory />
      <BuiltForBuilders />
      <WhyNowTeaser />
      <DevkitBand />
      <SiteFooter />
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="panel" id="how-it-works">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{HOW_IT_WORKS.kicker}</p>
        </div>
        <div className="steps">
          {HOW_IT_WORKS.steps.map((s, i) => (
            <div className="step reveal" key={s.title}>
              <span className="step-index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section className="panel" id="demo">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{DEMO_VIDEO.kicker}</p>
          <h2>{DEMO_VIDEO.title}</h2>
        </div>
        <div className="reveal">
          <DemoVideo
            src={DEMO_VIDEO.src}
            poster={DEMO_VIDEO.poster}
            caption={DEMO_VIDEO.caption}
            todo={DEMO_VIDEO.todo}
          />
        </div>
      </div>
    </section>
  );
}

function WhyOneStream() {
  return (
    <section className="panel" id="why-one-stream">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{WHY_ONE_STREAM.kicker}</p>
          <h2>{WHY_ONE_STREAM.title}</h2>
          <p className="panel-body">
            {WHY_ONE_STREAM.body} <TodoText text={WHY_ONE_STREAM.todo} />
          </p>
        </div>
      </div>
    </section>
  );
}

function DataStory() {
  return (
    <section className="panel" id="data-story">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{DATA_STORY.kicker}</p>
          <h2>{DATA_STORY.title}</h2>
          <p className="panel-body">{DATA_STORY.body}</p>
          <p className="micro-stat">
            {DATA_STORY.microStat}
            <Fn ns={DATA_STORY.microStatFns} />
          </p>
          {/* text link, not a button: the site has exactly two button CTAs */}
          <p className="panel-cta">
            <a className="teaser-link" href={DATA_STORY.ctaHref}>→ {DATA_STORY.cta}</a>
          </p>
        </div>
      </div>
    </section>
  );
}

function BuiltForBuilders() {
  return (
    <section className="panel" id="builders">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{BUILDERS.kicker}</p>
          <h2>{BUILDERS.title}</h2>
        </div>
        <div className="cases-grid">
          {BUILDERS.cards.map((c, i) => (
            <a className="case-card reveal" key={c.title} href={c.href}>
              <span className="case-index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <span className="case-arrow">→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyNowTeaser() {
  return (
    <section className="panel" id="why-now-teaser">
      <div className="panel-inner reveal">
        <p className="teaser-line">
          {WHY_NOW_TEASER.line}{' '}
          <a className="teaser-link" href={WHY_NOW_TEASER.href}>→ {WHY_NOW_TEASER.cta}</a>
        </p>
      </div>
    </section>
  );
}

function DevkitBand() {
  return (
    <section className="panel final-cta" id="devkit-band">
      <div className="panel-inner reveal">
        <p className="kicker">{DEVKIT_BAND.kicker}</p>
        <h2 className="cta-line">{DEVKIT_BAND.title}</h2>
        <div className="band-facts">
          {DEVKIT_BAND.facts.map((f, i) => (
            <span key={f}>
              {i > 0 && <span className="dot">·&nbsp;&nbsp;</span>}
              <TodoText text={f} />
            </span>
          ))}
        </div>
        <div className="hero-ctas">
          <a className="btn" href={DEVKIT_BAND.ctaHref}>{DEVKIT_BAND.cta}</a>
        </div>
      </div>
    </section>
  );
}
