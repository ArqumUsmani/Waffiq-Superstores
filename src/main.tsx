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

const host = document.getElementById('root');
if (!host) throw new Error('#root is missing from index.html');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
