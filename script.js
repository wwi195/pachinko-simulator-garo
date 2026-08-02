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
