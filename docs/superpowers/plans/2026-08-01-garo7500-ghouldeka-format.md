# GARO7500 グールデカ形式リニューアル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `C:\Users\ab_99\Desktop\garo7500-repo` の牙狼7500シミュレーターを元に、確率ロジックと演出画像は一切変更せず、表示レイアウト（統計ヘッダー・操作ボタン・履歴・当たり演出ボタン）を `pachinko-simulator-ghouldeka` と同じ形式に作り替えた新規プロジェクト `C:\Users\ab_99\pachinko-simulator-garo` を作る。

**Architecture:** グールデカと同じ `index.html`/`style.css`/`script.js` の3分割構成 + 新規に追加するライブ収支計算用の純粋関数ファイル `calc.js`（node:testでユニットテスト可能）。確率分岐・演出テンプレート（`oneSpin`/`doHit`/各`tm*`関数）は元コードから**そのままコピー**し、挙動を変えない。ゲーム画面は元のGARO7500と同じ「固定の統計パネル＋固定の操作ボタン＋当たり時はモーダルオーバーレイ」という構造を維持しつつ、統計パネルと操作ボタンのHTML/CSSだけをグールデカ形式に置き換える。

**Tech Stack:** 素のHTML/CSS/JavaScript（ビルドツールなし、ブラウザで直接開いて動作）。テストは Node.js 標準の `node:test`（`calc.js` の純粋関数のみ）。ブラウザでの手動検証は Playwright（既存の `pachinko-simulator-ghoul` プロジェクトと同じやり方）。

参照元:
- 元プロジェクト: `C:\Users\ab_99\Desktop\garo7500-repo\index.html`（808行、単一ファイル完結型）
- 形式のお手本: `C:\Users\ab_99\pachinko-simulator-ghouldeka\index.html` / `style.css` / `script.js`
- 承認済み設計書: `docs/superpowers/specs/2026-08-01-garo7500-ghouldeka-format-design.md`（このプランと同じリポジトリ内）

---

## Task 1: プロジェクトの雛形作成

**Files:**
- Create: `C:\Users\ab_99\pachinko-simulator-garo\package.json`
- Create: `C:\Users\ab_99\pachinko-simulator-garo\README.md`
- Create: `C:\Users\ab_99\pachinko-simulator-garo\images\`（`garo7500-repo\images\` の10ファイルをコピー）

- [ ] **Step 1: images フォルダをコピーする**

```bash
cp -r "/c/Users/ab_99/Desktop/garo7500-repo/images" "/c/Users/ab_99/pachinko-simulator-garo/images"
```

コピー後、10ファイルあることを確認する:

```bash
ls "/c/Users/ab_99/pachinko-simulator-garo/images" | wc -l
```

Expected: `10`

- [ ] **Step 2: package.json を作成する**

```json
{
  "name": "pachinko-simulator-garo",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\""
  }
}
```

- [ ] **Step 3: README.md を作成する**

```markdown
# 牙狼7500 疑似遊技シミュレーター（グールデカ形式）

`garo7500-repo` の確率ロジック・演出画像はそのままに、表示レイアウトを
`pachinko-simulator-ghouldeka` と同じ形式に作り替えたバージョン。

- 軍資金選択・機種選択・プレミアムプランは廃止し、固定レート（等価・17回転/千円）で
  ページを開くと即プレイ開始する
- 回転数上限なし。「退店する」ボタンを押すまでプレイを継続できる
```

- [ ] **Step 4: 最初のコミット**

```bash
cd "/c/Users/ab_99/pachinko-simulator-garo"
git add package.json README.md images/
git commit -m "プロジェクト雛形と演出画像を追加"
```

---

## Task 2: calc.js — ライブ収支計算の純粋関数（TDD）

グールデカの `renderHeader()` にある `shuushi = mochiInt * 4 - toushi` と同じ考え方で、
GARO7500側のライブ収支を計算する関数を作る。あわせて元コードの `floor500`（退店時の
精算で500円単位に丸める関数）もここに移す。

**Files:**
- Create: `C:\Users\ab_99\pachinko-simulator-garo\calc.js`
- Create: `C:\Users\ab_99\pachinko-simulator-garo\test\calc.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/calc.test.js`:

```javascript
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd "/c/Users/ab_99/pachinko-simulator-garo"
npm test
```

Expected: FAIL（`calc.js` が存在しないため `Cannot find module '../calc.js'`）

- [ ] **Step 3: calc.js を実装する**

```javascript
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
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```

Expected: PASS（3 tests, 0 failures）

- [ ] **Step 5: コミット**

```bash
git add calc.js test/calc.test.js
git commit -m "ライブ収支計算(calc.js)をTDDで追加"
```

---

## Task 3: style.css のベース（グールデカからコピー）

**Files:**
- Create: `C:\Users\ab_99\pachinko-simulator-garo\style.css`

- [ ] **Step 1: グールデカの style.css をそのままコピーする**

```bash
cp "/c/Users/ab_99/pachinko-simulator-ghouldeka/style.css" "/c/Users/ab_99/pachinko-simulator-garo/style.css"
```

- [ ] **Step 2: グールデカ固有の未使用ルールを削除する**

GARO7500には RUSH画面・振り分けボックス・上乗せジャッジなど、グールデカ独自の演出画面が
存在しない。`style.css` を開き、以下のセクションを削除する（残しても動作に支障はないが、
死んだCSSを持ち込まないため削除する）:

- `.rush-title` 〜 `.add-rush-title` のブロック（RUSH演出専用）
- `.vibun-box` 〜 `.vibun-box.normal-box`（振り分け専用）
- `.bonus-main` 〜 `.rush-announce`（RUSHボーナス演出専用）
- `.rush-result-title` 以降、ファイル末尾までの「RUSHリザルト」セクション全体
- `#mode-badge` / `.esup-block` / `.esup-label` / `.esup-value` / `#rush-count` 関連（GARO7500にはモード切替・電サポがないため）
- `#rush-stats-bar` 関連（`.rsb-*`）（通算RUSH成績パネルはGARO7500に存在しない）
- `.enzoku-label` / `.enzoku-img` / `.shinraiudo`（東京喰種固有の先バレ演出）
- `.uenose-btn`（上乗せジャッジ専用ボタン）
- `.chain-label` / `.chain-label.uenose-chain`

