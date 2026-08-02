'use strict';

function floor500(y) {
  return Math.floor(y / 500) * 500;
}

function computeShuushi(balls, exRate, cashUsed) {
  return Math.floor(balls) * exRate - cashUsed;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { floor500, computeShuushi };
}
