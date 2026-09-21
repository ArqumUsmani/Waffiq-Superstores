import { $, escapeHtml } from '../lib/dom.js';
import { branches } from '../lib/data.js';
import { initReveals } from '../components/reveal.js';
import { mountReviews } from '../components/reviews.js';
import { t, isRtl, getLang } from '../lib/i18n.js';

const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

/** Today first, so the row people actually want is at the top. */
function orderedHours(hours) {
  if (!Array.isArray(hours) || !hours.length) return [];
  const names = hours.map((h) => h.day);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const start = Math.max(0, names.indexOf(today));
  return [...hours.slice(start), ...hours.slice(0, start)].map((row, i) => ({
    ...row,
    isToday: i === 0,
  }));
}

export default function branchesPage() {
  const host = $('[data-branch-list]');
  if (!host) return null;

  const render = () => {
    const anyPlaceholder = branches.some((b) => b.placeholder);
    const ur = isRtl();

    // One branch reads better as a card beside its map than as a lone
    // tile in a grid built for many.
    const solo = branches.length === 1 && branches[0].embed;

    host.innerHTML = `
      ${anyPlaceholder ? `<p class="notice notice--warn">${escapeHtml(t('branches.placeholder'))}</p>` : ''}
      <div class="${solo ? 'branch-solo' : 'branch-grid'}">
        ${branches
          .map(
            (branch, i) => `
            <article class="branch-card${branch.flagship ? ' is-flagship' : ''}"
                     data-reveal data-reveal-index="${i}">
              <span class="branch-card__pin">${PIN}</span>
              <h2 class="branch-card__name">${escapeHtml(ur ? branch.nameUr : branch.name)}</h2>
              <p class="branch-card__address">${escapeHtml(branch.address)}</p>

              <p class="pill pill--lime branch-card__summary">${escapeHtml(branch.hoursSummary)}</p>

              <details class="branch-hours">
                <summary>${escapeHtml(t('branches.hours'))}</summary>
                <table>
                  <tbody>
                    ${orderedHours(branch.hours)
                      .map(
                        (row) => `
                        <tr${row.isToday ? ' class="is-today"' : ''}>
                          <th scope="row">${escapeHtml(ur ? row.dayUr : row.day)}</th>
                          <td>${escapeHtml(row.open)}</td>
                        </tr>`,
                      )
                      .join('')}
                  </tbody>
                </table>
              </details>

              ${
                branch.phone
                  ? `<dl class="branch-card__facts"><div>
                       <dt>${escapeHtml(t('branches.phone'))}</dt>
                       <dd><a href="tel:${branch.phone.replace(/\s/g, '')}">${escapeHtml(branch.phone)}</a></dd>
                     </div></dl>`
                  : ''
              }

              <a class="btn btn--ghost btn--sm" href="${branch.maps}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(t('branches.directions'))}
              </a>
            </article>`,
          )
          .join('')}
        ${
          solo
            ? `<div class="branch-map" data-reveal data-reveal-index="1">
                 <iframe src="${escapeHtml(branches[0].embed)}" title="${escapeHtml(t('branches.mapTitle'))}"
                   loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                   allowfullscreen></iframe>
               </div>`
            : ''
        }
      </div>`;

    initReveals(host);
  };

  render();
  mountReviews($('[data-reviews]'));

  return {
    refresh() {
      render();
      mountReviews($('[data-reviews]'), { force: true });
    },
  };
}