判断に迷ったら残してよい（Task 4で追加する新規ルールと衝突しなければ実害はない）。

- [ ] **Step 3: 動作確認用に一旦コミット**

```bash
git add style.css
git commit -m "style.css: グールデカのベーススタイルを移植"
```

---

## Task 4: style.css — GARO7500固有スタイルの追加

**Files:**
- Modify: `C:\Users\ab_99\pachinko-simulator-garo\style.css`

- [ ] **Step 1: ファイル末尾に以下を追記する**

```css

/* ============================================================
   GARO7500 固有: 大当たり内訳トグル
============================================================ */
.bbDetail{display:none;}
.bbDetail.open{display:block;}

/* ============================================================
   GARO7500 固有: 遊技履歴の当たり／投資ログ色分け
============================================================ */
.hi{font-size:12px;padding:4px 12px;border-bottom:1px solid #181818;color:#555;}
.hi.hit{color:#c9a227;}
.hi.inv{color:#444;}

/* ============================================================
   GARO7500 固有: 当たり演出モーダルオーバーレイ
   （演出の仕組みは維持し、配色のみグールデカ系に統一）
============================================================ */
#ov{position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
#ov.h{display:none;}
#mb{width:100%;max-width:400px;max-height:90vh;overflow-y:auto;border-radius:16px;padding:22px;text-align:center;}
.mn  {background:#1a1a1a;border:2px solid #c9a227;}
.mh  {background:#080820;border:3px solid #6366f1;}
.ms  {background:#081408;border:3px solid #22c55e;}
.mc  {background:#041414;border:2px solid #06b6d4;}
.mba {background:#200808;border:3px solid #ef4444;}
.m7  {background:#1a1400;border:3px solid #ffd700;}
.mlt {background:#0f0020;border:3px solid #a855f7;}
.mvi {background:#001810;border:3px solid #22c55e;}
.me  {background:#1a1a1a;border:2px solid #444;}
.mse {background:#1a1a1a;border:2px solid #c9a227;}
.pi{width:100%;max-width:300px;height:130px;background:#181818;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#444;font-size:11px;line-height:1.6;text-align:center;margin:0 auto 14px;border:1px dashed #333;}
.mt{font-size:22px;font-weight:bold;margin-bottom:6px;}
.ms2{font-size:13px;color:#777;margin-bottom:12px;}
.mr{font-size:18px;font-weight:bold;margin-bottom:14px;padding:10px;border-radius:8px;}
.rw{background:rgba(34,197,94,.15);color:#22c55e;}
.rl{background:rgba(239,68,68,.15);color:#ef4444;}
.bm{font-size:26px;font-weight:bold;color:#ffd700;margin:10px 0 4px;}
.bs{font-size:14px;color:#aaa;margin-bottom:12px;}
.ltc{font-size:46px;font-weight:bold;color:#a855f7;}
.ltl{font-size:11px;color:#777;margin-bottom:4px;}
.rainbow{background:linear-gradient(90deg,#f00,#ff8c00,#ffd700,#0f0,#0ff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:bold;}

/* モーダル内の「続ける」「OK」等のボタン。
   グールデカの .btn-action と同じ見た目にする */
.bok{display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#c9a227,#7a5c00);border:2px solid #f0e090;color:#fff;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,.4);text-shadow:0 1px 2px rgba(0,0,0,.4);}
.bok:active{opacity:.75;transform:scale(.97);}

/* ============================================================
   GARO7500 固有: 精算（退店）画面
============================================================ */
.sr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:13px;}
.sk{color:#777;}
.sv2{font-weight:bold;font-size:14px;}
.sfin{font-size:30px;font-weight:bold;text-align:center;padding:12px 0;}
.smsg{font-size:13px;text-align:center;color:#f0c040;margin-bottom:10px;}
.candy{font-size:11px;color:#888;text-align:right;margin:-4px 0 4px;}
.ltend-row{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;padding:4px 16px;}
.ltend-total{font-size:24px;font-weight:bold;color:#ffd700;margin-top:10px;}
.ltend-net{font-size:13px;color:#777;margin-bottom:8px;}
.ltend-sub{font-size:11px;color:#555;}
```

- [ ] **Step 2: コミット**

```bash
git add style.css
git commit -m "style.css: GARO7500固有の演出モーダル・精算・履歴スタイルを追加"
```

---

## Task 5: index.html — 骨格の作成

グールデカと同じ構造（タイトルバー／ヘッダー3行／固定操作パネル／履歴／モーダル）で作る。
グールデカと異なり「モード」「電サポ」の概念がないためヘッダー1行目は回転数のみとし、
セットアップ画面（軍資金・機種選択）は作らない。

**Files:**
- Create: `C:\Users\ab_99\pachinko-simulator-garo\index.html`

