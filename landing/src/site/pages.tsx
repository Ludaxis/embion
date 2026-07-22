import { useEffect } from 'react';
import {
  PageShell, PageHero, CodeCard, EmailCapture, DemoVideo, Todo, TodoText, Fn, track,
} from './chrome';
import {
  CTA, SPEC_GROUPS, MODULES_MAILTO, SOURCES, DEMO_VIDEO,
} from '../content/product';
import {
  DEVELOPERS, RESEARCH, LEROBOT, DATASETS, DEVKIT, STORY,
} from '../content/pages';

/* ============================== /developers ============================== */

export function DevelopersPage() {
  const d = DEVELOPERS;
  return (
    <PageShell current="/developers/">
      <PageHero kicker={d.kicker} title={d.h1} sub={d.sub} />

      <section className="panel">
        <div className="panel-inner">
          <CodeCard code={d.code} badge={d.codeTodo} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">{d.quickstart.kicker}</p>
          <h2>{d.quickstart.title}</h2>
          <div className="steps">
            {d.quickstart.steps.map((s, i) => (
              <div className="step" key={s.title}>
                <span className="step-index">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p><TodoText text={s.body} /></p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">{d.raw.kicker}</p>
          <h2>{d.raw.title}</h2>
          <p className="panel-body"><TodoText text={d.raw.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">{d.format.kicker}</p>
          <h2>{d.format.title}</h2>
          <p className="panel-body">{d.format.body}</p>
          <div className="frame-diagram" role="img" aria-label="Layout of the composed frame: one camera region beside the LiDAR, ToF, IMU and audio regions">
            {d.format.regions.map((r) => (
              <div key={r.id} className={`frame-region is-${r.id}`}>{r.label}</div>
            ))}
          </div>
          <p className="frame-caption">The composed frame. Fixed regions, one clock, parse and go.</p>
          <div className="code-card-wrap">
            <CodeCard code={d.format.code} badge={d.codeTodo} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">{DEMO_VIDEO.kicker}</p>
          <h2>{DEMO_VIDEO.title}</h2>
          <DemoVideo
            src={DEMO_VIDEO.src}
            poster={DEMO_VIDEO.poster}
            caption={DEMO_VIDEO.caption}
            todo={d.demoTodo}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Tooling</p>
          <h2>The stack around the stream.</h2>
          <div className="panel-grid">
            <div>
              <h3>{d.sdk.title}</h3>
              <p><TodoText text={d.sdk.body} /></p>
            </div>
            <div>
              <h3>{d.ros.title}</h3>
              <p><TodoText text={d.ros.body} /></p>
            </div>
            <div>
              <h3>{d.community.title}</h3>
              <p>{d.community.body}</p>
              <p style={{ marginTop: 12 }}>
                {d.community.links.map((l) => (
                  <span key={l.label} style={{ marginRight: 18 }}>
                    {l.label} <Todo>{l.todo}</Todo>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Limits</p>
          <h2>{d.isnt.title}</h2>
          <p className="panel-body"><TodoText text={d.isnt.body} /></p>
        </div>
      </section>

      <ReserveBand />
    </PageShell>
  );
}

/* =============================== /research =============================== */

export function ResearchPage() {
  const r = RESEARCH;
  return (
    <PageShell current="/research/">
      <PageHero
        kicker={r.kicker}
        title={r.h1}
        sub={<>{r.intro}<Fn ns={r.introFns} /></>}
      />

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">In the lab</p>
          <h2>{r.methods.title}</h2>
          <p className="panel-body"><TodoText text={r.methods.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">In the pipeline</p>
          <h2>{r.corpus.title}</h2>
          <p className="panel-body">{r.corpus.body}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">In the paper</p>
          <h2>{r.citation.title}</h2>
          <p className="panel-body">{r.citation.body}</p>
          <CodeCard code={r.citation.bibtex} lang="bibtex" badge="[TODO: citation]" />
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">{r.foundingLabs.kicker}</p>
          <h2>{r.foundingLabs.title}</h2>
          <p className="panel-body">{r.foundingLabs.body}</p>
          <div style={{ maxWidth: 520 }}>
            <EmailCapture
              subject={r.foundingLabs.subject}
              cta={r.foundingLabs.cta}
              kind="founding_lab"
              successCopy="Application received. We read every one — expect a reply from a founder."
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* =============================== /lerobot ================================ */

export function LeRobotPage() {
  const l = LEROBOT;
  return (
    <PageShell current="/lerobot/">
      <PageHero kicker={l.kicker} title={l.h1} sub={l.body} />

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">On the bench</p>
          <h2>One head instead of three webcams.</h2>
          <div className="media-placeholder">
            <Todo>{l.mediaTodo}</Todo>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">End to end</p>
          <h2>{l.example.title}</h2>
          <p className="panel-body"><TodoText text={l.example.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Fit</p>
          <h2>{l.compat.title}</h2>
          <p className="panel-body"><TodoText text={l.compat.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Community</p>
          <h2>{l.community.title}</h2>
          <p className="panel-body">
            {l.community.body}{' '}
            <span className="footer-dead-link">
              {l.community.linkLabel} <Todo>{l.community.linkTodo}</Todo>
            </span>
          </p>
        </div>
      </section>

      <ReserveBand />
    </PageShell>
  );
}

/* =============================== /datasets =============================== */

export function DatasetsPage() {
  const d = DATASETS;
  return (
    <PageShell current="/datasets/">
      <PageHero kicker={d.kicker} title={d.h1} sub={d.sub} />

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Status</p>
          <h2>{d.comingSoon.title}</h2>
          <p className="panel-body"><TodoText text={d.comingSoon.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Stay close</p>
          <h2>{d.comingSoon.captureTitle}</h2>
          <div style={{ maxWidth: 520 }}>
            <EmailCapture
              subject={d.comingSoon.subject}
              cta={d.comingSoon.cta}
              kind="notify"
              successCopy="You’re on the list. First data, first email."
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ================================ /devkit ================================ */

export function DevkitPage() {
  const k = DEVKIT;
  useEffect(() => track('reserve_view'), []);
  return (
    <PageShell current="/devkit/" hideFooterCapture>
      <PageHero kicker={k.kicker} title={k.h1} sub={<TodoText text={k.sub} />} />

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Contents</p>
          <h2>{k.box.title}</h2>
          <ul className="plain-list">
            {k.box.items.map((item) => (
              <li key={item}><TodoText text={item} /></li>
            ))}
          </ul>
          <div className="price-row">
            <span className="price-label">{k.price.label}</span>
            <span className="price-value"><TodoText text={k.price.value} /></span>
          </div>
        </div>
      </section>

      <section className="panel" id="specs">
        <div className="panel-inner">
          <p className="kicker">Specifications</p>
          <h2>{k.specsTitle}</h2>
          <div className="spec-table">
            {SPEC_GROUPS.map((g) => (
              <div className="spec-group" key={g.group}>
                <div className="spec-group-name">{g.group}</div>
                <div className="spec-rows">
                  {g.rows.map(([key, val]) => (
                    <div className="spec-row" key={key}>
                      <span className="spec-key">{key}</span>
                      <span className="spec-val"><TodoText text={val} /></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" id="compare">
        <div className="panel-inner">
          <p className="kicker">{k.compare.kicker}</p>
          <h2>{k.compare.title}</h2>
          <div className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">Feature</span></th>
                  {k.compare.columns.map((c) => (
                    <th scope="col" key={c} className={c === 'EMB-01' ? 'is-emb' : undefined}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {k.compare.rows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={i === k.compare.columns.indexOf('EMB-01') ? 'is-emb' : undefined}>
                        <TodoText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="frame-caption">
            {k.compare.priceLabel}<Fn ns={k.compare.priceFns} />
          </p>
          <p className="panel-body">{k.compare.caption}</p>
        </div>
      </section>

      <section className="panel" id="reserve">
        <div className="panel-inner">
          <p className="kicker">Batch One</p>
          <h2>{k.reserve.title}</h2>
          <p className="panel-body"><TodoText text={k.reserve.body} /></p>
          <div style={{ maxWidth: 520 }}>
            <EmailCapture subject={k.reserve.subject} cta={k.reserve.cta} kind="reserve" />
          </div>
          <p className="capture-note" style={{ marginTop: 28 }}>
            <a href={MODULES_MAILTO}>{k.oemLine}</a>
          </p>
        </div>
      </section>
    </PageShell>
  );
}

/* ================================= /story ================================ */

export function StoryPage() {
  const s = STORY;
  return (
    <PageShell current="/story/">
      <PageHero kicker={s.kicker} title={s.h1} />

      <section className="panel">
        <div className="panel-inner">
          <div className="story-prose">
            {s.body.map((p) => (
              <p key={p.text.slice(0, 24)}>
                {p.text}
                {p.link && (
                  <>
                    <a href={p.link.href} target="_blank" rel="noreferrer">{p.link.label}</a>
                    {p.after}
                  </>
                )}
                {p.fns && <Fn ns={p.fns} base="" />}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" id={s.whyNow.id}>
        <div className="panel-inner">
          <p className="kicker">{s.whyNow.kicker}</p>
          <h2>{s.whyNow.title}</h2>
          <div className="story-prose">
            {s.whyNow.paragraphs.map((p) => (
              <p key={p.text.slice(0, 24)}>
                {p.text}
                {p.fns && <Fn ns={p.fns} base="" />}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="stats-row story-stats">
            {s.stats.tiles.map((t) => (
              <div className="stat" key={t.value}>
                <div className="stat-num">
                  <span>{t.value}</span>
                  <Fn ns={[t.fn]} base="" />
                </div>
                <div className="stat-label">{t.label} · {t.src}</div>
              </div>
            ))}
          </div>
          <p className="frame-caption">{s.stats.note}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="kicker">Founders</p>
          <h2>{s.founders.title}</h2>
          <p className="panel-body"><TodoText text={s.founders.body} /></p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <p className="story-closer">{s.closer}</p>
        </div>
      </section>

      <section className="panel" id="sources">
        <div className="panel-inner">
          <p className="kicker">{s.sourcesTitle}</p>
          <ol className="sources-list">
            {SOURCES.map((src) => (
              <li key={src.n} id={`source-${src.n}`}>
                <a href={src.url} target="_blank" rel="noreferrer">{src.label}</a>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------------ */

/** Shared conversion band — the primary CTA only (the site has two CTAs, total). */
function ReserveBand() {
  return (
    <section className="panel final-cta">
      <div className="panel-inner">
        <p className="kicker">Batch One</p>
        <h2 className="cta-line">Get a head.</h2>
        <div className="hero-ctas">
          <a className="btn" href={CTA.primaryHref}>{CTA.primary}</a>
        </div>
      </div>
    </section>
  );
}
