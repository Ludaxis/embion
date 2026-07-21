import { useEffect, useState, type ReactNode } from 'react';
import {
  BRAND, PRODUCT_CODE, NAV, CTA, FOOTER, FOOTER_NOTE,
  CONTACT_EMAIL, MODULES_MAILTO, RESERVE_SUBJECT,
} from '../content/product';

/** Fire-and-forget analytics beacon. First-party, no cookies, no IDs.
 *  /api/event forwards to ANALYTICS_WEBHOOK_URL when configured, else 204s. */
export function track(event: string, data?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({ event, path: location.pathname, ...data });
    if (!navigator.sendBeacon?.('/api/event', payload)) {
      fetch('/api/event', { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // analytics must never break the page
  }
}

/** Footnote reference into the numbered sources list on /story#sources. */
export function Fn({ ns, base = '/story/' }: { ns: number[]; base?: string }) {
  return (
    <sup className="fn">
      <a
        href={`${base}#sources`}
        aria-label={`${ns.length === 1 ? 'Source' : 'Sources'} ${ns.join(', ')}`}
      >
        {ns.join(', ')}
      </a>
    </sup>
  );
}

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

type CaptureState = 'idle' | 'sending' | 'ok' | 'error';

/**
 * Email capture. Submissions POST to /api/reserve (stored server-side once
 * SUPABASE_* or RESERVE_WEBHOOK_URL env vars are configured on Vercel). Until
 * then — or on any failure — it falls back to opening a prefilled email, so
 * the path always works. A plain mailto link handles the no-JS case.
 */
export function EmailCapture({
  subject,
  cta,
  kind = 'reserve',
  successCopy = 'You’re in line. We’ll email you before Batch One ships.',
  placeholder = 'you@lab.edu',
}: {
  subject: string;
  cta: string;
  kind?: 'reserve' | 'lab' | 'notify';
  successCopy?: string;
  placeholder?: string;
}) {
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState(''); // honeypot: humans never see or fill it
  const [state, setState] = useState<CaptureState>('idle');
  const mailto = (body?: string) =>
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${
      body ? `&body=${encodeURIComponent(body)}` : ''
    }`;

  const submit = async () => {
    setState('sending');
    track(kind === 'lab' ? 'lab_apply_submit' : kind === 'notify' ? 'notify_submit' : 'reserve_submit');
    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, kind, subject, company: hp }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('ok');
    } catch {
      // Server-side storage not reachable (or not configured yet): hand the
      // reservation to the visitor's email app instead so nothing is lost.
      setState('error');
      window.location.href = mailto(`Put me on the list: ${email}`);
    }
  };

  if (state === 'ok') {
    return <p className="capture capture-success">{successCopy}</p>;
  }

  return (
    <div className="capture">
      <form
        className="capture-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          aria-label="Email address"
          disabled={state === 'sending'}
        />
        <input
          type="text"
          name="company"
          className="hp-field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
        <button className="btn" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : cta}
        </button>
      </form>
      {state === 'error' ? (
        <p className="capture-note" role="status">
          We couldn’t save that automatically, so your email app opened with it
          instead. Or write to <a href={mailto()}>{CONTACT_EMAIL}</a>.
        </p>
      ) : (
        <p className="capture-note">
          No payment, no spam — or write to{' '}
          <a href={mailto()}>{CONTACT_EMAIL}</a> directly.
        </p>
      )}
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
              onClick={l.label === 'Docs' ? () => track('docs_click') : undefined}
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
        {/* build-time year is prerendered; suppress the mismatch if viewed in a later year */}
        <span suppressHydrationWarning>{BRAND} — {new Date().getFullYear()} · Tallinn, Estonia</span>
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