- [ ] **Step 1: index.html を作成する**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>牙狼7500 疑似遊技シミュレーター</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">

    <div id="title-bar">牙狼7500 疑似遊技シミュレーター</div>

    <div id="header">

      <!-- 行1: 回転数 -->
      <div class="hrow hrow1">
        <div class="spins-block">
          <span class="spins-current" id="current-spins">0</span>
          <span class="spins-unit">回</span>
          <span class="spins-sep">／累計</span>
          <span class="spins-total" id="total-spins-disp">0</span>
          <span class="spins-unit">回</span>
        </div>
      </div>

      <!-- 行2: 持ち球 / 投資 / 収支 -->
      <div class="hrow hrow2">
        <div class="money-block">
          <span class="money-label">持ち球</span>
          <span class="money-value gold" id="mochi-dama">0</span>
          <span class="money-unit">発</span>
        </div>
        <div class="money-block">
          <span class="money-label">投資</span>
          <span class="money-value red" id="toushi-value">0</span>
          <span class="money-unit">円</span>
        </div>
        <div class="money-block">
          <span class="money-label">収支</span>
          <span class="money-value red" id="shuushi-value">0</span>
          <span class="money-unit">円</span>
        </div>
      </div>

      <!-- 行3: 大当たり回数 -->
      <div class="hrow hrow3">
        <div class="hrow3-header">
          <span class="hrow3-title">大当たり総回数</span>
          <span class="total-hit-block">
            <span class="total-hit-count" id="total-hit-count">0回</span>
          </span>
          <span class="fee-block">17回転/千円</span>
        </div>
        <div class="hrow3-normal-line">
          <span class="hit-label2">🎯 図柄揃い合計</span>
          <span class="hit-count" id="thfig">0回</span>
        </div>
        <button class="btn-sub" id="bbToggleBtn" onclick="toggleDetail()">▶ 詳細を見る</button>
        <div class="hrow3-stats bbDetail" id="bbDetail">
          <div class="hit-item"><span class="hit-label2">├ 極限突入</span><span class="hit-count" id="thfex">0回</span></div>
          <div class="hit-item"><span class="hit-label2">└ 非突入</span><span class="hit-count" id="thfnorm">0回</span></div>
          <div class="hit-item"><span class="hit-label2">⚡ チャージ</span><span class="hit-count" id="thc">0回</span></div>
          <div class="hit-item"><span class="hit-label2">⚔️ 極限バトル成功</span><span class="hit-count" id="thew">0回</span></div>
          <div class="hit-item"><span class="hit-label2">💔 極限バトル失敗</span><span class="hit-count" id="thex">0回</span></div>
          <div class="hit-item"><span class="hit-label2">通常時計</span><span class="hit-count" id="sth-norm"></span></div>
          <div class="hit-item"><span class="hit-label2">LT中計</span><span class="hit-count" id="sth-lt"></span></div>
          <div class="hit-item"><span class="hit-label2">⚡ 7500初回</span><span class="hit-count" id="thl7f">0回</span></div>
          <div class="hit-item"><span class="hit-label2">🟡 7500継続</span><span class="hit-count" id="thl7c">0回</span></div>
          <div class="hit-item"><span class="hit-label2">🟢 1500継続</span><span class="hit-count" id="thlv">0回</span></div>
          <div class="hit-item"><span class="hit-label2">⚪ 1500終了</span><span class="hit-count" id="thle">0回</span></div>
        </div>
      </div>

    </div><!-- /header -->

    <!-- 操作パネル（固定表示） -->
    <div id="ctrl" style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px;">
      <button class="btn-start" id="btn1" onclick="doSpin1()">START</button>
      <div class="auto-spin-wrap">
        <div class="auto-spin-btns">
          <button class="btn-auto" id="btnauto" onclick="doSpinAuto()">1万円分回す</button>
        </div>
        <p class="spin-cost-hint" id="autoHint">約170回転分</p>
      </div>
      <button class="btn-taiten" id="btnr" onclick="doRetire()">退店する</button>
    </div>

    <div id="log-area">
      <div id="log-title">遊技履歴</div>
      <div id="log-list"></div>
    </div>

  </div>

  <!-- ===== 当たり演出モーダル ===== -->
  <div id="ov" class="h"><div id="mb"></div></div>

  <script src="calc.js"></script>
  <script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 2: コミット**

```bash
git add index.html
git commit -m "index.html: グールデカ形式の骨格を作成"
```

---

## Task 6: script.js — 定数・状態・球/現金ヘルパー・履歴

元コード（`garo7500-repo/index.html` 248-445行目付近）から、確率定数と基礎ヘルパーを移植する。
軍資金上限・交換レート選択・店選択は撤廃し、固定値にする。

**Files:**
- Create: `C:\Users\ab_99\pachinko-simulator-garo\script.js`

- [ ] **Step 1: script.js の先頭部分（定数・状態・ヘルパー）を書く**

```javascript
'use strict';

/* ============================================================
   CONSTANTS
   確率・獲得球数は garo7500-repo と完全に同一（変更禁止）
============================================================ */
const C={
  P_HW:1/874.8, P_HL:1/3499.2,
  P_SW:1/874.8, P_SL:1/583.2,
  P_CH:1/1749.9,
  CHB:280, B15:1400, B75:7000, BPK:250,
  PEX:0.50, PEW:0.50, PLG:0.25, PLV:0.76,
  SPK:17,      // 固定レート：17回転/千円（等価）
  EXRATE:4.0,  // 固定：等価交換（4円/4円）
};
const T1=C.P_HW, T2=T1+C.P_HL, T3=T2+C.P_SW, T4=T3+C.P_SL, T5=T4+C.P_CH;
const AUTO_SPIN_COUNT = C.SPK*10; // 「1万円分回す」＝170回転

/* ============================================================
   STATE
============================================================ */
let S={};
let _busy=false, _detailOpen=false;

function newState(){
  S={
    balls:0,
    cashUsed:0, investB:0, recovB:0,
    hits:{
      total:0,   // 全大当たり合計
      fex:0,     // 図柄揃い（極限バトル突入）
      fnorm:0,   // 図柄揃い（非突入）
      exwin:0,   // 極限バトル成功（LT突入）
      exlost:0,  // 極限バトル失敗
      bc:0,      // チャージ
      lt7first:0,// LT中 7500初回（極限バトル成功直後）
      lt7cont:0, // LT中 7500継続（GOD OF GARO）
      ltv:0,     // LT中 1500継続ボーナス
      lte:0,     // LT中 1500終了
    },
    cur:0, ttl:0,
    bps:C.BPK/C.SPK,
    exRate:C.EXRATE,
    hist:[],
    pendingInvest:0,
  };
}

/* ============================================================
   BALL / CASH
   所持金上限なし（グールデカと同じく無制限に投資できる）
============================================================ */
function ensureBalls(){
  while(S.balls<S.bps){
    S.balls+=C.BPK;
    S.cashUsed+=1000; S.investB+=C.BPK;
    S.pendingInvest+=1000;
  }
}
function consume(){S.balls-=S.bps; S.cur++; S.ttl++;}
function award(n){S.balls+=n; S.recovB+=n;}

/* ============================================================
   HISTORY
============================================================ */
function addH(t,c=''){
  S.hist.unshift({t,c});
  if(S.hist.length>150) S.hist.pop();
  document.getElementById('log-list').innerHTML=S.hist.map(h=>`<div class="hi ${h.c}">${h.t}</div>`).join('');
}
function flushInvest(){
  if(S.pendingInvest>0){
    addH(`${S.cur}回転目：追加投資 ${S.pendingInvest.toLocaleString()}円`,'inv');
    S.pendingInvest=0;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add script.js
git commit -m "script.js: 定数・状態・球/現金ヘルパー・履歴を移植（軍資金上限は撤廃）"
```

