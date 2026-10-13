import * as Q from '../maths/quadratic.js';
import { fitCanvas, theme, clear, line, text, para, niceStep } from '../lib/canvas.js';
import { section, slider, choice, buttons, readouts, el } from '../lib/controls.js';
import { createClock } from '../lib/clock.js';
import { fixed } from '../lib/format.js';

export const equations = [
  { html: '(m<sub>1</sub><i>x</i> + b<sub>1</sub>)(m<sub>2</sub><i>x</i> + b<sub>2</sub>) = m<sub>1</sub>m<sub>2</sub><i>x</i><sup>2</sup> + (m<sub>1</sub>b<sub>2</sub> + b<sub>1</sub>m<sub>2</sub>)<i>x</i> + b<sub>1</sub>b<sub>2</sub>', what: 'expanding: every term in one bracket times every term in the other' },
  { html: 'y = a(<i>x</i> − r)(<i>x</i> − s)', what: 'factored form: the zeros are r and s, one from each factor' },
  { html: '<i>x</i> = (r + s) ÷ 2', what: 'the vertex is halfway between the zeros' },
  { html: 'revenue = price × number sold, &nbsp; area = width × length', what: 'where the two linear expressions come from' },
];

export const prompts = [
  'Read the theatre problem. Before pressing Next, write the expression for the price and the expression for the tickets sold on paper. Which one goes up as x goes up?',
  'Slide x in the theatre problem. One side of the rectangle grows while the other shrinks. Where does the area stop growing?',
  'The theatre zeros are x = −24 and x = 40. Without expanding, how do you know the best x is 8?',
  'Change the tickets lost per increase from 10 to 20. Predict whether the best price goes up or down, then check.',
  'In the fence problem the best pen always uses half the fence for the length. Try three fence lengths, then explain why.',
  'In the path problem the vertex is at a negative x. Why does it not answer the question, and what do you solve instead?',
];

export const legend = [
  { color: 'series-a', label: 'the product, drawn as an area' },
  { color: 'stat', label: 'the x you are trying' },
  { color: 'series-b', label: 'zeros and vertex (after the last step)' },
];

export const tallOnMobile = true;

// ---- writing numbers and terms the way a student does ----
const M = '−';
const r = Q.rat;
const val = ([n, d]) => n / d;
const absR = ([n, d]) => [Math.abs(n), d];
const fromSlider = (v) => r(Math.round(v * 2), 2); // sliders step by 0.5 at the finest
const XH = '<i>x</i>';
const X2H = '<i>x</i><sup>2</sup>';
const m = (s) => `<span class="math">${s}</span>`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Decimal places a fraction needs to terminate, or −1 if it never does.
function places([, d]) {
  for (let k = 0; k <= 6; k++) if (10 ** k % d === 0) return k;
  return -1;
}

// 0.5 and 12 as decimals; 40/3 stays a fraction (stacked in the step list).
function num(f, html) {
  const k = places(f);
  if (k >= 0) return fixed(val(f), k);
  const [n, d] = absR(f);
  return (f[0] < 0 ? M : '') + (html ? `<span class="fr"><span>${n}</span><span>${d}</span></span>` : `${n}/${d}`);
}

// A quantity with its unit. Money shows cents; a value that does not terminate is marked ≈.
function qty(f, unit) {
  const k = places(f);
  const v = val(f);
  if (unit === '$') return `${k < 0 || k > 2 ? '≈ ' : ''}${v < 0 ? M : ''}$${fixed(Math.abs(v), k === 0 ? 0 : 2)}`;
  return `${k < 0 ? '≈ ' : ''}${fixed(v, k < 0 ? 2 : k)}${unit ? ` ${unit}` : ''}`;
}

