'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { floor500, computeShuushi } = require('../calc.js');

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