---

## Task 7: script.js — 表示更新 (updS)

グールデカの `renderHeader()` と同じ考え方で、新しいDOM構造にあわせて表示を更新する
関数を書く。大当たり内訳（`thfig`〜`thle`）の集計ロジックは元コードと完全に同一。

**Files:**
- Modify: `C:\Users\ab_99\pachinko-simulator-garo\script.js`

- [ ] **Step 1: ファイル末尾に updS/toggleDetail を追記する**

```javascript

/* ============================================================
   DISPLAY
============================================================ */
function updS(){
  document.getElementById('current-spins').textContent=S.cur.toLocaleString();
  document.getElementById('total-spins-disp').textContent=S.ttl.toLocaleString();

  document.getElementById('mochi-dama').textContent=Math.floor(S.balls).toLocaleString();
  document.getElementById('toushi-value').textContent=S.cashUsed.toLocaleString();

  const shuushi=computeShuushi(S.balls,S.exRate,S.cashUsed);
  const shuushiEl=document.getElementById('shuushi-value');
  shuushiEl.textContent=(shuushi>=0?'+':'')+shuushi.toLocaleString();
  shuushiEl.className='money-value '+(shuushi>=0?'green':'red');

  document.getElementById('total-hit-count').textContent=`${S.hits.total}回`;

  // 確率：回転数 / 当たり数 → 1/N 形式
  const prob=n=>(S.ttl>0&&n>0)?` 1/${Math.round(S.ttl/n)}`:'';
  const figTotal=S.hits.fex+S.hits.fnorm;
  document.getElementById('thfig').textContent=`${figTotal}回${prob(figTotal)}`;
  document.getElementById('thfex').textContent=`${S.hits.fex}回${prob(S.hits.fex)}`;
  document.getElementById('thfnorm').textContent=`${S.hits.fnorm}回${prob(S.hits.fnorm)}`;
  document.getElementById('thc').textContent=`${S.hits.bc}回${prob(S.hits.bc)}`;
  const exTotal=S.hits.exwin+S.hits.exlost;
  const exPct=n=>exTotal>0?` ${Math.round(n/exTotal*100)}%`:' －';
  document.getElementById('thew').textContent=`${S.hits.exwin}回${exPct(S.hits.exwin)}`;
  document.getElementById('thex').textContent=`${S.hits.exlost}回${exPct(S.hits.exlost)}`;
  const normTotal=S.hits.fex+S.hits.fnorm+S.hits.bc;
  document.getElementById('sth-norm').textContent=normTotal>0?`${normTotal}回${prob(normTotal)}`:'';
  const ltTotal=S.hits.lt7first+S.hits.lt7cont+S.hits.ltv+S.hits.lte;
  document.getElementById('sth-lt').textContent=ltTotal>0?`${ltTotal}回`:'';
  const ltPct=n=>ltTotal>0?` ${Math.round(n/ltTotal*100)}%`:'';
  document.getElementById('thl7f').textContent=`${S.hits.lt7first}回`;
  document.getElementById('thl7c').textContent=`${S.hits.lt7cont}回${ltPct(S.hits.lt7cont)}`;
  document.getElementById('thlv').textContent=`${S.hits.ltv}回${ltPct(S.hits.ltv)}`;
  document.getElementById('thle').textContent=`${S.hits.lte}回${ltPct(S.hits.lte)}`;
}

function toggleDetail(){
  _detailOpen=!_detailOpen;
  document.getElementById('bbDetail').classList.toggle('open',_detailOpen);
  document.getElementById('bbToggleBtn').textContent=_detailOpen?'▼ 詳細を閉じる':'▶ 詳細を見る';
}
```

- [ ] **Step 2: コミット**

```bash
git add script.js
git commit -m "script.js: グールデカ形式のヘッダー表示更新(updS)を追加"
```

---

## Task 8: script.js — モーダル制御・当たり演出テンプレート・スピン処理

ここが最も重要な移植箇所。`garo7500-repo/index.html` の以下の関数を**内容を一切変更せず**
移植する（確率分岐・獲得球数・演出文言・画像パスはすべて元のまま。以下の各コードブロックは
元ファイルからそのまま書き写したものなので、そのまま追記すればよい）。
※ `tmClosingTime` / `tmAfterClosing` / `chooseRetire` / `chooseContinue`（回転数上限の
撤廃に伴う閉店処理）は不要な機能のため移植しない。

**Files:**
- Modify: `C:\Users\ab_99\pachinko-simulator-garo\script.js`

- [ ] **Step 1: モーダル制御（`showM`/`closeM`/`blackout`）を追記する**

