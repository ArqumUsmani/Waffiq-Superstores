/**
 * "Walk the aisle" — the home page's category scene.
 *
 * On desktop the section pins and vertical scroll is converted into
 * horizontal travel past ten aisle stops; the centred aisle scales up and
 * tints the backdrop. Icons stay still unless hovered.
 *
 * Below 1024px, or under reduced motion, the very same markup becomes a
 * native scroll-snap carousel — no pinning, no scroll hijack, nothing to
 * get stuck inside.
 *
 * React renders the panels; the rig owns the ScrollTrigger. The active
 * index deliberately is *not* React state: onUpdate fires on every scroll
 * frame, and re-rendering ten panels at 60Hz to toggle a class would be
 * the one place "use state for state" is the wrong answer.
 */
import { useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { dirFactor } from '../lib/dom';
import { categories, countInCategory } from '../lib/data';
import { pick, t } from '../lib/i18n';
import { useRig } from '../hooks/useRig';
import { useLang } from '../state/app-state';
import { CategoryIcon, type CategoryIconHandle } from './CategoryIcon';
import { useLaunch } from './LaunchProvider';

const TOUCH_LIFT_HOLD_MS = 350;

export function AisleRail() {
  useLang();
  const { launchTo } = useLaunch();
  const icons = useRef<(CategoryIconHandle | null)[]>([]);
  const lastPointerType = useRef('mouse');

  const rootRef = useRig<HTMLElement>((root) => {
    const track = root.querySelector<HTMLElement>('[data-aisle-track]');
    const panels = [...root.querySelectorAll<HTMLElement>('[data-aisle-panel]')];
    const dotNodes = [...root.querySelectorAll<HTMLButtonElement>('.aisle-dot')];
    if (!track || !panels.length) return;

    let active = -1;
    const setActive = (index: number) => {
      if (index === active) return;
      active = index;

      panels.forEach((node, i) => node.classList.toggle('is-active', i === index));
      dotNodes.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-current', String(i === index));
      });

      const category = categories[index];
      if (category) {
        root.style.setProperty('--rail-pastel', category.pastel);
        root.style.setProperty('--rail-accent', category.accent);
      }
    };
    setActive(0);

    let observer: IntersectionObserver | null = null;

    if (motion.allowScenes) {
      /* Desktop: pin the section and scrub the track sideways. */
      const distance = () => track.scrollWidth - root.clientWidth + 80;

      gsap.to(track, {
        x: () => -distance() * dirFactor(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            setActive(Math.round(self.progress * (panels.length - 1)));
          },
        },
      });

      root.dataset.mode = 'pinned';
    } else {
      /* Touch and reduced motion: plain snap carousel. */
      root.dataset.mode = 'carousel';

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.intersectionRatio > 0.6) {
              setActive(Number((entry.target as HTMLElement).dataset.index));
            }
          }
        },
        { root: track, threshold: [0.6] },
      );
      for (const panel of panels) observer.observe(panel);
    }

    /* Dots jump the carousel; in pinned mode they scroll the page to
       that stop, which the pin then converts back into sideways travel. */
    const onDotClick = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-go]');
      if (!button) return;
      const index = Number(button.dataset.go);

      if (root.dataset.mode === 'carousel') {
        panels[index]?.scrollIntoView({
          behavior: motion.reduced ? 'auto' : 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        return;
      }

      const trigger = ScrollTrigger.getAll().find((st) => st.pin === root);
      if (!trigger) return;
      const ratio = index / (panels.length - 1);
      window.scrollTo({
        top: trigger.start + (trigger.end - trigger.start) * ratio,
        behavior: motion.reduced ? 'auto' : 'smooth',
      });
    };

    const dotHost = root.querySelector<HTMLElement>('[data-aisle-dots]');
    dotHost?.addEventListener('click', onDotClick);

    return () => {
      observer?.disconnect();
      dotHost?.removeEventListener('click', onDotClick);
    };
  });

  const activate = (index: number) => {
    const category = categories[index];
    const art = icons.current[index]?.artEl();
    if (!category || !art) return;
    launchTo({ slug: category.slug, sourceEl: art, pastel: category.pastel });
  };

  return (
    <section className="aisle-rail" data-aisle-rail ref={rootRef} aria-labelledby="aisle-title">
      <div className="shell">
        <header className="aisle-rail__head">
          <div>
            <p className="eyebrow">{t('aisle.eyebrow')}</p>
            <h2 id="aisle-title">{t('aisle.title')}</h2>
          </div>
          <p className="lede">{t('aisle.sub')}</p>
        </header>
      </div>

      <div className="shell">
        <div className="aisle-rail__track" data-aisle-track>
          {categories.map((category, index) => (
            <article
              className="aisle"
              key={category.slug}
              data-aisle-panel={category.slug}
              data-index={index}
              style={
                { '--pastel': category.pastel, '--accent': category.accent } as React.CSSProperties
              }
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') icons.current[index]?.pop();
              }}
            >
              <div className="aisle__stage">
                <CategoryIcon
                  category={category}
                  size={200}
                  ref={(handle) => {
                    icons.current[index] = handle;
                  }}
                />
              </div>

              <div className="aisle__body">
                <p className="aisle__index">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="aisle__name">
                  {pick(category as unknown as Record<string, unknown>, 'en')}
                </h3>
                <p className="aisle__blurb">
                  {pick(category as unknown as Record<string, unknown>, 'blurbEn')}
                </p>
                <ul className="aisle__shelves">
                  {category.subcategories.map((sub) => (
                    <li key={sub.slug}>{pick(sub as unknown as Record<string, unknown>, 'en')}</li>
                  ))}
                </ul>

                <a
                  className="btn btn--solid aisle__cta"
                  href={`/aisle/${category.slug}`}
                  onPointerDown={(event) => {
                    lastPointerType.current = event.pointerType;
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    if (lastPointerType.current === 'touch' && !motion.reduced) {
                      icons.current[index]?.pop();
                      window.setTimeout(() => activate(index), TOUCH_LIFT_HOLD_MS);
                      return;
                    }
                    activate(index);
                  }}
                >
                  {t('aisle.open')}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>

                <p className="aisle__count">
                  <strong>{countInCategory(category.slug)}</strong> {t('aisle.products')}
                  <span aria-hidden="true"> · </span>
                  <strong>{category.subcategories.length}</strong> {t('aisle.shelves')}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="aisle-dots" data-aisle-dots role="tablist" aria-label="Aisles">
          {categories.map((category, index) => (
            <button
              type="button"
              className="aisle-dot"
              key={category.slug}
              data-go={index}
              style={{ '--accent': category.accent } as React.CSSProperties}
              aria-label={category.en}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
