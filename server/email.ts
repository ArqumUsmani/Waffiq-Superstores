/**
 * Emails to customers: order updates and password resets.
 *
 * Sent over SMTP (Mailgun's, by default — any SMTP server works). The
 * connection is always encrypted: implicit TLS on port 465, STARTTLS
 * required on any other port, and the server's certificate is checked.
 *
 * An email is never allowed to break the thing it reports on — a send that
 * fails or times out is logged and the order carries on. Without the SMTP_*
 * settings (local development) the email is written to the log instead, so
 * the flow can still be followed.
 *
 * Everything a customer typed (their name, a note) is escaped before it goes
 * into the HTML.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from './env.js';

const esc = (value: string | number): string =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const rupees = (amount: number) => `Rs ${amount.toLocaleString('en-PK')}`;

interface Mail {
  to: string;
  subject: string;
  /** Plain paragraphs; also the text version. */
  lines: string[];
  /** Optional table of what was ordered. */
  items?: { name: string; qty: number; price: number }[];
  totals?: { label: string; value: string }[];
  button?: { label: string; url: string };
}

function render(mail: Mail): { html: string; text: string } {
  const rows = (mail.items ?? [])
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e3ecd6">${item.qty} × ${esc(item.name)}</td>` +
        `<td style="padding:6px 0;border-bottom:1px solid #e3ecd6;text-align:right;white-space:nowrap">${rupees(item.price * item.qty)}</td></tr>`,
    )
    .join('');
  const totals = (mail.totals ?? [])
    .map(
      (row, index, all) =>
        `<tr><td style="padding:4px 0;${index === all.length - 1 ? 'font-weight:700' : 'color:#4a6b57'}">${esc(row.label)}</td>` +
        `<td style="padding:4px 0;text-align:right;${index === all.length - 1 ? 'font-weight:700' : ''}">${esc(row.value)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#eef6e2;font-family:Arial,Helvetica,sans-serif;color:#123b26">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <p style="font-size:20px;font-weight:700;margin:0 0 16px;color:#136f37">Wafiq Super Store</p>
  <div style="background:#ffffff;border-radius:16px;padding:24px">
    ${mail.lines.map((line, i) => `<p style="margin:0 0 14px;font-size:${i === 0 ? 18 : 15}px;line-height:1.5;${i === 0 ? 'font-weight:700' : ''}">${esc(line)}</p>`).join('')}
    ${rows || totals ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 16px">${rows}${totals}</table>` : ''}
    ${mail.button ? `<p style="margin:8px 0 0"><a href="${esc(mail.button.url)}" style="display:inline-block;background:#136f37;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(mail.button.label)}</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:#6f8a78;margin:16px 4px 0">Gulberg Arena Mall, Gulberg Greens, Islamabad. You are getting this because of an order or request on your Wafiq account.</p>
</div></body></html>`;
  const text = [
    ...mail.lines,
    ...(mail.items ?? []).map((item) => `${item.qty} x ${item.name} — ${rupees(item.price * item.qty)}`),
    ...(mail.totals ?? []).map((row) => `${row.label}: ${row.value}`),
    ...(mail.button ? [`${mail.button.label}: ${mail.button.url}`] : []),
  ].join('\n');
  return { html, text };
}

/* Kept between requests, like the database pool: a warm function reuses it. */
const holder = globalThis as unknown as { __wafiqMailer?: Transporter };

/** The SMTP connection, or null when it is not configured. */
export function mailer(): Transporter | null {
  const smtp = env.smtp;
  if (!smtp || !env.emailFrom) return null;
  holder.__wafiqMailer ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    /* Never fall back to an unencrypted session: it would carry the password. */
    requireTLS: smtp.port !== 465,
    auth: { user: smtp.user, pass: smtp.pass },
    /* A request is waiting on this; give up rather than hang it. */
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  return holder.__wafiqMailer;
}