```javascript
/* ============================================================
   MODAL
============================================================ */
let _res=null;
function showM(html,theme){
  const ov=document.getElementById('ov');
  const box=document.getElementById('mb');
  ov.style.background='';
  box.className=theme||'mn'; box.innerHTML=html;
  ov.classList.remove('h');
  return new Promise(r=>{_res=r;});
}
function closeM(){
  document.getElementById('ov').classList.add('h');
  if(_res){_res();_res=null;}
}
function blackout(){
  const ov=document.getElementById('ov');
  document.getElementById('mb').innerHTML='';
  document.getElementById('mb').className='';
  document.getElementById('mb').style.background='transparent';
  ov.style.background='#000';
  ov.classList.remove('h');
  return new Promise(r=>setTimeout(r,500));
}
```

- [ ] **Step 2: 当たり演出テンプレート関数を追記する**

```javascript
/* ============================================================
   MODAL TEMPLATES
============================================================ */
// 画像が存在しない場合はテキストプレースホルダーに自動フォールバック
function imgDiv(src,fallback){
  return `<div class="pi"><img src="${src}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;border-radius:8px" onload="this.parentElement.style.border='none';this.parentElement.style.background='transparent'" onerror="this.style.display='none';this.parentElement.textContent='${fallback}'"></div>`;
}

function tmHolderPre(spin){return `
  ${imgDiv('images/holder_pre.jpg','牙狼保留\n画像プレースホルダー')}
  <div class="mt" style="color:#818cf8">🌟 牙狼保留 出現！</div>
  <div class="ms2">信頼度 <strong style="color:#ffd700;font-size:17px">80%</strong></div>
  <div style="font-size:11px;color:#555;margin-bottom:18px">${spin}回転目</div>
  <button class="bok" onclick="closeM()">大当たり判定へ →</button>`;}

function tmHolderResult(win){return `
  ${win?imgDiv('images/holder_win.png','牙狼保留\n当たり画像プレースホルダー'):''}
  <div class="mt" style="color:#818cf8">🌟 牙狼保留</div>
  <div class="mr ${win?'rw':'rl'}">${win?'✨ 図柄揃い！当たり！！':'💔 ハズレ…'}</div>
  <button class="bok" onclick="closeM()">確認</button>`;}

function tmSwordPre(spin){return `
  ${imgDiv('images/sword_pre.jpg','牙狼剣\n画像プレースホルダー')}
  <div class="mt" style="color:#22c55e">⚔️ 牙狼剣 出現！</div>
  <div class="ms2">信頼度 <strong style="color:#ffd700;font-size:17px">40%</strong></div>
  <div style="font-size:11px;color:#555;margin-bottom:18px">${spin}回転目</div>
  <button class="bok" onclick="closeM()">大当たり判定へ →</button>`;}

function tmSwordResult(win){return `
  ${win?imgDiv('images/sword_win.png','牙狼剣\n当たり画像プレースホルダー'):''}
  <div class="mt" style="color:#22c55e">⚔️ 牙狼剣</div>
  <div class="mr ${win?'rw':'rl'}">${win?'✨ 図柄揃い！当たり！！':'💔 ハズレ…'}</div>
  <button class="bok" onclick="closeM()">確認</button>`;}

function tmCharge(spin){return `
  <div class="mt" style="color:#06b6d4">⚡ ガロチャージ！</div>
  <div class="bm">ガロチャージ！</div>
  <div class="bs">（獲得 ${C.CHB}発）</div>
  <div style="font-size:11px;color:#555;margin-bottom:14px">${spin}回転目</div>
  <button class="bok" onclick="closeM()">OK</button>`;}

function tmFig(){return `
  ${imgDiv('images/battle_bonus.png','BATTLE BONUS\n画像プレースホルダー')}
  <div class="mt" style="color:#ef4444">BATTLE BONUS</div>
  <div style="font-size:12px;color:#777;margin-bottom:2px;">図柄揃い！ 1500ボーナス確定！</div>
  <div style="font-size:12px;margin-bottom:16px;">
    バトル勝利で<span style="color:#ffd700;font-weight:bold;">極</span><span style="color:#a855f7;font-weight:bold;">限</span><span class="rainbow">7500</span>バトル！
  </div>
  <div class="bm">牙狼を救え</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmFigMiss(){return `
  <div class="mt" style="color:#aaa">通常継続…</div>
  <div style="font-size:16px;color:#666;margin:12px 0">😢 極限バトル突入ならず</div>
  <button class="bok" onclick="closeM()">続ける</button>`;}

function tmExIn(){return `
  ${imgDiv('images/extreme_in.png','極限7500バトル\n突入画像プレースホルダー')}
  <div class="mt" style="color:#ef4444">🔥 極限7500バトル！</div>
  <button class="bok" onclick="closeM()">⚔️ バトル開始！</button>`;}

function tmExJudge(){return `
  ${imgDiv('images/extreme_judge.png','JUDGEMENT\n画像プレースホルダー')}
  <div class="mt" style="color:#ef4444">⚖️ JUDGEMENT</div>
  <button class="bok" onclick="closeM()">JUDGEMENT</button>`;}

function tmExWin(){return `
  ${imgDiv('images/extreme_win.jpg','極限7500ボーナス\n画像プレースホルダー')}
  <div class="mt" style="color:#ffd700">🏆 極限7500ボーナス！</div>
  <div class="bm">7500ボーナス！</div>
  <div class="bs">（獲得 ${C.B75}発）</div>
  <div style="color:#22c55e;font-weight:bold;margin:10px 0">🌟 魔戒CHANCE LT 突入！！</div>
  <button class="bok" onclick="closeM()">魔戒CHANCE LTへ →</button>`;}

function tmExLose(){return `
  <div class="mt" style="color:#888">😢 バトル敗北…</div>
  <div class="bm">1500ボーナス！</div>
  <div class="bs">（獲得 ${C.B15}発）</div>
  <div style="font-size:11px;color:#555;margin-bottom:14px">通常時へ戻る</div>
  <button class="bok" onclick="closeM()">続ける</button>`;}

