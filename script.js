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
  DISP_B15:1500, // 表示専用（実際の払い出しはB15=1400のまま変更しない）
  DISP_B75:7500, // 表示専用（実際の払い出しはB75=7000のまま変更しない）
};
const T1=C.P_HW, T2=T1+C.P_HL, T3=T2+C.P_SW, T4=T3+C.P_SL, T5=T4+C.P_CH;
const AUTO_SPIN_COUNT = C.SPK*10; // 「1万円分回す」＝170回転
const WIN_RATE = C.P_HW + C.P_SW; // 図柄揃い当選確率（牙狼剣+牙狼保留 合算・固定、約1/440）

/* ============================================================
   STATE
============================================================ */
let S={};
let _busy=false, _detailOpen=false;
let _swordOn=true, _holderOn=true; // 演出ON/OFF設定（ページ再読み込みでリセット、永続化しない）

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

function tmYomiAnnounce(){return `
  <div class="mt" style="color:#ffd700">🎉 先祝告知発生！</div>
  <div style="font-size:13px;color:#aaa;margin:12px 0 18px;">図柄揃いのチャンス...！</div>
  <button class="bok" onclick="closeM()">確認</button>`;}

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

/* ============================================================
   FIG ZONE
   牙狼剣・牙狼保留のON/OFF状態から、今回の抽選で使う確率レンジを決める。
   図柄揃いの当選確率（WIN_RATE）はどのモードでも常に一定。
============================================================ */
function getFigZone(){
  if(_holderOn && _swordOn) return {mode:'both'};
  if(_holderOn && !_swordOn){
    const confidence = C.P_HW / (C.P_HW + C.P_HL); // 牙狼保留の信頼度（=画面の「80%」表示と同一の値）
    const b=computeMergedRange(WIN_RATE, confidence);
    return {mode:'holderOnly', winBoundary:b.winBoundary, totalBoundary:b.totalBoundary};
  }
  if(!_holderOn && _swordOn){
    const confidence = C.P_SW / (C.P_SW + C.P_SL); // 牙狼剣の信頼度（=画面の「40%」表示と同一の値）
    const b=computeMergedRange(WIN_RATE, confidence);
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

/* ============================================================
   BUTTON HANDLERS
============================================================ */
function lockAll(v){
  ['btn1','btnauto','btnr','btnsettings'].forEach(id=>{document.getElementById(id).disabled=v;});
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

/* ============================================================
   INIT
   セットアップ画面はないため、読み込み時に即プレイ開始状態にする
============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  newState();
  updS();
});
