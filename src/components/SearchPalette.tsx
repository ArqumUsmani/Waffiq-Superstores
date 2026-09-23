/**
 * Global search palette (⌘K / Ctrl+K, or "/").
 *
 * Searches products, aisles and shelves at once over the bundled catalogue,
 * highlights the matched span, and is fully keyboard driven. Portaled to
 * <body> so no transformed ancestor can trap its fixed positioning.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { searchAll, getCategory } from '../lib/data';
import { pick, t } from '../lib/i18n';
import { lockScroll } from '../lib/smooth-scroll';
import { motion } from '../lib/motion-guard';
import { useLang } from '../state/app-state';
import { ProductArt } from './ProductCard';
import { Icon } from './Icon';
import type { MatchRange, SearchResult } from '../lib/types';

const RECENT_KEY = 'wafiq:recent-searches';
const MAX_RECENT = 5;

const readRecent = (): string[] => {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

const writeRecent = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* private mode — history just will not persist */
  }
};

/** Wraps the matched range in <mark>. Plain text otherwise — never markup. */
function highlight(text: string, match: MatchRange | null): ReactNode {
  if (!match || match.start < 0) return text;
  return (
    <>
      {text.slice(0, match.start)}
      <mark>{text.slice(match.start, match.end)}</mark>
      {text.slice(match.end)}
    </>
  );
}

const asRecord = (value: unknown) => value as Record<string, unknown>;

function hrefFor(result: SearchResult): string {
  if (result.kind === 'product') return `/product/${encodeURIComponent(result.id)}`;
  if (result.kind === 'category') return `/aisle/${result.id}`;
  return `/aisle/${result.record.category.slug}`;
}

type Row = { kind: 'term'; term: string } | { kind: 'result'; result: SearchResult };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchPalette({ open, onOpenChange }: Props) {
  useLang();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  /* Global shortcuts: ⌘K / Ctrl+K toggles, "/" opens unless typing. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (event.key === '/' && !open) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  /* Open / close side effects: scroll lock, focus in, focus restore. */
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    document.body.classList.add('has-palette');
    lockScroll(true);
    setQuery('');
    setActive(0);
    setRecent(readRecent());
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      document.body.classList.remove('has-palette');
      lockScroll(false);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  const results = useMemo(
    () => (query.trim().length >= 2 ? searchAll(query, 14) : []),
    [query],
  );

  const rows: Row[] = useMemo(() => {
    if (query.trim().length < 2) return recent.map((term) => ({ kind: 'term', term }));
    return results.map((result) => ({ kind: 'result', result }));
  }, [query, recent, results]);

  /* Keep the active row visible. */
  useEffect(() => {
    resultsRef.current
      ?.querySelector<HTMLElement>('.palette__row.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, rows]);

  const remember = (term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    const next = [clean, ...readRecent().filter((x) => x !== clean)];
    writeRecent(next);
    setRecent(next.slice(0, MAX_RECENT));
  };

  const close = () => onOpenChange(false);

  const go = (href: string) => {
    remember(query);
    close();
    navigate(href);
  };

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === 'term') {
      setQuery(row.term);
      setActive(0);
      inputRef.current?.focus();
      return;
    }
    go(hrefFor(row.result));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (rows.length) setActive((i) => (i + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length) setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Tab') {
      // Keep focus inside the dialog.
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  const aisleName = (slug: string) => pick(asRecord(getCategory(slug)), 'en');

  const renderResult = (result: SearchResult, index: number) => {
    const isActive = index === active;
    const common = {
      className: `palette__row${isActive ? ' is-active' : ''}`,
      role: 'option' as const,
      'aria-selected': isActive,
      tabIndex: -1,
      onMouseEnter: () => setActive(index),
      onClick: (event: React.MouseEvent) => {
        event.preventDefault();
        go(hrefFor(result));
      },
      href: hrefFor(result),
    };

    if (result.kind === 'product') {
      const product = result.record;
      return (
        <a key={`p-${result.id}`} {...common}>
          <span className="palette__art">
            <ProductArt product={product} />
          </span>
          <span className="palette__text">
            <span className="palette__title">{highlight(product.name, result.match)}</span>
            <span className="palette__meta">
              {product.brand} · {product.size} · {aisleName(product.category)}
            </span>
          </span>
          <span className="palette__kind">{t('common.products')}</span>
        </a>
      );
    }

    const isAisle = result.kind === 'category';
    const record = result.record;
    const swatch = isAisle ? result.record.pastel : result.record.category.pastel;
    const meta = isAisle
      ? `${result.record.subcategories.length} ${t('aisle.shelves')}`
      : aisleName(result.record.category.slug);

    return (
      <a key={`${result.kind}-${result.id}`} {...common}>
        <span
          className="palette__art palette__art--swatch"
          style={{ '--swatch': swatch } as React.CSSProperties}
        />
        <span className="palette__text">
          <span className="palette__title">{highlight(record.en, result.match)}</span>
          <span className="palette__meta">{meta}</span>
        </span>
        <span className="palette__kind">{isAisle ? t('product.aisle') : t('product.shelf')}</span>
      </a>
    );
  };

  let body: ReactNode;
  if (query.trim().length < 2) {
    body = recent.length ? (
      <>
        <div className="palette__section">
          <h3>{t('search.recent')}</h3>
          <button
            type="button"
            onClick={() => {
              writeRecent([]);
              setRecent([]);
            }}
          >
            {t('search.clearRecent')}
          </button>
        </div>
        {recent.map((term, index) => (
          <button
            key={term}
            type="button"
            className={`palette__row palette__row--term${index === active ? ' is-active' : ''}`}
            role="option"
            aria-selected={index === active}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose({ kind: 'term', term })}
          >
            <span
              className="palette__art palette__art--swatch"
              style={{ '--swatch': 'var(--color-lime)' } as React.CSSProperties}
            />
            <span className="palette__text">
              <span className="palette__title">{term}</span>
            </span>
          </button>
        ))}
      </>
    ) : (
      <p className="palette__empty">{t('search.empty')}</p>
    );
  } else if (!results.length) {
    body = (
      <p className="palette__empty">
        <strong>{t('search.noResults')}</strong>
        <span>{t('search.noResultsBody')}</span>
      </p>
    );
  } else {
    body = results.map(renderResult);
  }

  return createPortal(
    <div className={`palette${motion.reduced ? ' is-plain' : ''}`} id="search-palette" onKeyDown={onKeyDown}>
      <div className="palette__scrim" onClick={close} />
      <div className="palette__panel" role="dialog" aria-modal="true" aria-label={t('search.title')}>
        <div className="palette__field">
          <Icon name="search" />
          <input
            ref={inputRef}
            className="palette__input"
            type="search"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-label={t('search.title')}
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
          />
          <button className="pill pill--quiet" type="button" onClick={close}>
            Esc
          </button>
        </div>

        <div
          className="palette__results"
          id="palette-results"
          role="listbox"
          aria-label={t('search.title')}
          ref={resultsRef}
        >
          {body}
        </div>

        <div className="palette__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('search.hintNav')}
          </span>
          <span>
            <kbd>↵</kbd> {t('search.hintOpen')}
          </span>
          <span>
            <kbd>esc</kbd> {t('search.hintClose')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