// [[coefficient, variable]], skipping zero terms and writing 1x as x
function terms(list, html) {
  let out = '';
  for (const [c, v] of list) {
    if (c[0] === 0) continue;
    const a = absR(c);
    const body = v && a[0] === 1 && a[1] === 1 ? v : num(a, html) + v;
    out += out === '' ? (c[0] < 0 ? M : '') + body : (c[0] < 0 ? ` ${M} ` : ' + ') + body;
  }
  return out || '0';
}
// Constant first, the order a word problem gives it: 12 + 0.5x.
const lin = ([mm, b], html) => terms([[b, ''], [mm, html ? XH : 'x']], html);
const bracket = (f, html) => (f[1][0] === 0 ? lin(f, html) : `(${lin(f, html)})`);
const isX = (f) => f[1][0] === 0 && f[0][0] === 1 && f[0][1] === 1;
// 12 + 0.5(8), or nothing when the factor is x itself
const sub = (f, x) => (isX(f) ? '' : terms([[f[1], ''], [f[0], `(${num(x, true)})`]], true));
// a = b = c, except that a rounded value follows its ≈ instead of an = sign
const chain = (parts) => parts.filter(Boolean).reduce((out, s) => `${out}${s.startsWith('≈') ? ' ' : ' = '}${s}`);
const about = (s) => s.replace(/≈ /g, 'about ');

// ---- the three problem types ----
// `make(p)` turns the slider values into the two lines [m, b] and the wording.
const SCENARIOS = {
  revenue: {
    label: 'Revenue: price × tickets sold',
    names: ['price', 'tickets sold'],
    units: ['$', ''],
    product: 'revenue',
    sym: 'R',
    pUnit: '$',
    best: 'Greatest revenue',
    ghost: 'now',
    params: [
      { id: 'P', label: 'Price now ($)', min: 5, max: 30, step: 1, value: 12 },
      { id: 's', label: 'Each price increase ($)', min: 0.5, max: 5, step: 0.5, value: 0.5 },
      { id: 'N', label: 'Tickets sold now', min: 100, max: 600, step: 10, value: 400 },
      { id: 'k', label: 'Tickets lost per increase', min: 10, max: 50, step: 5, value: 10 },
    ],
    x: { min: -10, max: 60, step: 1, value: 0 },
    make(p) {
      const s = qty(fromSlider(p.s), '$');
      return {
        f: [fromSlider(p.s), r(p.P)],
        g: [r(-p.k), r(p.N)],
        problem: `A theatre sells ${p.N} tickets at $${p.P} each. A survey says every ${s} increase in the price loses ${p.k} ticket sales. What price gives the greatest revenue, and what is that revenue?`,
        letX: `Let ${m(XH)} = the number of ${s} price increases.`,
        why: `Each increase adds ${s} to the price and takes ${p.k} off the tickets sold. Each changes by the same amount every time, so each is linear.`,
        atZero: 'the revenue now, before any price change',
        zeroMeans: ['the price would be $0', 'nobody buys a ticket'],
        domainNote: 'Outside it the price or the tickets sold would be negative. A negative <i>x</i> is a price cut.',
        answer: (L) => `Charge ${qty(L.at[0], '$')} a ticket. Then ${qty(L.at[1], '')} tickets sell, for the greatest revenue, ${qty(L.q, '$')}.${L.p[1] === 1 ? '' : ' If only whole price changes are allowed, compare the whole numbers on either side of this <i>x</i>.'}`,
      };
    },
  },
  fence: {
    label: 'Area: a pen against a wall',
    names: ['width', 'length'],
    units: ['m', 'm'],
    product: 'area',
    sym: 'A',
    pUnit: 'm²',
    best: 'Greatest area',
    equal: true,
    wall: true,
    strict: true,
    params: [{ id: 'L', label: 'Fencing (m)', min: 20, max: 120, step: 4, value: 60 }],
    x: { min: 0, max: 60, step: 1, value: 5 },
    make(p) {
      return {
        f: [r(1), r(0)],
        g: [r(-2), r(p.L)],
        problem: `A farmer has ${p.L} m of fencing for a rectangular pen along a barn wall. The wall is one side, so the fence makes the other three. What dimensions give the greatest area?`,
        letX: `Let ${m(XH)} = the width of the pen in metres: each of the two sides that meet the wall.`,
        why: `The two widths use ${m(`2${XH}`)} metres of fence. What is left, ${m(`${p.L} ${M} 2${XH}`)}, is the length.`,
        zeroMeans: ['the pen has no width', 'the widths use all the fence, so there is no length'],
        domainNote: 'Both the width and the length must be positive.',
        answer: (L) => `Make the width ${qty(L.at[0], 'm')} and the length ${qty(L.at[1], 'm')}, for the greatest area, ${qty(L.q, 'm²')}.`,
      };
    },
  },
  border: {
    label: 'Area: a path around a garden',
    names: ['total width', 'total length'],
    units: ['m', 'm'],
    product: 'total area',
    sym: 'A',
    pUnit: 'm²',
    best: 'Path width',
    ghost: 'garden',
    equal: true,
    centre: true,
    params: [
      { id: 'W', label: 'Garden width (m)', min: 10, max: 40, step: 1, value: 20 },
      { id: 'H', label: 'Garden length (m)', min: 10, max: 40, step: 1, value: 30 },
      { id: 'T', label: 'Area of the path (m²)', min: 40, max: 2000, step: 4, value: 464 },
    ],
    x: { min: 0, max: 10, step: 0.5, value: 2 },
    make(p) {
      return {
        f: [r(2), r(p.W)],
        g: [r(2), r(p.H)],
        target: p.T,
        problem: `A ${p.W} m by ${p.H} m garden gets a path of the same width all the way around. The path covers ${fixed(p.T, 0)} m². How wide is the path?`,
        letX: `Let ${m(XH)} = the width of the path in metres.`,
        why: `The path adds ${m(XH)} at both ends, so each dimension grows by ${m(`2${XH}`)}.`,
        atZero: 'the garden alone, with no path',
        domainNote: 'A path cannot have a negative width. From <i>x</i> = 0 the total area only grows as the path widens.',
      };
    },
  },
};

