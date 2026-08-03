# ヘッダー再構成・演出ON/OFF・LTリザルト表示修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pachinko-simulator-garo` に対し、(1)ヘッダー行2を収支メイン表示＋回転数レート追加のレイアウトに変更、(2)牙狼剣・牙狼保留の演出をON/OFFできる設定機能（両方OFF時は先読みモード）を追加、(3)LTリザルト画面の獲得表示を実際の払い出し（1400/7000）ではなく1500/7500ベースの表示に統一する。

**Architecture:** 既存の`index.html`/`style.css`/`script.js`/`calc.js`構成に対する追加・修正のみ（新規ファイルは作らない）。確率のコア計算（合算確率から発生頻度を逆算する部分）は`calc.js`に純粋関数として追加し、`test/calc.test.js`でTDDする。ゲーム経済（`S.balls`・収支計算）には一切触れず、表示・演出の分岐ロジックのみを変更する。

**Tech Stack:** 素のHTML/CSS/JavaScript（変更なし）。テストはNode標準`node:test`（`calc.js`のみ）。ブラウザ検証はPlaywright。

参照元:
- 承認済み設計書: `docs/superpowers/specs/2026-08-03-header-yomi-mode-display-fix-design.md`
- 現状のコード: `index.html`（102行）/ `style.css`（348行）/ `script.js`（476行）/ `calc.js`（13行）

---

## Task 1: ヘッダー行2レイアウト変更（index.html + style.css）

収支をメイン表示にし、持ち球・投資を小さくし、空いたスペースに「1000円あたりの回転数」を追加する。行3の重複表示（`.fee-block`）は削除する。**script.jsの変更は不要**（`updS()`は`textContent`/`className`をid経由で更新するだけなので、見た目のサイズ調整はCSS側で完結する）。

**Files:**
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: `index.html`の行2（`.hrow2`）を書き換える**

現在の該当ブロック（12〜44行目付近の`<!-- 行2: 持ち球 / 投資 / 収支 -->`セクション）を、以下の内容に置き換える:

```html
      <!-- 行2: 持ち球 / 投資 / 収支 / 回転数レート -->
      <div class="hrow hrow2">
        <div class="money-block small">
          <span class="money-label">持ち球</span>
          <span class="money-value gold" id="mochi-dama">0</span>
          <span class="money-unit">発</span>
        </div>
        <div class="money-block small">
          <span class="money-label">投資</span>
          <span class="money-value red" id="toushi-value">0</span>
          <span class="money-unit">円</span>
        </div>
        <div class="money-block main">
          <span class="money-label">収支</span>
          <span class="money-value red" id="shuushi-value">0</span>
          <span class="money-unit">円</span>
        </div>
        <div class="rate-block">
          <span class="rate-label">1000円あたり</span>
          <span class="rate-value">17回転</span>
        </div>
      </div>
```

（`id="mochi-dama"`/`id="toushi-value"`/`id="shuushi-value"`はそのまま維持する。`script.js`の`updS()`が参照しているため、id名を変更してはいけない）

- [ ] **Step 2: `index.html`の行3（`.hrow3-header`）から`.fee-block`を削除する**

現在:
```html
        <div class="hrow3-header">
          <span class="hrow3-title">大当たり総回数</span>
          <span class="total-hit-block">
            <span class="total-hit-count" id="total-hit-count">0回</span>
          </span>
          <span class="fee-block">17回転/千円</span>
        </div>
```

変更後（`<span class="fee-block">17回転/千円</span>`の行を削除するのみ）:
```html
        <div class="hrow3-header">
          <span class="hrow3-title">大当たり総回数</span>
          <span class="total-hit-block">
            <span class="total-hit-count" id="total-hit-count">0回</span>
          </span>
        </div>
```

- [ ] **Step 3: `style.css`に行2レイアウト用のスタイルを追記する**

ファイル末尾（`.ltend-sub{...}`の後）に追記する:

```css

/* ============================================================
   GARO7500 固有: 行2レイアウト（収支メイン化・回転数レート追加）
============================================================ */
.money-block.small .money-label { font-size: 9px; }
.money-block.small .money-value { font-size: 13px; }
.money-block.small .money-unit  { font-size: 9px; }

.money-block.main .money-label { font-size: 11px; }
.money-block.main .money-value { font-size: 27px; }
.money-block.main .money-unit  { font-size: 13px; }

.rate-block { display:flex; flex-direction:column; align-items:center; gap:1px; }
.rate-label { font-size: 9px; color: #666; white-space:nowrap; }
.rate-value { font-size: 13px; font-weight: bold; color: #ccc; white-space:nowrap; }
```

- [ ] **Step 4: ブラウザで見た目を確認する**

```bash
node --check script.js
```

