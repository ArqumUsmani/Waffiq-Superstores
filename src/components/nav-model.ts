/**
 * The primary nav.
 *
 * In the MPA build these were five separate .html pages. The site is now two
 * routes, so Home is a single scrolling page and the nav targets sections
 * within it — from an aisle page a click routes home first, then scrolls.
 * The *style* of the nav is unchanged; only its hrefs are.
 */
export interface NavItem {
  /** i18n key for the label. */
  key: string;
  /** Section id on the home page. */
  id: string;
}

export const NAV: NavItem[] = [
  { key: 'nav.home', id: 'home' },
  { key: 'nav.categories', id: 'categories' },
  { key: 'nav.reviews', id: 'reviews' },
  { key: 'nav.branches', id: 'branches' },
  { key: 'nav.contact', id: 'contact' },
];