// The table of products: one row per term of the first factor, one column per term of the second.
function gridHtml({ f, g }, L) {
  const one = (c, v) => terms([[c, v]], true);
  const cols = [[g[1], ''], [g[0], XH]];
  const rows = [
    [f[1], '', [[L.last, ''], [L.inner, XH]]],
    [f[0], XH, [[L.outer, XH], [L.first, X2H]]],
  ].filter(([c]) => c[0] !== 0);
  const keep = cols.map(([c]) => c[0] !== 0);
  const head = `<tr><th>×</th>${cols.filter((_, i) => keep[i]).map(([c, v]) => `<th>${one(c, v)}</th>`).join('')}</tr>`;
  const body = rows.map(([c, v, cells]) => `<tr><th>${one(c, v)}</th>${cells.filter((_, i) => keep[i]).map(([cc, vv]) => `<td>${one(cc, vv)}</td>`).join('')}</tr>`).join('');
  return `<table class="grid2">${head}${body}</table>`;
}

function buildSteps(sc, model, L) {
  const { f, g } = model;
  const [n1, n2] = sc.names;
  const S = `<i>${sc.sym}</i>`;
  const up = L.a[0] > 0; // only the path problem opens up; its domain starts at x = 0
  const [zl, zh] = val(L.zeros[0]) <= val(L.zeros[1]) ? L.zeros : [L.zeros[1], L.zeros[0]];
  const le = sc.strict ? '<' : '≤';
  const dom = up
    ? { lo: 0, hi: Infinity, text: 'x ≥ 0', html: `${XH} ≥ 0` }
    : { lo: val(zl), hi: val(zh), text: `${num(zl)} ${le} x ${le} ${num(zh)}`, html: `${num(zl, true)} ${le} ${XH} ${le} ${num(zh, true)}` };
  const std = (html) => terms([[L.a, html ? X2H : 'x²'], [L.b, html ? XH : 'x'], [L.c, '']], html);
  const product = `${bracket(f, true)}${bracket(g, true)}`;
  const xTerms = [L.inner, L.outer].filter((c) => c[0] !== 0);

  const steps = [
    { t: 'Read the problem', m: '', w: model.problem },
    { t: 'Choose the variable', m: '', w: `${model.letX} Everything else gets written in terms of ${m(XH)}.` },
    { t: 'Write the two linear expressions', m: `${n1} = ${lin(f, true)}<br>${n2} = ${lin(g, true)}`, w: model.why },
    { t: 'Multiply them', m: `${S} = ${product}`, w: `${cap(sc.product)} = ${n1} × ${n2}.` },
    {
      t: 'Expand: every term times every term',
      m: `${gridHtml(model, L)}${S} = ${terms([[L.last, ''], [L.inner, XH], [L.outer, XH], [L.first, X2H]], true)}`,
      w: 'Each box is its row label times its column label. Add the boxes.',
    },
    {
      t: 'Collect like terms',
      m: `${S} = ${std(true)}`,
      w: `${xTerms.length === 2 ? `${m(`${terms(xTerms.map((c) => [c, XH]), true)} = ${terms([[L.b, XH]], true)}`)}. ` : ''}This is standard form with ${m(`a = ${num(L.a, true)}`)}, so the parabola opens ${up ? 'up' : 'down'}.`,
    },
  ];

  const zero = (fac, z, means) => (isX(fac) ? m(`${XH} = 0`) : `${m(`${lin(fac, true)} = 0`)} gives ${m(`${XH} = ${num(z, true)}`)}`) + (means ? ` (${means})` : '');
  const pH = `${num(L.p, true)}${places(L.p) < 0 ? ` ≈ ${fixed(val(L.p), 2)}` : ''}`;
  const items = [];
  if (L.c[0] !== 0) items.push(`When ${m(`${XH} = 0`)}, ${m(`${S} = ${num(L.c, true)}`)}: ${model.atZero}. This is the <i>y</i>-intercept.`);
  if (up) {
    items.push(`Zeros, one from each factor: ${zero(f, L.zeros[0])}; ${zero(g, L.zeros[1])}. Both are negative, so no real path makes the area zero.`);
    items.push(`The vertex is halfway between the zeros, at ${m(`${XH} = ${pH}`)}. ${m(`a = ${num(L.a, true)}`)} is positive, so it is a minimum, but it is outside the domain.`);
    items.push(`Domain: ${m(dom.html)}. ${model.domainNote}`);
  } else {
    items.push(`Zeros, one from each factor: ${zero(f, L.zeros[0], model.zeroMeans[0])}; ${zero(g, L.zeros[1], model.zeroMeans[1])}.`);
    items.push(`The vertex is halfway between the zeros: ${m(`${XH} = (${num(zl, true)} + ${num(zh, true)}) ÷ 2 = ${pH}`)}.`);
    const q1 = qty(L.at[0], sc.units[0]);
    const q2 = qty(L.at[1], sc.units[1]);
    const rounded = q1.startsWith('≈') || q2.startsWith('≈');
    const total = qty(L.q, sc.pUnit).replace(/^(?!≈)/, rounded ? '≈ ' : '');
    items.push(`There, ${m(chain([n1, sub(f, L.p), q1]))} and ${m(chain([n2, sub(g, L.p), q2]))}, so ${m(chain([S, `${q1} × ${q2}`.replace(/≈ /g, ''), total]))}. ${m(`a = ${num(L.a, true)}`)} is negative, so this is the maximum.`);
    items.push(`Domain: ${m(dom.html)}. ${model.domainNote}`);
    items.push(`<b>Answer.</b> ${about(model.answer(L))}`);
  }
  steps.push({ t: 'Interpret the quadratic', m: `${S} = ${std(true)} = ${product}`, w: `<ul class="read-off">${items.map((s) => `<li>${s}</li>`).join('')}</ul>` });

  let solved = null;
  if (model.target !== undefined) {
    // total area − garden = path area, so ax² + bx − T = 0 (whole a and b here)
    const T = model.target;
    const sol = Q.xIntercepts(L.a[0], L.b[0], -T);
    const w1 = Q.linearAt(f, sol.exact?.[1] ?? r(0));
    const w2 = Q.linearAt(g, sol.exact?.[1] ?? r(0));
    solved = sol.exact ? qty(sol.exact[1], 'm') : `≈ ${fixed(sol.approx[1], 2)} m`;
    const roots = sol.exact
      ? `${m(`${XH} = ${num(sol.exact[1], true)}`)} or ${m(`${XH} = ${num(sol.exact[0], true)}`)}`
      : `${m(`${XH} ≈ ${fixed(sol.approx[1], 2)}`)} or ${m(`${XH} ≈ ${fixed(sol.approx[0], 2)}`)}`;
    steps.push({
      t: 'Answer the question',
      m: `${product} ${M} ${num(L.c, true)} = ${fixed(T, 0)}<br>${terms([[L.a, X2H], [L.b, XH], [r(-T), '']], true)} = 0`,
      w: `The path is the total area minus the garden. Solve by factoring or with the quadratic formula: ${roots}. A width cannot be negative, so <b>the path is ${about(solved)} wide</b>.${sol.exact ? ` Check: ${m(`${num(w1, true)} × ${num(w2, true)} ${M} ${num(L.c, true)} = ${fixed(T, 0)}`)}.` : ''}`,
    });
  }
  return { steps, dom, std: `${sc.sym} = ${std(false)}`, solved };
}

