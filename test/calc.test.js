'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { floor500, computeShuushi, computeMergedRange } = require('../calc.js');

test('floor500: 500円単位に切り捨てる', () => {
  assert.equal(floor500(1234), 1000);
  assert.equal(floor500(1500), 1500);
  assert.equal(floor500(499), 0);
  assert.equal(floor500(0), 0);
});

test('computeShuushi: 換金額(玉数×交換レート)から投資額を引いた値を返す', () => {
  assert.equal(computeShuushi(1000, 4, 3000), 1000);
  assert.equal(computeShuushi(500, 4, 3000), -1000);
  assert.equal(computeShuushi(0, 4, 0), 0);
});

test('computeShuushi: 端数玉は切り捨ててから掛け算する', () => {
  assert.equal(computeShuushi(999.9, 4, 0), 3996);
});

test('computeMergedRange: 当選確率と信頼度から発生レンジを逆算する', () => {
  const r1 = computeMergedRange(0.01, 0.5);
  assert.equal(r1.winBoundary, 0.01);
  assert.equal(r1.totalBoundary, 0.02);

  const r2 = computeMergedRange(0.01, 0.8);
  assert.equal(r2.winBoundary, 0.01);
  assert.equal(Math.abs(r2.totalBoundary - 0.0125) < 1e-12, true);
});

test('computeMergedRange: 信頼度100%なら発生レンジ＝当選確率と一致する（ハズレなし）', () => {
  const r = computeMergedRange(0.02, 1.0);
  assert.equal(r.winBoundary, 0.02);
  assert.equal(r.totalBoundary, 0.02);
});
