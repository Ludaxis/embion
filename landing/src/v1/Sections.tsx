import { useState } from 'react';
import {
  INTERFACE_SECTION, USE_CASES, SPEC_GROUPS, FAQ, FOOTER_NOTE,
  BUILD_LOG_URL, CONTACT_MAILTO, PRODUCT_CODE, BRAND,
} from '../content/product';

/** Everything after the 3D scroll track — opaque, DOM-first, SEO-real. */
export function AfterTrack() {
  return (
    <div id="after-track">
      <InterfaceSection />
      <UseCases />
      <Specs />
      <Faq />
      <FinalCta />
      <footer className="site-footer">
        <span>{BRAND} — {new Date().getFullYear()}</span>
        <span className="footer-note">{FOOTER_NOTE}</span>
        <a href={BUILD_LOG_URL} target="_blank" rel="noreferrer">Build log</a>
      </footer>
    </div>
  );
}

function InterfaceSection() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel" id="interface">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">{INTERFACE_SECTION.kicker}</p>
          <h2>{INTERFACE_SECTION.title}</h2>
          <p className="panel-body">{INTERFACE_SECTION.body}</p>
        </div>
        <div className="code-card reveal">
          <div className="code-head">
            <span className="code-lang">python</span>
            <button
              className="code-copy"
              onClick={() => {
                navigator.clipboard.writeText(INTERFACE_SECTION.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre><code>{INTERFACE_SECTION.code}</code></pre>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="panel" id="use-cases">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">Where it goes</p>
          <h2>Built for machines that share our world.</h2>
        </div>
        <div className="cases-grid">
          {USE_CASES.map((u, i) => (
            <div className="case-card reveal" key={u.title}>
              <span className="case-index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{u.title}</h3>
              <p>{u.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Specs() {
  return (
    <section className="panel" id="specs">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">Specifications</p>
          <h2>{PRODUCT_CODE}, on paper.</h2>
        </div>
        <div className="spec-table reveal">
          {SPEC_GROUPS.map((g) => (
            <div className="spec-group" key={g.group}>
              <div className="spec-group-name">{g.group}</div>
              <div className="spec-rows">
                {g.rows.map(([k, v]) => (
                  <div className="spec-row" key={k}>
                    <span className="spec-key">{k}</span>
                    <span className="spec-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="panel" id="faq">
      <div className="panel-inner">
        <div className="panel-copy reveal">
          <p className="kicker">FAQ</p>
          <h2>The practical questions.</h2>
        </div>
        <div className="faq-list reveal">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="panel final-cta" id="cta">
      <div className="panel-inner reveal">
        <p className="kicker">{PRODUCT_CODE}</p>
        <h2 className="cta-line">Give your robot every sense.</h2>
        <p className="panel-body">
          A working proof of concept, documented end to end. Follow the build,
          or get in early.
        </p>
        <div className="hero-ctas">
          <a className="btn" href={CONTACT_MAILTO}>Request early access</a>
          <a className="btn btn-ghost" href={BUILD_LOG_URL} target="_blank" rel="noreferrer">
            Read the build log
          </a>
        </div>
      </div>
    </section>
  );
}