function tmLTIn(n){return `
  ${imgDiv('images/lt_in.png','魔戒CHANCE\n画像プレースホルダー')}
  <div class="mt" style="color:#a855f7">✨ 魔戒CHANCE！</div>
  <div class="ltl">連チャン数</div>
  <div class="ltc">${n}</div>
  <div style="color:#aaa;font-size:12px;margin:10px 0">GOD OF GARO 25% / 1500継続 51% / 終了 24%</div>
  <button class="bok" onclick="closeM()">🎰 回す！</button>`;}

function tmLTGaro(n){return `
  ${imgDiv('images/god.jpg','GOD OF GARO 7500\n画像プレースホルダー')}
  <div class="mt" style="color:#ffd700">👑 GOD OF GARO！7500！</div>
  <div class="ltl">連チャン数</div>
  <div class="ltc" style="color:#ffd700">${n}</div>
  <div class="bm">7500ボーナス！</div>
  <div class="bs">（獲得 ${C.B75}発）</div>
  <div style="color:#ffd700;font-weight:bold;margin-bottom:12px">LT継続！！</div>
  <button class="bok" onclick="closeM()">続ける！</button>`;}

function tmLTVic(n){return `
  <div class="mt" style="color:#22c55e">🎉 1500継続ボーナス！</div>
  <div class="ltl">連チャン数</div>
  <div class="ltc" style="color:#22c55e">${n}</div>
  <div class="bm">1500ボーナス！</div>
  <div class="bs">（獲得 ${C.B15}発）</div>
  <div style="color:#22c55e;font-weight:bold;margin-bottom:12px">LT継続！</div>
  <button class="bok" onclick="closeM()">続ける！</button>`;}

function tmLTEnd(n,b7500,b1500,totalGain){return `
  <div class="mt" style="color:#aaa">🌙 ${n}連チャン終了</div>
  <div class="ltend-row"><span>🎯 図柄揃い</span><span>${C.B15.toLocaleString()}発</span></div>
  <div class="ltend-row"><span>7500ボーナス</span><span>${b7500}回</span></div>
  <div class="ltend-row"><span>1500ボーナス</span><span>${b1500}回</span></div>
  <div class="ltend-total">合計獲得　${totalGain.toLocaleString()}発</div>
  <div class="ltend-sub">終了ボーナス（獲得 ${C.B15}発）</div>
  <button class="bok" style="margin-top:16px" onclick="closeM()">通常時へ戻る</button>`;}
```

（色指定は元ファイルの `var(--red)` 等のCSS変数を実際の色コードに置き換えている。値そのものは
元ファイルの `:root` 定義と同一 — gold:`#c9a227`, bright:`#ffd700`, red:`#ef4444`,
green:`#22c55e`, purple:`#a855f7`, cyan:`#06b6d4` — なので見た目は元コードと変わらない）

- [ ] **Step 3: `doHit` 関数を追記する**

```javascript
/* ============================================================
   BONUS SEQUENCE
============================================================ */
async function doHit(type){
  const spin0=S.cur;

  // 初当たり（図柄揃い）
  award(C.B15);
  updS();
  await showM(tmFig(),'mn');

  let runBalls=C.B15, parts=[];
  const ev=type==='holder'?'牙狼保留→図柄揃い':'牙狼剣→図柄揃い';

  if(Math.random()<C.PEX){
    // 極限7500バトル突入（50%）
    S.hits.total++; S.hits.fex++;
    await showM(tmExIn(),'mba');
    await showM(tmExJudge(),'mba');

    if(Math.random()<C.PEW){
      // 極限WIN → 7500 + LT突入
      award(C.B75);
      S.hits.total++; S.hits.exwin++; S.hits.lt7first++;
      runBalls+=C.B75; parts.push('7500初回');
      let b7500This=1, b1500This=0;
      updS();
      await showM(tmExWin(),'m7');

      let ltN=0;
      while(true){
        ltN++;
        await showM(tmLTIn(ltN),'mlt');
        const r=Math.random();
        if(r<C.PLG){
          award(C.B75);
          S.hits.total++; S.hits.lt7cont++; b7500This++;
          runBalls+=C.B75; parts.push('7500継続');
          updS();
          await blackout();
          await showM(tmLTGaro(ltN),'m7');
        } else if(r<C.PLV){
          award(C.B15);
          S.hits.total++; S.hits.ltv++; b1500This++;
          runBalls+=C.B15; parts.push('継続');
          updS();
          await showM(tmLTVic(ltN),'mvi');
        } else {
          award(C.B15);
          S.hits.total++; S.hits.lte++;
          runBalls+=C.B15; parts.push('終了');
          updS();
          const ltGain=runBalls-C.B15;
          await showM(tmLTEnd(ltN,b7500This,b1500This,ltGain),'me');
          break;
        }
      }
      addH(`${spin0}回転目：${ev} → 極限突入 → LT${ltN}連(${parts.join('→')}) → 計${runBalls}発`,'hit');

    } else {
      // 極限LOSE → 1500終了
      award(C.B15);
      S.hits.total++; S.hits.exlost++;
      runBalls+=C.B15;
      updS();
      await showM(tmExLose(),'me');
      addH(`${spin0}回転目：${ev} → 極限突入 → バトル敗北 → 計${runBalls}発`,'hit');
    }

  } else {
    // 非突入・通常時へ（50%）
    S.hits.total++; S.hits.fnorm++;
    updS();
    await showM(tmFigMiss(),'me');
    addH(`${spin0}回転目：${ev} → 非突入 → 計${runBalls}発`,'hit');
  }

  S.cur=0;
  updS();
}
```

- [ ] **Step 4: `oneSpin` 関数を追記する**（元コードから`ensureBalls()`の戻り値チェックを
      削除した以外は同一。所持金上限がなくなったため`{over:true}`分岐が到達不能になるため
      削除する）

