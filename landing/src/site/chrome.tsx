import { useEffect, useState, type ReactNode } from 'react';
import {
  BRAND, PRODUCT_CODE, NAV, CTA, FOOTER, FOOTER_NOTE,
  CONTACT_EMAIL, MODULES_MAILTO, RESERVE_SUBJECT,
} from '../content/product';

/** Same fixed header as the home page, with the site-wide nav. */
export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        {BRAND}<span className="brand-dot">·</span><span className="brand-code">{PRODUCT_CODE}</span>
      </a>
      <nav>
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <a className="btn btn-small" href={CTA.primaryHref}>{CTA.primaryShort}</a>
    </header>
  );
}

/** Visible [TODO: …] placeholder — honest, styled, unmistakable. */
export function Todo({ children }: { children: string }) {
  return <span className="todo">{children}</span>;
}

/** Renders copy that may contain inline [TODO: …] markers as styled chips. */
export function TodoText({ text }: { text: string }) {
  const parts = text.split(/(\[TODO:[^\]]*\])/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[TODO:') ? <Todo key={i}>{part}</Todo> : part,
      )}
    </>
  );
}

/**
 * Email capture with no backend: submitting opens a prefilled email to us.
 * A plain mailto link sits beside it so the path works without JavaScript.
 */
export function EmailCapture({
  subject,
  cta,
  placeholder = 'you@lab.edu',
}: {
  subject: string;
  cta: string;
  placeholder?: string;
}) {
  const [email, setEmail] = useState('');
  const mailto = (body?: string) =>
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${
      body ? `&body=${encodeURIComponent(body)}` : ''
    }`;
  return (
    <div className="capture">
      <form
        className="capture-form"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = mailto(`Put me on the list: ${email}`);
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          aria-label="Email address"
        />
        <button className="btn" type="submit">{cta}</button>
      </form>
      <p className="capture-note">
        Sends a prefilled email — or write to{' '}
        <a href={mailto()}>{CONTACT_EMAIL}</a> directly.
      </p>
    </div>
  );
}

/** Site-wide footer: email capture, links, and the quiet module back door. */
export function SiteFooter() {
  return (
    <footer className="big-footer">
      <div className="footer-capture">
        <h3>{FOOTER.captureTitle}</h3>
        <EmailCapture subject={RESERVE_SUBJECT} cta="Get in line" />
      </div>
      <div className="footer-links">
        {FOOTER.links.map((l) =>
          l.href ? (
            <a
              key={l.label}
              href={l.href}
              {...(l.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {l.label}
            </a>
          ) : (
            <span key={l.label} className="footer-dead-link">
              {l.label} <Todo>{l.todo!}</Todo>
            </span>
          ),
        )}
      </div>
      <div className="site-footer footer-meta">
        <span>{BRAND} — {new Date().getFullYear()} · Tallinn, Estonia</span>
        <span className="footer-note">{FOOTER_NOTE}</span>
        <a className="footer-modules" href={MODULES_MAILTO}>{FOOTER.modulesLine}</a>
      </div>
    </footer>
  );
}

/**
 * Shell for the sub-pages: fixed header (solid once scrolled, same as home),
 * page content, shared footer. The 3D pages keep their own layout.
 */
export function PageShell({ current, children }: { current: string; children: ReactNode }) {
  useEffect(() => {
    const onScroll = () =>
      document.body.classList.toggle('scrolled', window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="subpage">
      <SiteHeader current={current} />
      <main className="page-main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Standard sub-page opener: kicker, big headline, optional sub. */
export function PageHero({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </section>
  );
}

/** Code card matching the home interface section, with copy button. */
export function CodeCard({ code, lang = 'python', badge }: { code: string; lang?: string; badge?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-card">
      <div className="code-head">
        <span className="code-lang">
          {lang}{badge && <> · <Todo>{badge}</Todo></>}
        </span>
        <button
          className="code-copy"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}