(index.html/style.cssには構文チェックコマンドがないため、次のPlaywrightタスク（Task 6）でまとめて見た目を検証する。ここではJSに影響がないことだけ確認する)

- [ ] **Step 5: コミット**

```bash
git add index.html style.css
git commit -m "ヘッダー行2を収支メイン表示に変更し、回転数レートを追加"
```

---

## Task 2: calc.js — 合算確率からの発生頻度逆算（TDD）

�muzzle狼剣・牙狼保留のどちらかだけONの場合に使う、「固定の当選確率」と「維持したい信頼度（見せる時の当たり率）」から「演出の発生頻度（占有する確率レンジの大きさ）」を逆算する純粋関数を追加する。

**Files:**
- Modify: `calc.js`
- Modify: `test/calc.test.js`

- [ ] **Step 1: 失敗するテストを追記する**

`test/calc.test.js`の末尾に追記する:

```javascript

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
```

`test/calc.test.js`の先頭のimport行を、この新しい関数も読み込むように変更する:

```javascript
const { floor500, computeShuushi, computeMergedRange } = require('../calc.js');
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npm test
```

Expected: FAIL（`computeMergedRange is not a function` 相当のエラー。他の既存3テストはPASSのまま）

- [ ] **Step 3: `calc.js`に関数を実装する**

`calc.js`の`computeShuushi`関数の後、`module.exports`の前に追記する:

```javascript

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
```

`module.exports`の対象に追加する:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { floor500, computeShuushi, computeMergedRange };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```

Expected: PASS（5 tests, 0 failures）

- [ ] **Step 5: コミット**

```bash
git add calc.js test/calc.test.js
git commit -m "calc.js: 合算確率からの発生頻度逆算(computeMergedRange)をTDDで追加"
```

---

## Task 3: script.js — 演出ON/OFF設定パネル（状態・UI）

牙狼剣・牙狼保留のON/OFF状態を保持するモジュール変数と、それを操作する設定パネル（既存のモーダルシステムを流用）を追加する。この時点ではまだ`oneSpin()`の抽選ロジックには反映しない（Task 4で反映する）。

**Files:**
- Modify: `script.js`
- Modify: `index.html`

- [ ] **Step 1: `script.js`のCONSTANTSセクションに表示専用定数を追記する**

`const AUTO_SPIN_COUNT = C.SPK*10; // 「1万円分回す」＝170回転`の行の直後に追記する:

```javascript
const WIN_RATE = C.P_HW + C.P_SW; // 図柄揃い当選確率（牙狼剣+牙狼保留 合算・固定、約1/440）
```

`C`オブジェクト自体（確率・獲得球数の定数）にも表示専用定数を追加する。現在の`C`の定義:

```javascript
const C={
  P_HW:1/874.8, P_HL:1/3499.2,
  P_SW:1/874.8, P_SL:1/583.2,
  P_CH:1/1749.9,
  CHB:280, B15:1400, B75:7000, BPK:250,
  PEX:0.50, PEW:0.50, PLG:0.25, PLV:0.76,
  SPK:17,      // 固定レート：17回転/千円（等価）
  EXRATE:4.0,  // 固定：等価交換（4円/4円）
};
```

これを以下に置き換える（`DISP_B15`/`DISP_B75`を追加。それ以外は変更しない）:

```javascript
const C={
  P_HW:1/874.8, P_HL:1/3499.2,
  P_SW:1/874.8, P_SL:1/583.2,
  P_CH:1/1749.9,
  CHB:280, B15:1400, B75:7000, BPK:250,
  PEX:0.50, PEW:0.50, PLG:0.25, PLV:0.76,
  SPK:17,      // 固定レート：17回転/千円（等価）
  EXRATE:4.0,  // 固定：等価交換（4円/4円）
  DISP_B15:1500, // 表示専用（実際の払い出しはB15=1400のまま変更しない）
  DISP_B75:7500, // 表示専用（実際の払い出しはB75=7000のまま変更しない）
};
```

- [ ] **Step 2: STATEセクションにトグル状態変数を追記する**

`let _busy=false, _detailOpen=false;`の行を、以下に置き換える:

```javascript
let _busy=false, _detailOpen=false;
let _swordOn=true, _holderOn=true; // 演出ON/OFF設定（ページ再読み込みでリセット、永続化しない）
```

- [ ] **Step 3: `script.js`のMODAL TEMPLATESセクション末尾（`tmLTEnd`関数の後）に設定パネルのテンプレートを追記する**