```javascript
/* ============================================================
   ONE SPIN
============================================================ */
async function oneSpin(){
  ensureBalls();
  consume(); updS();

  const r=Math.random();

  if(r<T2){
    const win=r<T1;
    flushInvest();
    await showM(tmHolderPre(S.cur),'mh');
    await showM(tmHolderResult(win),'mh');
    if(!win) addH(`${S.cur}回転目：牙狼保留出現（ハズレ）`);
    if(win) await doHit('holder');
    return {stopped:true};
  }

  if(r<T4){
    const win=r<T3;
    flushInvest();
    await showM(tmSwordPre(S.cur),'ms');
    await showM(tmSwordResult(win),'ms');
    if(!win) addH(`${S.cur}回転目：牙狼剣出現（ハズレ）`);
    if(win) await doHit('sword');
    return {stopped:true};
  }

  if(r<T5){
    flushInvest();
    award(C.CHB);
    S.hits.total++; S.hits.bc++;
    addH(`${S.cur}回転目：牙狼チャージ！（+${C.CHB}発）`);
    updS();
    await showM(tmCharge(S.cur),'mc');
    return {stopped:true};
  }

  return {ok:true};
}
```

- [ ] **Step 5: 移植後、`script.js` に構文エラーがないことを確認する**

```bash
cd "/c/Users/ab_99/pachinko-simulator-garo"
node --check script.js
```

Expected: 何も出力されず終了コード0（構文エラーなし）

- [ ] **Step 6: コミット**

```bash
git add script.js
git commit -m "script.js: 当たり演出テンプレート・doHit・oneSpinを移植（確率・演出は無変更）"
```

---

## Task 9: script.js — ボタン操作・精算・起動処理

**Files:**
- Modify: `C:\Users\ab_99\pachinko-simulator-garo\script.js`

- [ ] **Step 1: ボタンハンドラを追記する**

```javascript
/* ============================================================
   BUTTON HANDLERS
============================================================ */
function lockAll(v){
  ['btn1','btnauto','btnr'].forEach(id=>{document.getElementById(id).disabled=v;});
}

async function doSpin1(){
  if(_busy) return;
  _busy=true; lockAll(true);
  await oneSpin();
  _busy=false; lockAll(false);
}

async function doSpinAuto(){
  if(_busy) return;
  _busy=true; lockAll(true);
  for(let i=0;i<AUTO_SPIN_COUNT;i++){
    const r=await oneSpin();
    if(r.stopped) break;
  }
  _busy=false; lockAll(false);
}

function doRetire(){
  if(_busy) return;
  lockAll(true);
  showSettle();
}
```

- [ ] **Step 2: 精算処理を追記する（`garo7500-repo/index.html` 760-805行目を移植。
      `ratelabel`は固定レートのため「等価」に固定し、`floor500`は`calc.js`から使う）**

```javascript
/* ============================================================
   SETTLEMENT
============================================================ */
function showSettle(){
  const rawExchY=Math.floor(S.balls)*S.exRate;
  const exchY=floor500(rawExchY);
  const candy=Math.round(rawExchY-exchY);
  const finalPL=Math.round(exchY-S.cashUsed);
  const outRate=S.investB>0?Math.round(Math.floor(S.balls)/S.investB*100):0;
  const plColor=finalPL>=0?'#22c55e':'#ef4444';
  const plSign=finalPL>=0?'+':'';
  const plMsg=finalPL>=0?'🎊 プラス収支！おめでとう！':
    finalPL>=-5000?'今日は小負け。次こそ！':
    finalPL>=-20000?'取り返せる！次を信じろ！':
    finalPL>=-50000?'大負けだが次は来る！':
    '深追いしたかも…でも経験値は爆上がり！';
  const p=n=>(S.ttl>0&&n>0)?` 1/${Math.round(S.ttl/n)}`:'';
  const exTotal=S.hits.exwin+S.hits.exlost;
  const exPct=n=>exTotal>0?` ${Math.round(n/exTotal*100)}%`:' －';
  const html=`
    <div class="mt" style="color:#ffd700">精算</div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sr"><span class="sk">持ち玉</span><span class="sv2">${Math.floor(S.balls).toLocaleString()}玉</span></div>
    <div class="sr"><span class="sk">換金（等価）</span><span class="sv2">¥${Math.round(exchY).toLocaleString()}</span></div>
    ${candy>0?`<div class="candy">🍬 ${candy.toLocaleString()}円はお菓子になりました</div>`:''}
    <div class="sr"><span class="sk">総投資</span><span class="sv2" style="color:#ef4444">−¥${S.cashUsed.toLocaleString()}</span></div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sfin" style="color:${plColor}">${plSign}¥${Math.abs(finalPL).toLocaleString()}</div>
    <div class="smsg">${plMsg}</div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sr"><span class="sk">総回転数</span><span class="sv2">${S.ttl}回</span></div>
    <div class="sr"><span class="sk">大当たり合計</span><span class="sv2">${S.hits.total}回</span></div>
    <div class="sr"><span class="sk">🎯 図柄揃い合計</span><span class="sv2">${S.hits.fex+S.hits.fnorm}回${p(S.hits.fex+S.hits.fnorm)}</span></div>
    <div class="sr"><span class="sk">　├ 極限突入</span><span class="sv2">${S.hits.fex}回${p(S.hits.fex)}</span></div>
    <div class="sr"><span class="sk">　└ 非突入</span><span class="sv2">${S.hits.fnorm}回${p(S.hits.fnorm)}</span></div>
    <div class="sr"><span class="sk">⚡ チャージ</span><span class="sv2">${S.hits.bc}回${p(S.hits.bc)}</span></div>
    <div class="sr"><span class="sk">⚔️ 極限バトル成功</span><span class="sv2">${S.hits.exwin}回${exPct(S.hits.exwin)}</span></div>
    <div class="sr"><span class="sk">💔 極限バトル失敗</span><span class="sv2">${S.hits.exlost}回${exPct(S.hits.exlost)}</span></div>
    <div class="sr"><span class="sk">⚡ 7500初回</span><span class="sv2">${S.hits.lt7first}回</span></div>
    <div class="sr"><span class="sk">🟡 7500継続</span><span class="sv2">${S.hits.lt7cont}回</span></div>
    <div class="sr"><span class="sk">🟢 1500継続</span><span class="sv2">${S.hits.ltv}回</span></div>
    <div class="sr"><span class="sk">⚪ 1500終了</span><span class="sv2">${S.hits.lte}回</span></div>
    <div class="sr"><span class="sk">出玉率</span><span class="sv2" style="color:${outRate>=100?'#22c55e':'#ef4444'}">${outRate}%</span></div>
    <div style="margin-top:18px;text-align:center">
      <button class="bok" onclick="location.reload()">もう一度遊ぶ</button>
    </div>`;
  showM(html,'mse');
}
```

