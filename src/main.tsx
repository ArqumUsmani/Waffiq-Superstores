/* Latin faces are self-hosted rather than pulled from Google so the first
   paint never waits on a third-party request. The weight axis alone covers
   every weight the design uses — the optical-size and width axes are not
   shipped. */
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/inter/wght.css';

/* Every product card carries an Urdu name, so the Arabic regular weight is
   needed in both languages. The bold stays behind the language switch. */
import '@fontsource/noto-nastaliq-urdu/arabic-400.css';

import './styles/tailwind.css';
import './styles/main.css';
/* Loaded last so its direction-specific overrides win. */
import './styles/rtl.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { dismissSplash } from './lib/boot';
import { loadShop } from './state/shop';
import { initInstall } from './lib/install';

const host = document.getElementById('root');
if (!host) throw new Error('#root is missing from index.html');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* The splash in index.html has been covering the page since the first byte;
   it goes once the fonts and hero are in. */
void dismissSplash();

/* Is the online store switched on? Asked in the background: the site never
   waits for the answer, and no answer means no store. */
void loadShop();

/* The offline worker that makes the site installable. Production only: in
   development it would serve stale modules over Vite's own. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the site works the same without it */
    });
  });
}
initInstall();