async function send(mail: Mail): Promise<void> {
  const { html, text } = render(mail);
  const transport = mailer();
  if (!transport) {
    console.log(`[email not sent — SMTP is not configured] to ${mail.to}: ${mail.subject}\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: env.emailFrom, to: mail.to, subject: mail.subject, html, text });
  } catch (error) {
    console.error(`Email to ${mail.to} failed:`, error instanceof Error ? error.message : error);
  }
}

export interface OrderForEmail {
  number: string;
  status: string;
  fulfilment: 'delivery' | 'pickup';
  contact_name: string;
  address_line: string;
  area: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  items: { name: string; qty: number; price: number }[];
}

/** What each step of an order says to the customer. */
const STATUS_COPY: Record<string, (order: OrderForEmail) => { subject: string; lines: string[] } | null> = {
  placed: (o) => ({
    subject: `We have your order ${o.number}`,
    lines: [
      `Thank you, ${o.contact_name} — your order is in.`,
      o.fulfilment === 'delivery'
        ? `We will call to confirm, then deliver to ${o.address_line}, ${o.area}. Pay cash when it arrives.`
        : 'We will call to confirm, then let you know when it is ready to collect from Gulberg Arena Mall. Pay at the counter.',
    ],
  }),
  confirmed: (o) => ({
    subject: `Order ${o.number} is confirmed`,
    lines: ['Your order is confirmed.', 'We are getting it ready now and will email you again when it is packed.'],
  }),
  packed: (o) => ({
    subject: `Order ${o.number} is packed`,
    lines: [
      'Your order is packed.',
      o.fulfilment === 'delivery' ? 'It will be on its way to you shortly.' : 'We will tell you the moment it is ready at the counter.',
    ],
  }),
  out_for_delivery: (o) => ({
    subject: `Order ${o.number} is on its way`,
    lines: ['Your order is out for delivery.', `Our rider is heading to ${o.address_line}, ${o.area}. Please keep ${rupees(o.total)} in cash ready.`],
  }),
  ready_for_pickup: (o) => ({
    subject: `Order ${o.number} is ready to collect`,
    lines: ['Your order is ready to collect.', `It is waiting at the counter at Gulberg Arena Mall. The total is ${rupees(o.total)}, payable there.`],
  }),
  completed: (o) => ({
    subject: `Order ${o.number} is complete — thank you`,
    lines: ['Your order is complete.', 'Thank you for shopping with Wafiq. Your order is saved in your account, ready to buy again.'],
  }),
  cancelled: (o) => ({
    subject: `Order ${o.number} was cancelled`,
    lines: ['Your order was cancelled.', 'Nothing is owed. If this was not what you wanted, you can place the order again from your account.'],
  }),
};

/** Tells the customer where their order has got to. `origin` is the site's address, for the link. */
export async function sendOrderEmail(to: string | null, order: OrderForEmail, origin: string): Promise<void> {
  const copy = STATUS_COPY[order.status]?.(order);
  if (!to || !copy) return;
  const detailed = order.status === 'placed';
  await send({
    to,
    subject: copy.subject,
    lines: copy.lines,
    items: detailed ? order.items : undefined,
    totals: detailed
      ? [
          { label: 'Subtotal', value: rupees(order.subtotal) },
          ...(order.fulfilment === 'delivery' ? [{ label: 'Delivery', value: order.delivery_fee ? rupees(order.delivery_fee) : 'Free' }] : []),
          { label: 'Total', value: rupees(order.total) },
        ]
      : undefined,
    button: { label: 'Track your order', url: `${origin}/order/${encodeURIComponent(order.number)}` },
  });
}

export async function sendResetEmail(to: string, name: string, link: string): Promise<void> {
  await send({
    to,
    subject: 'Set a new Wafiq password',
    lines: [
      `Hello ${name},`,
      'Someone asked to set a new password for your Wafiq account. If that was you, use the button below within the next hour.',
      'If it was not you, ignore this email — your password stays as it is.',
    ],
    button: { label: 'Set a new password', url: link },
  });
}