- [ ] **Step 3: 起動処理を追記する（セットアップ画面がないため、ページ読み込み時に即初期化する）**

```javascript
/* ============================================================
   INIT
   セットアップ画面はないため、読み込み時に即プレイ開始状態にする
============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  newState();
  updS();
});
```

- [ ] **Step 4: 構文エラーがないことを確認する**

```bash
node --check script.js
```

Expected: 終了コード0

- [ ] **Step 5: コミット**

```bash
git add script.js
git commit -m "script.js: ボタン操作・精算・起動処理を追加"
```

---

## Task 10: ブラウザでの手動検証（Playwright）

`pachinko-simulator-ghoul` プロジェクトと同じやり方（Math.randomをモックして各分岐を
強制的に踏む）で、実ブラウザ上での表示・動作を検証する。

**Files:**
- Create: `C:\Users\ab_99\AppData\Local\Temp\claude\C--Users-ab-99\000b7d2d-4c4c-4ca2-a85a-6fb34beec1f8\scratchpad\verify-garo.js`（スクラッチパッドに一時作成、リポジトリには含めない）

- [ ] **Step 1: Playwright が利用可能か確認する（`pachinko-simulator-ghoul`で導入済みのはず）**

```bash
npx --yes playwright --version
```

- [ ] **Step 2: 検証スクリプトを書く**

```javascript
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = 'file://' + path.resolve('C:/Users/ab_99/pachinko-simulator-garo/index.html').replace(/\\/g, '/');
  await page.goto(filePath);

  // 1. セットアップ画面が無く、即ゲーム画面が表示されていること
  const startVisible = await page.locator('#btn1').isVisible();
  console.log('START button visible on load:', startVisible);

  // 2. 収支のライブ表示が0円で始まること
  const shuushi0 = await page.locator('#shuushi-value').textContent();
  console.log('initial shuushi:', shuushi0);

  // 3. チャージに強制ヒットさせる（T4 <= r < T5 の範囲）
  // T1〜T5は script.js 内で const 宣言されており window 経由では参照できないため、
  // C定数と同じ値をここで直接計算する（script.js Task 6 の C 定数と同一の値を保つこと）
  await page.evaluate(() => {
    const T1=1/874.8, T2=T1+1/3499.2, T3=T2+1/874.8, T4=T3+1/583.2, T5=T4+1/1749.9;
    const mid = (T4 + T5) / 2;
    Math.random = () => mid;
  });
  await page.click('#btn1');
  await page.waitForSelector('#mb .mt');
  console.log('modal after forced charge:', await page.locator('#mb .mt').textContent());
  await page.click('#mb .bok');

  // 4. 統計パネルの投資額・持ち球が更新されていること
  console.log('mochi-dama after 1 spin:', await page.locator('#mochi-dama').textContent());
  console.log('toushi-value after 1 spin:', await page.locator('#toushi-value').textContent());

  // 5. 詳細トグルの開閉
  await page.click('#bbToggleBtn');
  console.log('detail open:', await page.locator('#bbDetail').evaluate(el => el.classList.contains('open')));

  // 6. 退店→精算画面
  await page.click('#btnr');
  await page.waitForSelector('#mb .sfin');
  console.log('settlement shown:', await page.locator('#mb .sfin').textContent());

  await browser.close();
})();
```

- [ ] **Step 3: 実行し、各ログが期待通りか目視確認する**

```bash
node "C:\Users\ab_99\AppData\Local\Temp\claude\C--Users-ab-99\000b7d2d-4c4c-4ca2-a85a-6fb34beec1f8\scratchpad\verify-garo.js"
```

Expected:
- `START button visible on load: true`（セットアップ画面をスキップして即プレイ可能）
- `initial shuushi: +0` あるいは `0`
- `modal after forced charge:` に「⚡ ガロチャージ！」相当の文言
- 1回転後、`mochi-dama`・`toushi-value` が0から変化している
- `detail open: true`
- `settlement shown:` に金額（`+¥…` または `−¥…`）

- [ ] **Step 4: 「1万円分回す」ボタンでも一連の動作が問題ないか、ブラウザで直接開いて目視確認する**

```bash
start "" "C:\Users\ab_99\pachinko-simulator-garo\index.html"
```

「1万円分回す」を数回クリックし、約170回転ずつ進むこと、途中で当たりが出た場合は
モーダルが正しく表示され「続ける」で処理が止まらず再開することを確認する。

---

## Task 11: 最終確認・README仕上げ

**Files:**
- Modify: `C:\Users\ab_99\pachinko-simulator-garo\README.md`

- [ ] **Step 1: `npm test` が通ることを再確認する**

```bash
cd "/c/Users/ab_99/pachinko-simulator-garo"
npm test
```

Expected: PASS（3 tests, 0 failures）

- [ ] **Step 2: git status で意図しない差分がないか確認する**

```bash
git status
```

Expected: `nothing to commit, working tree clean`（Task 10のスクラッチパッドスクリプトは
リポジトリ外のため含まれない）

- [ ] **Step 3: 最終コミット（差分があれば）**

```bash
git add -A
git commit -m "GARO7500グールデカ形式リニューアル: 実装完了"
```