// ---- drawing ----
function label(ctx, str, x, y, { rot = 0, ...o } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  text(ctx, str, 0, 0, { align: 'center', ...o });
  ctx.restore();
}

function tile(ctx, x, y, w, h, color, { fill = 0.18, width = 1.5, dash } = {}) {
  ctx.save();
  ctx.globalAlpha = fill;
  ctx.fillStyle = color;
  if (fill) ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// The product as a rectangle: the first factor across, the second down.
function drawShape(ctx, R, sc, model, x, v1, v2, pr) {
  const th = theme();
  const padL = sc.wall ? 36 : 14;
  const padT = 30;
  const padR = 34;
  const padB = 56;
  const aw = R.w - padL - padR;
  const ah = R.h - padT - padB;
  const cx = R.x + R.w / 2;
  const a1 = val(v1);
  const a2 = val(v2);
  if (a1 < 0 || a2 < 0) {
    para(ctx, `x = ${num(x)} is outside the domain: the ${sc.names[a1 < 0 ? 0 : 1]} would be negative.`, cx, R.y + R.h / 2 - 10, R.w - 40, { color: th.danger, size: 15 });
    return;
  }
  // scale to the largest value each factor reaches on the slider while both stay positive
  let max1 = 0;
  let max2 = 0;
  for (let t = sc.x.min; t <= sc.x.max; t += sc.x.step) {
    const b1 = val(Q.linearAt(model.f, fromSlider(t)));
    const b2 = val(Q.linearAt(model.g, fromSlider(t)));
    if (b1 >= 0 && b2 >= 0) {
      max1 = Math.max(max1, b1);
      max2 = Math.max(max2, b2);
    }
  }
  let k1 = aw / (max1 || 1);
  let k2 = ah / (max2 || 1);
  if (sc.equal) k1 = k2 = Math.min(k1, k2);
  const wpx = a1 * k1;
  const hpx = a2 * k2;
  const g1 = val(model.f[1]) * k1; // the rectangle at x = 0
  const g2 = val(model.g[1]) * k2;
  const ox = sc.centre ? R.x + padL + (aw - wpx) / 2 : R.x + padL;
  const oy = sc.centre ? R.y + padT + (ah - hpx) / 2 : R.y + padT;

  if (sc.wall) {
    line(ctx, ox - 4, R.y + padT - 8, ox - 4, R.y + padT + ah + 8, { color: th.muted, width: 6 });
    label(ctx, 'barn wall', ox - 20, R.y + padT + ah / 2, { rot: -Math.PI / 2, color: th.muted, size: 12 });
  }
  tile(ctx, ox, oy, wpx, hpx, th.seriesA, { fill: 0.2, width: 2 });
  if (sc.ghost && g1 > 0 && g2 > 0) {
    const gx = sc.centre ? R.x + padL + (aw - g1) / 2 : ox;
    const gy = sc.centre ? R.y + padT + (ah - g2) / 2 : oy;
    if (sc.centre) {
      ctx.fillStyle = th.surface;
      ctx.fillRect(gx, gy, g1, g2);
      tile(ctx, gx, gy, g1, g2, th.seriesB, { fill: 0.22 });
      label(ctx, sc.ghost, gx + g1 / 2, gy + g2 / 2, { color: th.muted, size: 12 });
    } else {
      tile(ctx, gx, gy, g1, g2, th.muted, { fill: 0, width: 1.2, dash: [5, 4] });
      text(ctx, sc.ghost, gx + 6, gy + g2 - 10, { color: th.muted, size: 11 });
    }
  }
  const q1 = qty(v1, sc.units[0]);
  const q2 = qty(v2, sc.units[1]);
  label(ctx, `${sc.names[0]}: ${q1}`, Math.min(Math.max(ox + wpx / 2, R.x + 76), R.x + R.w - 76), oy - 13, { size: 13 });
  // kept below the top edge, so a long side label never runs into the top one
  const side = `${sc.names[1]}: ${q2}`;
  label(ctx, side, ox + wpx + 15, Math.max(oy + hpx / 2, oy + 8 + ctx.measureText(side).width / 2), { rot: -Math.PI / 2, size: 13 });
  label(ctx, `${sc.product} = ${q1} × ${q2} = ${qty(pr, sc.pUnit)}`, cx, R.y + R.h - 32, { size: 14, weight: 700 });
  label(ctx, `at x = ${num(x)}`, cx, R.y + R.h - 12, { size: 12, color: th.muted });
}

// The product against x. The part outside the domain is shaded; the zeros,
// the vertex and the axis of symmetry appear once the steps are done.
function drawGraph(ctx, R, sc, L, dom, x, pr, done) {
  const th = theme();
  const [a, b, c] = [L.a, L.b, L.c].map(val);
  const zs = L.zeros.map(val);
  const up = a > 0;
  const span = Math.abs(zs[1] - zs[0]) || 4;
  const xMin = up ? Math.min(...zs) - 2 : Math.min(...zs) - span * 0.08;
  const xMax = up ? sc.x.max + 1 : Math.max(...zs) + span * 0.08;
  const pts = [];
  let yMin = 0;
  let yMax = 0;
  for (let i = 0; i <= 200; i++) {
    const t = xMin + ((xMax - xMin) * i) / 200;
    const y = Q.evaluate(a, b, c, t);
    pts.push([t, y]);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  const pad = (yMax - yMin) * 0.08 || 1;
  yMin -= pad;
  yMax += pad;
  const l = R.x + 52;
  const rr = R.x + R.w - 10;
  const t = R.y + 22;
  const bt = R.y + R.h - 24;
  const sx = (u) => l + ((u - xMin) / (xMax - xMin)) * (rr - l);
  const sy = (y) => t + ((yMax - y) / (yMax - yMin)) * (bt - t);
  const tick = (u) => fixed(+u.toFixed(6), 0);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = th.grid;
  if (dom.lo > xMin) ctx.fillRect(l, t, sx(dom.lo) - l, bt - t);
  if (dom.hi < xMax) ctx.fillRect(sx(dom.hi), t, rr - sx(dom.hi), bt - t);
  ctx.restore();

  const xs = niceStep(xMax - xMin, 7);
  const ys = niceStep(yMax - yMin, 6);
  for (let u = Math.ceil(xMin / xs) * xs; u <= xMax + 1e-9; u += xs) {
    line(ctx, sx(u), t, sx(u), bt, { color: th.grid, width: 1 });
    text(ctx, tick(u), sx(u), bt + 12, { color: th.muted, size: 11, align: 'center' });
  }
  for (let y = Math.ceil(yMin / ys) * ys; y <= yMax + 1e-9; y += ys) {
    line(ctx, l, sy(y), rr, sy(y), { color: th.grid, width: 1 });
    text(ctx, tick(y), l - 6, sy(y), { color: th.muted, size: 11, align: 'right' });
  }
  line(ctx, l, sy(0), rr, sy(0), { color: th.muted, width: 1.2 });
  if (xMin < 0 && xMax > 0) line(ctx, sx(0), t, sx(0), bt, { color: th.muted, width: 1.2 });
  text(ctx, `${sc.product} (${sc.pUnit})`, l, R.y + 8, { color: th.muted, size: 11 });
  text(ctx, 'x', rr - 2, sy(0) - 9, { color: th.muted, size: 12, align: 'right' });

  const pv = val(L.p);
  if (done && pv >= xMin && pv <= xMax) line(ctx, sx(pv), t, sx(pv), bt, { color: th.seriesB, width: 1.4, dash: [5, 4] });
  ctx.save();
  ctx.beginPath();
  ctx.rect(l, t, rr - l, bt - t);
  ctx.clip();
  ctx.strokeStyle = th.seriesA;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  pts.forEach(([u, y], i) => (i ? ctx.lineTo(sx(u), sy(y)) : ctx.moveTo(sx(u), sy(y))));
  ctx.stroke();
  ctx.restore();

  const dot = (u, y, rad, color, open) => {
    ctx.beginPath();
    ctx.arc(sx(u), sy(y), rad, 0, Math.PI * 2);
    ctx.fillStyle = open ? th.surface : color;
    ctx.fill();
    if (open) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  };
  if (done) {
    for (const z of zs) dot(z, 0, 4.5, th.seriesB, true);
    dot(pv, val(L.q), 6, th.seriesB);
    const vx = sx(pv);
    const vy = sy(val(L.q));
    const right = vx > (l + rr) / 2;
    text(ctx, `(${num(L.p)}, ${num(L.q)})`, right ? vx - 10 : vx + 10, Math.max(t + 10, Math.min(bt - 10, up ? vy - 30 : vy + 18)), { size: 13, align: right ? 'right' : 'left' });
  }
  const xv = val(x);
  const yv = val(pr);
  if (xv >= xMin && xv <= xMax && yv >= yMin && yv <= yMax) {
    line(ctx, sx(xv), sy(0), sx(xv), sy(yv), { color: th.stat, width: 1.2, dash: [3, 3] });
    line(ctx, l, sy(yv), sx(xv), sy(yv), { color: th.stat, width: 1.2, dash: [3, 3] });
    dot(xv, yv, 5, th.stat);
  }
}

export function mount(ui) {
  const pick = choice(section(ui.controls, 'Problem'), {
    label: 'Type',
    options: Object.entries(SCENARIOS).map(([value, s]) => ({ value, label: s.label })),
    value: 'revenue',
  });
  const LATE = ['std', 'zeros', 'vertex', 'best', 'domain'];
  const panels = {};
  for (const [id, s] of Object.entries(SCENARIOS)) {
    const box = section(ui.controls, 'Numbers in the problem');
    const sl = {};
    for (const p of s.params) sl[p.id] = slider(box, p);
    const xs = slider(box, { label: 'Try a value of <i>x</i>', ...s.x });
    const wrap = el('div', {}, ui.readouts);
    const out = readouts(wrap, [
      { id: 'f1', label: `${cap(s.names[0])} at this <i>x</i>` },
      { id: 'f2', label: `${cap(s.names[1])} at this <i>x</i>` },
      { id: 'prod', label: `${cap(s.product)} at this <i>x</i>` },
      { id: 'std', label: 'Expanded' },
      { id: 'zeros', label: 'Zeros' },
      { id: 'vertex', label: 'Vertex' },
      { id: 'best', label: s.best },
      { id: 'domain', label: 'Domain' },
    ]);
    panels[id] = { box, sl, xs, wrap, out };
  }

  ui.steps.hidden = false;
  const head = el('div', { class: 'steps-head' }, ui.steps);
  el('h2', { text: 'From the words to the quadratic' }, head);
  const [prevB, nextB, allB, resetB] = buttons(head, [
    { label: '← Back', onClick: () => go(cur - 1) },
    { label: 'Next step →', onClick: () => go(cur + 1), primary: true },
    { label: 'Show all', onClick: () => go(Infinity) },
    { label: 'Start over', onClick: () => go(0) },
  ]);
  const count = el('span', { class: 'steps-count' }, head);
  const list = el('ol', { class: 'steps-list' }, ui.steps);

  const canvas = fitCanvas(ui.canvas);
  createClock(ui.transport, { frame: draw });
  ui.transport.hidden = true; // nothing runs in simulated time

  let key = '';
  let model = null;
  let L = null;
  let built = null;
  let cur = 0;

  function go(i) {
    cur = Math.max(0, Math.min(built.steps.length - 1, i));
    renderSteps();
  }

  function renderSteps() {
    const { steps } = built;
    list.innerHTML = '';
    steps.forEach((s, i) => {
      if (i > cur) return;
      el('li', { class: i === cur ? 'now' : 'past', html: `<div class="step-title">${s.t}</div><div class="step-math">${s.m}</div><div class="step-why">${s.w}</div>` }, list);
    });
    if (cur < steps.length - 1) el('li', { class: 'ghost', html: `<div class="step-title">Next: ${steps[cur + 1].t}</div><div class="step-why">Try it on paper first, then press Next step.</div>` }, list);
    count.textContent = `Step ${cur + 1} of ${steps.length}`;
    prevB.disabled = resetB.disabled = cur === 0;
    nextB.disabled = allB.disabled = cur === steps.length - 1;
  }

  function draw() {
    const id = pick.value;
    const sc = SCENARIOS[id];
    const P = panels[id];
    for (const [pid, p] of Object.entries(panels)) p.box.hidden = p.wrap.hidden = pid !== id;
    const vals = Object.fromEntries(sc.params.map((p) => [p.id, P.sl[p.id].value]));
    const k = id + JSON.stringify(vals);
    if (k !== key) {
      key = k;
      model = sc.make(vals);
      L = Q.linearProduct(model.f, model.g);
      built = buildSteps(sc, model, L);
      cur = 0;
      renderSteps();
    }

    const x = fromSlider(P.xs.value);
    const v1 = Q.linearAt(model.f, x);
    const v2 = Q.linearAt(model.g, x);
    const pr = Q.productAt(model.f, model.g, x);
    const done = cur === built.steps.length - 1;

    const { ctx, w, h } = canvas;
    const th = theme();
    clear(ctx, w, h);
    const narrow = w < 620;
    const shapeR = narrow ? { x: 4, y: 4, w: w - 8, h: h * 0.52 } : { x: 6, y: 6, w: w * 0.5, h: h - 12 };
    const graphR = narrow ? { x: 8, y: h * 0.54, w: w - 16, h: h * 0.46 - 6 } : { x: w * 0.52, y: 12, w: w * 0.48 - 12, h: h - 24 };
    drawShape(ctx, shapeR, sc, model, x, v1, v2, pr);
    if (!narrow) line(ctx, w * 0.51, 16, w * 0.51, h - 16, { color: th.grid, width: 1 });
    drawGraph(ctx, graphR, sc, L, built.dom, x, pr, done);

    P.out.set('f1', qty(v1, sc.units[0]));
    P.out.set('f2', qty(v2, sc.units[1]));
    P.out.set('prod', qty(pr, sc.pUnit));
    if (!done) {
      LATE.forEach((rid) => P.out.set(rid, 'after the last step'));
    } else {
      P.out.set('std', built.std);
      P.out.set('zeros', `x = ${num(L.zeros[0])} and x = ${num(L.zeros[1])}`);
      P.out.set('vertex', `(${num(L.p)}, ${num(L.q)})`);
      P.out.set('best', built.solved ?? `${qty(L.q, sc.pUnit)} at x = ${num(L.p)}`);
      P.out.set('domain', built.dom.text);
    }
  }
}
