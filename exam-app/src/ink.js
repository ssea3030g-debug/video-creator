import { getStroke } from 'perfect-freehand';

// 단위는 PDF 포인트(pt). 줌과 무관하게 선이 선명하도록 벡터로 저장한다.
export const PEN_SIZE = 1.9;
const cache = new WeakMap();

function opts(st, last) {
  return {
    size: st.size,
    thinning: st.sim ? 0.3 : 0.5,
    smoothing: 0.5,
    streamline: last ? 0.4 : 0.5,
    simulatePressure: st.sim,
    last,
  };
}

const avg = (a, b) => (a + b) / 2;
function svgPath(pts) {
  const n = pts.length;
  if (n < 4) return '';
  let a = pts[0], b = pts[1];
  const c = pts[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < n - 1; i++) {
    a = pts[i];
    b = pts[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + 'Z';
}

function toPts(flat) {
  const out = [];
  for (let i = 0; i < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]);
  return out;
}

/** 완성된 획의 Path2D (캐시) */
export function strokePath(st) {
  let p = cache.get(st);
  if (!p) {
    p = new Path2D(svgPath(getStroke(toPts(st.pts), opts(st, true))));
    cache.set(st, p);
  }
  return p;
}

/** 그리는 중인 획의 Path2D (매 프레임 새로 계산) */
export function livePath(st) {
  return new Path2D(svgPath(getStroke(toPts(st.pts), opts(st, false))));
}

export function bbox(st) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < st.pts.length; i += 3) {
    x0 = Math.min(x0, st.pts[i]); x1 = Math.max(x1, st.pts[i]);
    y0 = Math.min(y0, st.pts[i + 1]); y1 = Math.max(y1, st.pts[i + 1]);
  }
  return [x0, y0, x1, y1];
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx - px, cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** 지우개 원(반지름 r)이 획과 닿는지 */
export function hitStroke(st, x, y, r) {
  const rr = r + st.size / 2;
  const b = st.bb || (st.bb = bbox(st));
  if (x < b[0] - rr || x > b[2] + rr || y < b[1] - rr || y > b[3] + rr) return false;
  const p = st.pts;
  if (p.length === 3) return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= rr * rr;
  for (let i = 0; i + 5 < p.length; i += 3) {
    if (segDist2(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= rr * rr) return true;
  }
  return false;
}
