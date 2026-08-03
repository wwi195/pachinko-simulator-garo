'use strict';

function floor500(y) {
  return Math.floor(y / 500) * 500;
}

function computeShuushi(balls, exRate, cashUsed) {
  return Math.floor(balls) * exRate - cashUsed;
}

// 固定の当選確率(winRate)を、指定した信頼度(confidence)で見せるために必要な
// 発生レンジ（当選境界・ハズレ込みの全体境界）を逆算する。
// 例: winRate=1/440, confidence=0.40 → totalBoundary=(1/440)/0.40 ≒ 1/176
//     （40%の的中率を保ったまま見せると、約1/176の頻度で演出が発生する）
function computeMergedRange(winRate, confidence) {
  return {
    winBoundary: winRate,
    totalBoundary: winRate / confidence,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { floor500, computeShuushi, computeMergedRange };
}
