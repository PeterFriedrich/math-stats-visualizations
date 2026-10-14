import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../site/js/maths/quadratic.js';

const r = Q.rat;

test('test_quadratic_vertex_form_worked_examples', () => {
  // [a, b, c] → p, q in y = a(x − p)² + q, checked by hand.
  const cases = [
    [[1, 6, 5], r(-3), r(-4)], // (x + 3)² − 4
    [[1, -8, 7], r(4), r(-9)], // (x − 4)² − 9
    [[1, 5, 2], r(-5, 2), r(-17, 4)], // (x + 5/2)² − 17/4
    [[2, 12, -3], r(-3), r(-21)], // 2(x + 3)² − 18 − 3
    [[-1, 4, 1], r(2), r(5)], // −(x − 2)² + 4 + 1
    [[3, -9, 2], r(3, 2), r(-19, 4)], // 3(x − 3/2)² − 27/4 + 2
  ];
  for (const [[a, b, c], p, q] of cases) {
    const cs = Q.completeSquare(a, b, c);
    assert.deepEqual(cs.p, p, `${a}x² + ${b}x + ${c}: p`);
    assert.deepEqual(cs.q, q, `${a}x² + ${b}x + ${c}: q`);
  }
  // The intermediate numbers the steps print for 2x² + 12x − 3.
  const cs = Q.completeSquare(2, 12, -3);
  assert.deepEqual([cs.k, cs.h, cs.h2, cs.ah2], [r(6), r(3), r(9), r(18)]);
});

test('test_quadratic_vertex_form_expands_back', () => {
  for (let a = -4; a <= 4; a++) {
    if (a === 0) continue;
    for (let b = -9; b <= 9; b += 3) {
      for (let c = -5; c <= 5; c += 5) {
        const { p, q } = Q.completeSquare(a, b, c);
        for (const x of [-2.5, 0, 1, 3]) {
          const vertex = a * (x - p[0] / p[1]) ** 2 + q[0] / q[1];
          assert.ok(Math.abs(vertex - Q.evaluate(a, b, c, x)) < 1e-9, `${a}, ${b}, ${c} at x = ${x}`);
        }
      }
    }
  }
});

test('test_quadratic_x_intercepts_worked_examples', () => {
  assert.deepEqual(Q.xIntercepts(1, 6, 5).exact, [r(-5), r(-1)]);
  assert.deepEqual(Q.xIntercepts(1, -6, 9).exact, [r(3)]);
  assert.equal(Q.xIntercepts(1, 2, 5).count, 0);
  // 2(x + 3)² − 21 = 0 → x = −3 ± √(21/2) = −3 ± √42/2
  assert.deepEqual(Q.xIntercepts(2, 12, -3).surd, { coef: r(1, 2), radicand: 42 });
  // (9 ± √57) ÷ 6 = 3/2 ± √57/6
  const x = Q.xIntercepts(3, -9, 2);
  assert.deepEqual([x.p, x.surd], [r(3, 2), { coef: r(1, 6), radicand: 57 }]);
  assert.deepEqual(Q.xIntercepts(-1, 4, 1).surd, { coef: r(1), radicand: 5 });
  for (const [a, b, c] of [[2, 12, -3], [3, -9, 2], [1, 5, 2]]) {
    for (const v of Q.xIntercepts(a, b, c).approx) assert.ok(Math.abs(Q.evaluate(a, b, c, v)) < 1e-9);
  }
});

test('test_quadratic_simplify_sqrt', () => {
  assert.deepEqual(Q.simplifySqrt(68), [2, 17]);
  assert.deepEqual(Q.simplifySqrt(72), [6, 2]);
  assert.deepEqual(Q.simplifySqrt(42), [1, 42]);
  assert.deepEqual(Q.simplifySqrt(49), [7, 1]);
  assert.deepEqual(Q.rat(6, -4), [-3, 2]);
});

test('test_quadratic_linear_product_worked_examples', () => {
  // Revenue: (12 + 0.5x)(400 − 10x) = −5x² + 80x + 4800, checked by hand.
  // Zeros −24 and 40, so the vertex is at x = 8: $16 × 320 tickets = $5120.
  let L = Q.linearProduct([r(1, 2), r(12)], [r(-10), r(400)]);
  assert.deepEqual([L.first, L.outer, L.inner, L.last], [r(-5), r(200), r(-120), r(4800)]);
  assert.deepEqual([L.a, L.b, L.c], [r(-5), r(80), r(4800)]);
  assert.deepEqual(L.zeros, [r(-24), r(40)]);
  assert.deepEqual([L.p, L.at, L.q], [r(8), [r(16), r(320)], r(5120)]);

  // Fence on three sides: x(60 − 2x) = −2x² + 60x. Greatest area 15 × 30 = 450.
  L = Q.linearProduct([r(1), r(0)], [r(-2), r(60)]);
  assert.deepEqual([L.a, L.b, L.c], [r(-2), r(60), r(0)]);
  assert.deepEqual(L.zeros, [r(0), r(30)]);
  assert.deepEqual([L.p, L.at, L.q], [r(15), [r(15), r(30)], r(450)]);

  // Path around a garden: (20 + 2x)(30 + 2x) = 4x² + 100x + 600.
  // Zeros −10 and −15; the minimum is (−5)(5) = −25 at x = −25/2.
  L = Q.linearProduct([r(2), r(20)], [r(2), r(30)]);
  assert.deepEqual([L.a, L.b, L.c], [r(4), r(100), r(600)]);
  assert.deepEqual(L.zeros, [r(-10), r(-15)]);
  assert.deepEqual([L.p, L.q], [r(-25, 2), r(-25)]);

  // A vertex that is not a whole number: (10 + x)(200 − 15x), zeros −10 and 40/3.
  L = Q.linearProduct([r(1), r(10)], [r(-15), r(200)]);
  assert.deepEqual([L.zeros[1], L.p, L.at, L.q], [r(40, 3), r(5, 3), [r(35, 3), r(175)], r(6125, 3)]);
});

test('test_quadratic_linear_product_agrees_with_standard_form', () => {
  const v = ([n, d]) => n / d;
  for (const [f, g] of [
    [[r(1, 2), r(12)], [r(-10), r(400)]],
    [[r(3), r(-7)], [r(-2), r(9)]],
    [[r(2), r(20)], [r(2), r(30)]],
  ]) {
    const L = Q.linearProduct(f, g);
    for (const x of [r(-3), r(0), r(5, 2), L.p]) {
      const y = v(L.a) * v(x) ** 2 + v(L.b) * v(x) + v(L.c);
      assert.ok(Math.abs(v(Q.productAt(f, g, x)) - y) < 1e-9);
    }
    assert.deepEqual(Q.productAt(f, g, L.p), L.q);
    for (const z of L.zeros) assert.deepEqual(Q.productAt(f, g, z), r(0));
  }
  // The path problem: (20 + 2x)(30 + 2x) − 600 = 464 → 4x² + 100x − 464 = 0 → x = 4 (or −29).
  assert.deepEqual(Q.xIntercepts(4, 100, -464).exact, [r(-29), r(4)]);
  assert.deepEqual(Q.linearAt([r(2), r(20)], r(4)), r(28));
});
