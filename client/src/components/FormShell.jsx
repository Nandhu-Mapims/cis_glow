import { useEffect, useState } from 'react';

/**
 * Shared building blocks for long ERP entry forms:
 *  - useScrollSpy  — highlights the section currently in view
 *  - FormSectionNav — sticky jump-nav down the side of the form
 *  - FormSection   — a titled section the nav can target and scroll to
 *  - FormActionBar — a sticky action bar pinned to the bottom of the form
 *
 * The form stays a single continuous document (fields never unmount), so native
 * `required` validation still focuses the first invalid control on submit — the
 * reason this is a scroll-spy layout, not a wizard that hides steps.
 */

export function useScrollSpy(ids, active = true) {
  const [activeId, setActiveId] = useState(ids[0] || null);
  const key = ids.join('|');

  useEffect(() => {
    if (!active) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  return activeId;
}

export function FormSectionNav({ sections, activeId, heading = 'Sections' }) {
  const jump = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // The page scrolls inside `.cis-main`, not the window, and a sticky chrome
    // bar overlaps the top of that scroll area. Scroll the real container by the
    // element's offset minus the *measured* chrome height so the section heading
    // lands just below the bar instead of being yanked under it.
    const scroller = el.closest('.cis-main') || document.querySelector('.cis-main');
    if (!scroller) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const chrome = scroller.querySelector('.cis-chrome-sticky');
    const offset = (chrome?.offsetHeight || 0) + 12;
    const top = el.getBoundingClientRect().top
      - scroller.getBoundingClientRect().top
      + scroller.scrollTop
      - offset;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  return (
    <nav className="cis-formnav" aria-label="Form sections">
      <p className="cis-formnav-heading">{heading}</p>
      <ol className="cis-formnav-list">
        {sections.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`cis-formnav-item${activeId === s.id ? ' is-active' : ''}`}
              onClick={() => jump(s.id)}
              aria-current={activeId === s.id ? 'true' : undefined}
            >
              <span className="cis-formnav-num">{i + 1}</span>
              <span className="cis-formnav-label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FormSection({ id, title, description, action = null, children, grid = true }) {
  return (
    <section id={id} className="cis-formsection" aria-labelledby={`${id}-heading`}>
      <header className="cis-formsection-head">
        <div>
          <h2 id={`${id}-heading`} className="cis-formsection-title">{title}</h2>
          {description && <p className="cis-formsection-desc">{description}</p>}
        </div>
        {action && <div className="cis-formsection-action">{action}</div>}
      </header>
      <div className={grid ? 'cis-formsection-body row g-3' : 'cis-formsection-body'}>
        {children}
      </div>
    </section>
  );
}

export function FormActionBar({ note = null, children }) {
  return (
    <div className="cis-formbar">
      {note && <div className="cis-formbar-note">{note}</div>}
      <div className="cis-formbar-actions">{children}</div>
    </div>
  );
}