```javascript

function tmSettings(){return `
  <div class="mt" style="color:#ffd700">演出設定</div>
  <div style="font-size:12px;color:#888;margin:10px 0 18px;line-height:1.6;">
    牙狼剣・牙狼保留のON/OFFを切り替えられます。<br>
    両方OFFにすると、当たりの時だけ告知が出る「先読みモード」になります。
  </div>
  <button class="bok" style="display:block;width:100%;margin-bottom:10px;" onclick="toggleSword()">牙狼剣演出：${_swordOn?'ON':'OFF'}</button>
  <button class="bok" style="display:block;width:100%;margin-bottom:18px;" onclick="toggleHolder()">牙狼保留演出：${_holderOn?'ON':'OFF'}</button>
  <button class="bok" style="background:#2a2a2a;color:#ccc;" onclick="closeM()">閉じる</button>`;}

function toggleSword(){
  _swordOn=!_swordOn;
  showM(tmSettings(),'mn');
}
function toggleHolder(){
  _holderOn=!_holderOn;
  showM(tmSettings(),'mn');
}
function openSettings(){
  if(_busy) return;
  showM(tmSettings(),'mn');
}
```

- [ ] **Step 4: `lockAll()`に設定ボタンのidを追加する**

現在:
```javascript
function lockAll(v){
  ['btn1','btnauto','btnr'].forEach(id=>{document.getElementById(id).disabled=v;});
}
```

変更後:
```javascript
function lockAll(v){
  ['btn1','btnauto','btnr','btnsettings'].forEach(id=>{document.getElementById(id).disabled=v;});
}
```

- [ ] **Step 5: `index.html`の操作パネル（`#ctrl`）に設定ボタンを追加する**

現在:
```html
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
```

変更後（`btnr`を`div`で囲み、`btnsettings`を追加）:
```html
    <div id="ctrl" style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px;">
      <button class="btn-start" id="btn1" onclick="doSpin1()">START</button>
      <div class="auto-spin-wrap">
        <div class="auto-spin-btns">
          <button class="btn-auto" id="btnauto" onclick="doSpinAuto()">1万円分回す</button>
        </div>
        <p class="spin-cost-hint" id="autoHint">約170回転分</p>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-taiten" id="btnsettings" onclick="openSettings()">⚙ 演出設定</button>
        <button class="btn-taiten" id="btnr" onclick="doRetire()">退店する</button>
      </div>
    </div>
```

- [ ] **Step 6: 構文エラーがないことを確認する**

```bash
node --check script.js
```

Expected: 終了コード0

- [ ] **Step 7: コミット**

```bash
git add script.js index.html
git commit -m "script.js: 演出ON/OFF設定パネル（状態・UI）を追加"
```

---

## Task 4: script.js — oneSpin()を4モード対応に書き換える（確率ロジック本体）

牙狼剣・牙狼保留のON/OFF状態に応じて、実際の抽選処理を切り替える。**図柄揃いの当選確率（`WIN_RATE`）はどのモードでも一切変更しない**（設計書の確率モデルを参照）。

**Files:**
- Modify: `script.js`

- [ ] **Step 1: 「先祝告知発生！」のテンプレートを追記する（`tmSettings`関数の前に追記）**

```javascript
function tmYomiAnnounce(){return `
  <div class="mt" style="color:#ffd700">🎉 先祝告知発生！</div>
  <div style="font-size:13px;color:#aaa;margin:12px 0 18px;">図柄揃いのチャンス...！</div>
  <button class="bok" onclick="closeM()">確認</button>`;}

```

- [ ] **Step 2: `oneSpin()`関数全体を、以下の内容に置き換える**

現在の`oneSpin()`（ONE SPINセクション全体）:

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

これを以下に置き換える:

```javascript
/* ============================================================
   FIG ZONE
   牙狼剣・牙狼保留のON/OFF状態から、今回の抽選で使う確率レンジを決める。
   図柄揃いの当選確率（WIN_RATE）はどのモードでも常に一定。
============================================================ */
function getFigZone(){
  if(_holderOn && _swordOn) return {mode:'both'};
  if(_holderOn && !_swordOn){
    const b=computeMergedRange(WIN_RATE, 0.80); // 牙狼保留の信頼度80%を維持
    return {mode:'holderOnly', winBoundary:b.winBoundary, totalBoundary:b.totalBoundary};
  }
  if(!_holderOn && _swordOn){
    const b=computeMergedRange(WIN_RATE, 0.40); // 牙狼剣の信頼度40%を維持
    return {mode:'swordOnly', winBoundary:b.winBoundary, totalBoundary:b.totalBoundary};
  }
  return {mode:'yomi'};
}

async function doHolderOrSwordEvent(isHolder, win){
  flushInvest();
  if(isHolder){
    await showM(tmHolderPre(S.cur),'mh');
    await showM(tmHolderResult(win),'mh');
    if(!win) addH(`${S.cur}回転目：牙狼保留出現（ハズレ）`);
    if(win) await doHit('holder');
  } else {
    await showM(tmSwordPre(S.cur),'ms');
    await showM(tmSwordResult(win),'ms');
    if(!win) addH(`${S.cur}回転目：牙狼剣出現（ハズレ）`);
    if(win) await doHit('sword');
  }
  return {stopped:true};
}

async function doChargeHit(){
  flushInvest();
  award(C.CHB);
  S.hits.total++; S.hits.bc++;
  addH(`${S.cur}回転目：牙狼チャージ！（+${C.CHB}発）`);
  updS();
  await showM(tmCharge(S.cur),'mc');
  return {stopped:true};
}

/* ============================================================
   ONE SPIN
============================================================ */
async function oneSpin(){
  ensureBalls();
  consume(); updS();

  const r=Math.random();
  const zone=getFigZone();

  if(zone.mode==='both'){
    if(r<T2) return await doHolderOrSwordEvent(true, r<T1);
    if(r<T4) return await doHolderOrSwordEvent(false, r<T3);
    if(r<T5) return await doChargeHit();
    return {ok:true};
  }

  if(zone.mode==='holderOnly' || zone.mode==='swordOnly'){
    if(r<zone.totalBoundary) return await doHolderOrSwordEvent(zone.mode==='holderOnly', r<zone.winBoundary);
    if(r<zone.totalBoundary+C.P_CH) return await doChargeHit();
    return {ok:true};
  }

  // yomi（両方OFF）：発生範囲・当落判定は通常時のT1〜T4と完全に同一（変更しない）
  if(r<T4){
    const win=(r<T1)||(r>=T2&&r<T3);
    if(win){
      flushInvest();
      await showM(tmYomiAnnounce(),'mn');
      await doHit('yomi');
      return {stopped:true};
    }
    return {ok:true}; // サイレントミス：モーダル・履歴なし。auto-spinも止まらず継続
  }
  if(r<T5) return await doChargeHit();
  return {ok:true};
}
```

- [ ] **Step 3: `doHit()`の`ev`（履歴表示用の文言）に`yomi`タイプを追加する**

`async function doHit(type){`の中の以下の行:

```javascript
  const ev=type==='holder'?'牙狼保留→図柄揃い':'牙狼剣→図柄揃い';
```

を、以下に置き換える（この時点では`runBalls`/`nominalGain`はまだ触らない。Task 5で扱う）:

```javascript
  const ev={holder:'牙狼保留→図柄揃い', sword:'牙狼剣→図柄揃い', yomi:'先読み→図柄揃い'}[type];
```

- [ ] **Step 4: 構文エラーがないことを確認する**

```bash
node --check script.js
```

Expected: 終了コード0

- [ ] **Step 5: コミット**

```bash
git add script.js
git commit -m "script.js: 演出ON/OFF状態に応じた4モードの抽選ロジックを実装"
```

---

## Task 5: script.js — LTリザルトを1500ベース表示に統一する（doHit + テンプレート修正）

`doHit()`内の`runBalls`（実経済ベース・1400/7000）による表示を、表示専用の`nominalGain`（1500/7500ベース、初当たり分も含めた全体合計）に置き換える。**`award()`の呼び出し・引数・`S.balls`への反映は一切変更しない**（経済は完全に不変）。

**Files:**
- Modify: `script.js`

- [ ] **Step 1: `doHit()`関数全体を、以下の内容に置き換える**

現在の`doHit()`（Task 4のStep 3で`ev`の行を変更済みのもの）:

```javascript
async function doHit(type){
  const spin0=S.cur;

  // 初当たり（図柄揃い）
  award(C.B15);
  updS();
  await showM(tmFig(),'mn');

  let runBalls=C.B15, parts=[];
  const ev={holder:'牙狼保留→図柄揃い', sword:'牙狼剣→図柄揃い', yomi:'先読み→図柄揃い'}[type];

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

これを以下に置き換える（`award()`の呼び出しと引数は一切変更していない。`runBalls`を廃止し、代わりに表示専用の`nominalGain`をDISP定数で積み上げる）:

```javascript
async function doHit(type){
  const spin0=S.cur;

  // 初当たり（図柄揃い）
  award(C.B15);
  updS();
  await showM(tmFig(),'mn');

  let nominalGain=C.DISP_B15, parts=[];
  const ev={holder:'牙狼保留→図柄揃い', sword:'牙狼剣→図柄揃い', yomi:'先読み→図柄揃い'}[type];

  if(Math.random()<C.PEX){
    // 極限7500バトル突入（50%）
    S.hits.total++; S.hits.fex++;
    await showM(tmExIn(),'mba');
    await showM(tmExJudge(),'mba');

    if(Math.random()<C.PEW){
      // 極限WIN → 7500 + LT突入
      award(C.B75);
      S.hits.total++; S.hits.exwin++; S.hits.lt7first++;
      nominalGain+=C.DISP_B75; parts.push('7500初回');
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
          nominalGain+=C.DISP_B75; parts.push('7500継続');
          updS();
          await blackout();
          await showM(tmLTGaro(ltN),'m7');
        } else if(r<C.PLV){
          award(C.B15);
          S.hits.total++; S.hits.ltv++; b1500This++;
          nominalGain+=C.DISP_B15; parts.push('継続');
          updS();
          await showM(tmLTVic(ltN),'mvi');
        } else {
          award(C.B15);
          S.hits.total++; S.hits.lte++;
          nominalGain+=C.DISP_B15; parts.push('終了');
          updS();
          await showM(tmLTEnd(ltN,b7500This,b1500This,nominalGain),'me');
          break;
        }
      }
      addH(`${spin0}回転目：${ev} → 極限突入 → LT${ltN}連(${parts.join('→')}) → 計${nominalGain}発`,'hit');

    } else {
      // 極限LOSE → 1500終了
      award(C.B15);
      S.hits.total++; S.hits.exlost++;
      nominalGain+=C.DISP_B15;
      updS();
      await showM(tmExLose(),'me');
      addH(`${spin0}回転目：${ev} → 極限突入 → バトル敗北 → 計${nominalGain}発`,'hit');
    }

  } else {
    // 非突入・通常時へ（50%）
    S.hits.total++; S.hits.fnorm++;
    updS();
    await showM(tmFigMiss(),'me');
    addH(`${spin0}回転目：${ev} → 非突入 → 計${nominalGain}発`,'hit');
  }

  S.cur=0;
  updS();
}
```

- [ ] **Step 2: `tmExWin`の獲得表示を`DISP_B75`に変更する**

現在:
```javascript
function tmExWin(){return `
  ${imgDiv('images/extreme_win.jpg','極限7500ボーナス\n画像プレースホルダー')}
  <div class="mt" style="color:#ffd700">🏆 極限7500ボーナス！</div>
  <div class="bm">7500ボーナス！</div>
  <div class="bs">（獲得 ${C.B75}発）</div>
  <div style="color:#22c55e;font-weight:bold;margin:10px 0">🌟 魔戒CHANCE LT 突入！！</div>
  <button class="bok" onclick="closeM()">魔戒CHANCE LTへ →</button>`;}
```

`（獲得 ${C.B75}発）`を`（獲得 ${C.DISP_B75}発）`に変更する。

- [ ] **Step 3: `tmExLose`の獲得表示を`DISP_B15`に変更する**

現在:
```javascript
function tmExLose(){return `
  <div class="mt" style="color:#888">😢 バトル敗北…</div>
  <div class="bm">1500ボーナス！</div>
  <div class="bs">（獲得 ${C.B15}発）</div>
  <div style="font-size:11px;color:#555;margin-bottom:14px">通常時へ戻る</div>
  <button class="bok" onclick="closeM()">続ける</button>`;}
```

`（獲得 ${C.B15}発）`を`（獲得 ${C.DISP_B15}発）`に変更する。

- [ ] **Step 4: `tmLTGaro`の獲得表示を`DISP_B75`に変更する**

現在:
```javascript
function tmLTGaro(n){return `
  ${imgDiv('images/god.jpg','GOD OF GARO 7500\n画像プレースホルダー')}
  <div class="mt" style="color:#ffd700">👑 GOD OF GARO！7500！</div>
  <div class="ltl">連チャン数</div>
  <div class="ltc" style="color:#ffd700">${n}</div>
  <div class="bm">7500ボーナス！</div>
  <div class="bs">（獲得 ${C.B75}発）</div>
  <div style="color:#ffd700;font-weight:bold;margin-bottom:12px">LT継続！！</div>
  <button class="bok" onclick="closeM()">続ける！</button>`;}
```

`（獲得 ${C.B75}発）`を`（獲得 ${C.DISP_B75}発）`に変更する。

- [ ] **Step 5: `tmLTVic`の獲得表示を`DISP_B15`に変更する**

現在:
```javascript
function tmLTVic(n){return `
  <div class="mt" style="color:#22c55e">🎉 1500継続ボーナス！</div>
  <div class="ltl">連チャン数</div>
  <div class="ltc" style="color:#22c55e">${n}</div>
  <div class="bm">1500ボーナス！</div>
  <div class="bs">（獲得 ${C.B15}発）</div>
  <div style="color:#22c55e;font-weight:bold;margin-bottom:12px">LT継続！</div>
  <button class="bok" onclick="closeM()">続ける！</button>`;}
