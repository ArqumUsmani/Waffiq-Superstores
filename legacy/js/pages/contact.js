import { $ } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/**
 * The form posts to whatever endpoint `data-endpoint` names. Until a real
 * one is configured it falls back to opening the visitor's mail client,
 * so the page is never a dead end.
 */
export default function contactPage() {
  const form = $('[data-contact-form]');
  if (!form) return null;

  const status = $('[data-form-status]', form);
  const submit = form.querySelector('button[type="submit"]');
  const endpoint = form.dataset.endpoint;

  const say = (message, tone) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);

    if (!endpoint) {
      const subject = encodeURIComponent(`Wafiq enquiry from ${data.get('name') ?? ''}`);
      const body = encodeURIComponent(
        `${data.get('message') ?? ''}\n\n— ${data.get('name') ?? ''} (${data.get('email') ?? ''})`,
      );
      window.location.href = `mailto:${form.dataset.mailto}?subject=${subject}&body=${body}`;
      return;
    }

    submit.disabled = true;
    say(t('contact.sending'), 'pending');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      say(t('contact.sent'), 'ok');
    } catch {
      say(t('contact.error'), 'error');
    } finally {
      submit.disabled = false;
    }
  });

  return null;
}
