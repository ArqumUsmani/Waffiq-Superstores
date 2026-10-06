/**
 * The admin panel's charts, drawn by hand as SVG and plain boxes. There are
 * only three shapes here, which does not justify shipping a chart library.
 */
import { rupees } from '../lib/money';

/** Short money for axis labels: 12.5k, 1.2M. */
export const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

export interface DayPoint {
  day: string;
  revenue: number;
  orders: number;
}

/** Every day in the window, including the ones with no orders. */
export function fillDays(series: DayPoint[], span: number): DayPoint[] {
  const known = new Map(series.map((point) => [point.day, point]));
  /* The API's days are Pakistan dates (UTC+5). */
  const now = new Date(Date.now() + 5 * 3600_000);
  const out: DayPoint[] = [];
  for (let back = span - 1; back >= 0; back -= 1) {
    const day = new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    out.push(known.get(day) ?? { day, revenue: 0, orders: 0 });
  }
  return out;
}

export function RevenueChart({ series }: { series: DayPoint[] }) {
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const top = Math.max(1, ...series.map((p) => p.revenue));
  const step = (W - pad.l - pad.r) / series.length;
  const y = (value: number) => pad.t + (H - pad.t - pad.b) * (1 - value / top);
  const label = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue per day">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} className="adm-chart__grid" />
          <text x={pad.l - 6} y={y(top * f) + 4} textAnchor="end" className="adm-chart__tick">
            {compact(Math.round(top * f))}
          </text>
        </g>
      ))}
      {series.map((point, index) => (
        <g key={point.day}>
          <rect
            className="adm-chart__bar"
            x={pad.l + index * step + step * 0.15}
            width={step * 0.7}
            y={y(point.revenue)}
            height={Math.max(0, H - pad.b - y(point.revenue))}
            rx={Math.min(4, step * 0.2)}
          >
            <title>{`${label(point.day)} — ${rupees(point.revenue)}, ${point.orders} order(s)`}</title>
          </rect>
          {index % Math.ceil(series.length / 6) === 0 ? (
            <text x={pad.l + index * step + step / 2} y={H - 8} textAnchor="middle" className="adm-chart__tick">
              {label(point.day)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Ranked horizontal bars. */
export function Bars({ rows }: { rows: { key: string; label: string; value: number; shown: string; note?: string }[] }) {
  const top = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="adm-empty">Nothing to show for this period yet.</p>;
  return (
    <ol className="adm-bars">
      {rows.map((row) => (
        <li key={row.key}>
          <span className="adm-bars__label" title={row.label}>
            {row.label}
          </span>
          <span className="adm-bars__track">
            <span style={{ width: `${Math.max(2, (row.value / top) * 100)}%` }} />
          </span>
          <span className="adm-bars__value">
            {row.shown}
            {row.note ? <small>{row.note}</small> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Orders by weekday and hour, as a grid that darkens with how busy it was. */
export function BusyGrid({ busy }: { busy: { weekday: number; hour: number; orders: number }[] }) {
  const top = Math.max(1, ...busy.map((cell) => cell.orders));
  const at = new Map(busy.map((cell) => [`${cell.weekday}:${cell.hour}`, cell.orders]));
  /* The shop's day: nothing is ordered at four in the morning. */
  const hours = Array.from({ length: 16 }, (_, i) => i + 8);
  const hour = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  return (
    <div className="adm-busy" role="table" aria-label="Orders by weekday and hour">
      <span />
      {hours.map((h) => (
        <span key={h} className="adm-busy__head">
          {h % 2 === 0 ? hour(h) : ''}
        </span>
      ))}
      {WEEKDAYS.map((name, weekday) => (
        <div key={name} role="row" style={{ display: 'contents' }}>
          <span className="adm-busy__day">{name}</span>
          {hours.map((h) => {
            const n = at.get(`${weekday}:${h}`) ?? 0;
            return (
              <span
                key={h}
                role="cell"
                className="adm-busy__cell"
                style={{ '--heat': n / top } as React.CSSProperties}
                title={`${name} ${hour(h)} — ${n} order(s)`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