```

`（獲得 ${C.B15}発）`を`（獲得 ${C.DISP_B15}発）`に変更する。

- [ ] **Step 6: `tmLTEnd`の表示を`DISP_B15`ベースに変更する**

現在:
```javascript
function tmLTEnd(n,b7500,b1500,totalGain){return `
  <div class="mt" style="color:#aaa">🌙 ${n}連チャン終了</div>
  <div class="ltend-row"><span>🎯 図柄揃い</span><span>${C.B15.toLocaleString()}発</span></div>
  <div class="ltend-row"><span>7500ボーナス</span><span>${b7500}回</span></div>
  <div class="ltend-row"><span>1500ボーナス</span><span>${b1500}回</span></div>
  <div class="ltend-total">合計獲得　${totalGain.toLocaleString()}発</div>
  <div class="ltend-sub">終了ボーナス（獲得 ${C.B15}発）</div>
  <button class="bok" style="margin-top:16px" onclick="closeM()">通常時へ戻る</button>`;}
```

これを以下に置き換える（関数シグネチャは変更しない。呼び出し側はTask 5 Step 1で既に`nominalGain`を渡すよう変更済み）:

```javascript
function tmLTEnd(n,b7500,b1500,totalGain){return `
  <div class="mt" style="color:#aaa">🌙 ${n}連チャン終了</div>
  <div class="ltend-row"><span>🎯 図柄揃い</span><span>${C.DISP_B15.toLocaleString()}発</span></div>
  <div class="ltend-row"><span>7500ボーナス</span><span>${b7500}回</span></div>
  <div class="ltend-row"><span>1500ボーナス</span><span>${b1500}回</span></div>
  <div class="ltend-total">合計獲得　${totalGain.toLocaleString()}発</div>
  <div class="ltend-sub">終了ボーナス（獲得 ${C.DISP_B15}発）</div>
  <button class="bok" style="margin-top:16px" onclick="closeM()">通常時へ戻る</button>`;}
```

- [ ] **Step 7: 構文エラーがないことを確認する**

```bash
node --check script.js
```

Expected: 終了コード0

- [ ] **Step 8: `runBalls`が完全に廃止され、`award()`の呼び出し内容が変更されていないことを確認する**

```bash
grep -n "runBalls" script.js
grep -n "award(" script.js
```

Expected: `runBalls`は0件（完全に削除されている）。`award(`の呼び出しは`award(C.B15)`/`award(C.B75)`/`award(C.CHB)`のみで、Task 5開始前と全く同じ引数であること（`grep`結果を目視で確認する）。

- [ ] **Step 9: コミット**

```bash
git add script.js
git commit -m "script.js: LTリザルト・獲得表示を1500ベースに統一（経済ロジックは無変更）"
```

---

## Task 6: Playwrightでの動作検証

3つの変更点すべてを実ブラウザで検証する。特に②の確率モデルは`Math.random`をモックして4モードすべての境界値を直接検証する（統計的検証ではなく、決定論的な境界値チェックで正しさを保証する）。

**Files:**
- Create: `C:\Users\ab_99\AppData\Local\Temp\garo-verify-v2.js`（スクラッチ、リポジトリには含めない）
- Create: `C:\Users\ab_99\AppData\Local\Temp\garo-verify-v2b.js`（スクラッチ、リポジトリには含めない、Step 3で作成）

- [ ] **Step 1: 検証スクリプトを書く**

```javascript
const { chromium } = require('playwright');
const path = require('path');

const P_HW=1/874.8, P_HL=1/3499.2, P_SW=1/874.8, P_SL=1/583.2, P_CH=1/1749.9;
const T1=P_HW, T2=T1+P_HL, T3=T2+P_SW, T4=T3+P_SL, T5=T4+P_CH;
const WIN_RATE=P_HW+P_SW;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const filePath = 'file://' + path.resolve('C:/Users/ab_99/pachinko-simulator-garo/index.html').replace(/\\/g, '/');

  // ---------- ① ヘッダー行2レイアウト ----------
  await page.goto(filePath);
  console.log('=== ① header layout ===');
  console.log('shuushi-value exists:', await page.locator('#shuushi-value').isVisible());
  console.log('rate-block text:', await page.locator('.rate-block').textContent());
  console.log('fee-block count in hrow3 (should be 0):', await page.locator('.hrow3 .fee-block').count());
  const mainFont = await page.locator('.money-block.main .money-value').evaluate(el => getComputedStyle(el).fontSize);
  const smallFont = await page.locator('.money-block.small .money-value').first().evaluate(el => getComputedStyle(el).fontSize);
  console.log('shuushi font-size:', mainFont, ' / mochi-dama font-size:', smallFont, '(shuushi should be larger)');

  // ---------- ② 演出設定パネルの開閉・トグル ----------
  console.log('=== ② settings panel ===');
  await page.click('#btnsettings');
  await page.waitForSelector('#mb .mt');
  console.log('sword toggle initial:', await page.locator('#mb button').nth(0).textContent());
  await page.click('#mb button >> nth=0'); // 牙狼剣をOFFに
  console.log('sword toggle after click:', await page.locator('#mb button').nth(0).textContent());
  await page.click('#mb button >> nth=0'); // 牙狼剣を再びONに戻す
  console.log('sword toggle after 2nd click:', await page.locator('#mb button').nth(0).textContent());
  await page.click('#mb button >> nth=2'); // 閉じる
  console.log('modal closed:', await page.locator('#ov').evaluate(el => el.classList.contains('h')));

  // ---------- ② 4モードの境界値チェック（決定論的） ----------
  console.log('=== ② probability mode boundary checks ===');

  async function setToggle(swordOn, holderOn){
    // 注意: _swordOn/_holderOn は script.js 内のトップレベル let 変数であり window のプロパティにはならないが、
    // page.evaluate に渡す関数はページのグローバル実行コンテキストで動くため、
    // window.プレフィックスを付けずに識別子として直接代入すればスコープチェーン経由で正しく書き換えられる。
    await page.evaluate(([s,h]) => { _swordOn=s; _holderOn=h; }, [swordOn, holderOn]);
  }
  async function mockRandom(value){
    await page.evaluate((v) => { Math.random = () => v; }, value);
  }
  async function forceSpinAndReadModalTitle(){
    await page.click('#btn1');
    await page.waitForSelector('#mb .mt', {timeout:5000}).catch(()=>null);
    const ovHidden = await page.locator('#ov').evaluate(el => el.classList.contains('h'));
    if (ovHidden) return '(no modal / silent)';
    const firstTitle = await page.locator('#mb .mt').textContent();
    // 最初のモーダルタイトルだけを読み取りたいが、当たりの場合はこの後 doHit() の
    // 連鎖でさらに複数のモーダルが続く（pre→result の2段階や、当選時のLT連鎖など）。
    // 次のテストのために、#btn1 が再び有効になる（=_busyが解除される）までボタンを
    // 押し続けて画面をクリアな状態に戻す。
    for (let i=0; i<20; i++){
      const busy = await page.locator('#btn1').isDisabled();
      if (!busy) break;
      const btn = page.locator('#mb button').first();
      if (await btn.count() > 0) await btn.click().catch(()=>null);
      await page.waitForTimeout(150);
    }
    return firstTitle;
  }

  await setToggle(true, true); // 両方ON（通常）
  await mockRandom(T1/2); // r<T1 → holder win範囲
  console.log('[both] r in holder-win range:', await forceSpinAndReadModalTitle());

  await setToggle(true, false); // 牙狼剣のみON（swordOn=true, holderOn=false）
  await mockRandom(WIN_RATE/2); // computeMergedRange(WIN_RATE,0.40).winBoundary=WIN_RATE より小さい → 剣side win
  console.log('[swordOnly] r < winBoundary (should be sword win):', await forceSpinAndReadModalTitle());

  await setToggle(true, false); // 牙狼剣のみON、ミス範囲を狙う
  await mockRandom(WIN_RATE + (WIN_RATE/0.40 - WIN_RATE)/2); // winBoundaryとtotalBoundaryの中間 → miss
  console.log('[swordOnly] r in miss range (should be sword miss, no doHit):', await forceSpinAndReadModalTitle());

  await setToggle(false, true); // 牙狼保留のみON（swordOn=false, holderOn=true）
  await mockRandom(WIN_RATE/2);
  console.log('[holderOnly] r < winBoundary (should be holder win):', await forceSpinAndReadModalTitle());

  await setToggle(false, false); // 先読みモード：ミスを狙う（T3〜T4の範囲、winではない側）
  await mockRandom(T3 + (T4-T3)/2);
  const beforeLogCount = await page.locator('#log-list .hi').count();
  await page.click('#btn1');
  await page.waitForTimeout(300);
  const afterLogCount = await page.locator('#log-list .hi').count();
  const ovHiddenAfterMiss = await page.locator('#ov').evaluate(el => el.classList.contains('h'));
  console.log('[yomi] silent miss: modal hidden=', ovHiddenAfterMiss, ' log entries added=', afterLogCount-beforeLogCount, '(both should indicate nothing happened)');

  await setToggle(false, false); // 先読みモード：当たりを狙う
  await mockRandom(T1/2);
  console.log('[yomi] win → announce:', await forceSpinAndReadModalTitle());

  console.log('page errors so far:', errors);
  await browser.close();
})();
```

- [ ] **Step 2: 実行し、各出力を確認する**

```bash
node "C:\Users\ab_99\AppData\Local\Temp\garo-verify-v2.js"
```

Expected（要点）:
- `shuushi-value exists: true`
- `rate-block text:` に「1000円あたり17回転」相当の文字列
- `fee-block count in hrow3 (should be 0): 0`
- shuushiのfont-sizeがmochi-damaのfont-sizeより大きい
- 演出設定パネルのボタン文言が`ON`→`OFF`→`ON`と正しく切り替わる
- `[both]`: 牙狼保留のモーダルタイトル（🌟 牙狼保留）が出る
- `[swordOnly]`当たり判定: 牙狼剣のモーダル（⚔️ 牙狼剣）が出る
- `[swordOnly]`ミス判定: 牙狼剣のモーダル（⚔️ 牙狼剣、ハズレ）が出る（**先読みモードではないので通常通りモーダルが出ることに注意**）
- `[holderOnly]`: 牙狼保留のモーダルが出る
- `[yomi]`サイレントミス: `ovHidden=true`かつ`log entries added=0`
- `[yomi]`当たり: 「🎉 先祝告知発生！」のモーダルが出る
- `page errors so far: []`

いずれかが期待と異なる場合、`script.js`の`getFigZone()`/`oneSpin()`のロジックを見直す。

- [ ] **Step 3: LTリザルトの1500ベース表示を検証する（GOD OF GAROで7500継続後に転落させる）**

`C:\Users\ab_99\AppData\Local\Temp\garo-verify-v2b.js` という新しいファイルに、以下のスクリプトを書く:

```javascript
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = 'file://' + path.resolve('C:/Users/ab_99/pachinko-simulator-garo/index.html').replace(/\\/g, '/');
  await page.goto(filePath);

  // holder win → 極限バトル突入 → 極限WIN → LT1回目で転落(1500終了)
  // という一連の分岐を、Math.randomの返り値を都度差し替えて強制する。
  await page.evaluate(() => {
    const T1=1/874.8;
    const seq = [
      T1/2,     // oneSpin: holder win
      0.1,      // doHit: PEX(0.5)未満 → 極限突入
      0.1,      // doHit: PEW(0.5)未満 → 極限WIN
      0.9,      // LTループ1回目: PLG(0.25)以上・PLV(0.76)以上 → 終了(転落)
    ];
    let i=0;
    Math.random = () => (i < seq.length ? seq[i++] : 0.99);
  });

  await page.click('#btn1');
  // holderPre → holderResult → tmFig → tmExIn → tmExJudge → tmExWin → tmLTIn → tmLTEnd の順で
  // モーダルが出るたびに閉じるボタンを押して進める。
  for (let i=0; i<8; i++){
    await page.waitForSelector('#mb button', {timeout:5000});
    const title = await page.locator('#mb .mt').textContent().catch(()=> '');
    console.log(`step ${i}: modal title = ${title}`);
    if (title.includes('連チャン終了')) {
      const total = await page.locator('.ltend-total').textContent();
      const figRow = await page.locator('.ltend-row').first().textContent();
      const endBonus = await page.locator('.ltend-sub').textContent();
      console.log('合計獲得表示:', total.trim());
      console.log('図柄揃い行:', figRow.trim());
      console.log('終了ボーナス表示:', endBonus.trim());
      break;
    }
    await page.click('#mb button >> nth=0');
  }

  await browser.close();
})();
```

- [ ] **Step 4: 実行し、金額表示を確認する**

```bash
node "C:\Users\ab_99\AppData\Local\Temp\garo-verify-v2b.js"
```

Expected:
- `合計獲得表示:` に **`合計獲得　10,500発`**（1500+7500+1500）が表示される（8400ではないこと）
- `図柄揃い行:` に **`1,500発`**（1400ではないこと）が含まれる
- `終了ボーナス表示:` に **`1500発`**（1400ではないこと）が含まれる

期待と異なる場合、`doHit()`の`nominalGain`の初期値・加算箇所（Task 5 Step 1）を再確認する。

- [ ] **Step 5: `npm test`が引き続き通ることを確認する**

```bash
npm test
```

Expected: PASS（5 tests, 0 failures）

---

## Task 7: 最終確認・コミット

- [ ] **Step 1: 全体を通しで`node --check`する**

```bash
node --check script.js
node --check calc.js
```

Expected: どちらも終了コード0

- [ ] **Step 2: `npm test`を再確認する**

```bash
npm test
```

Expected: PASS（5 tests, 0 failures）

- [ ] **Step 3: `git status`で意図しない差分がないか確認する**

```bash
git status
```

Expected: `nothing to commit, working tree clean`（Task 6のスクラッチスクリプトはリポジトリ外のため含まれない）

- [ ] **Step 4: 最終コミット（差分があれば）**

```bash
git add -A
git commit -m "ヘッダー再構成・演出ON/OFF・LTリザルト表示修正: 実装完了"
```
