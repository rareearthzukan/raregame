/* ============================================================
   uranai.js - イットリウムの「レアアース診断」全画面UI
   使い方: メインのHTMLの </script> のあと（</body>の直前）に
           <script src="uranai.js"></script>
   を1行追加するだけ。旧 openGameUranai / calcGameUranai は上書きされます。
   ============================================================ */
(function(){
const css = `
.modal{max-height:92vh;overflow-y:auto}
#uranaiOv{position:fixed;inset:0;z-index:250;display:none;justify-content:center;background:rgba(5,8,25,.88)}
.ur-box{width:100%;max-width:32rem;display:flex;flex-direction:column;color:#fff;
  background:linear-gradient(180deg,#1e1b4b 0%,#312e81 55%,#1e293b 100%);
  padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0)}
.ur-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .7rem;border-bottom:1px solid rgba(255,255,255,.18);flex-shrink:0;font-size:.85rem}
.ur-back{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:1rem;padding:.3rem .8rem;min-height:2rem;font-size:.72rem;font-weight:bold;cursor:pointer;font-family:inherit}
.ur-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:.8rem .9rem 1.2rem;font-size:.8rem;line-height:1.55}
.ur-bubble{display:flex;gap:.6rem;align-items:flex-start;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:.9rem;padding:.7rem;margin-bottom:1rem}
.ur-bubble img{width:3.4rem;height:3.4rem;border-radius:50%;object-fit:contain;background:#fff;flex-shrink:0}
.ur-main{display:block;width:100%;background:linear-gradient(90deg,#10b981,#3b82f6);color:#fff;border:none;border-radius:.9rem;min-height:2.8rem;font-size:.9rem;font-weight:bold;cursor:pointer;font-family:inherit;margin-top:.8rem}
.ur-sub{display:block;width:100%;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:.9rem;min-height:2.4rem;font-size:.78rem;font-weight:bold;cursor:pointer;font-family:inherit;margin-top:.5rem}
.ur-prog{height:.5rem;background:rgba(255,255,255,.15);border-radius:1rem;overflow:hidden;margin:.2rem 0 .8rem}
.ur-prog i{display:block;height:100%;background:linear-gradient(90deg,#10b981,#38bdf8);transition:width .25s}
.ur-tag{display:inline-block;font-size:.65rem;font-weight:bold;padding:.1rem .6rem;border-radius:1rem;color:#fff}
.ur-q{font-size:1.02rem;font-weight:bold;margin:.5rem 0 1rem;line-height:1.5}
.ur-opt{display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.22);color:#fff;border-radius:.8rem;padding:.65rem .8rem;margin-bottom:.45rem;font-size:.82rem;cursor:pointer;font-family:inherit;min-height:2.8rem}
.ur-opt:active{transform:scale(.98)}
.ur-opt .dot{width:1rem;height:1rem;border-radius:50%;border:2px solid rgba(255,255,255,.6);flex-shrink:0}
.ur-opt.sel{background:rgba(59,130,246,.45);border-color:#38bdf8}
.ur-opt.sel .dot{background:#38bdf8;border-color:#fff}
.ur-card{background:#fff;color:#1e293b;border-radius:1rem;padding:1rem;text-align:center;border-top:.35rem solid #3b82f6;box-shadow:0 .4rem 1.2rem rgba(0,0,0,.35)}
.ur-card .lbl{display:inline-block;background:#3b82f6;color:#fff;font-size:.65rem;font-weight:bold;border-radius:1rem;padding:.1rem .7rem}
.ur-card h3{margin:.5rem 0 .2rem;font-size:1.25rem}
.ur-img{width:7.5rem;height:7.5rem;object-fit:contain;margin:.4rem auto;display:block}
.ur-emoji{font-size:4rem;line-height:1.2}
.ur-catch{color:#2563eb;font-style:italic;font-size:.78rem;margin:.2rem 0}
.ur-pct{font-size:.85rem;margin:.3rem 0}.ur-pct b{color:#e11d48;font-size:1.3rem}
.ur-long{background:#f1f5f9;border-radius:.6rem;padding:.6rem;font-size:.76rem;text-align:left;margin-top:.5rem}
.ur-axis{text-align:left;margin-top:.8rem;font-size:.7rem}
.ur-axis .r{display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem}
.ur-axis .n{width:4.6rem;font-weight:bold;flex-shrink:0}
.ur-axis .bar{flex:1;height:.6rem;background:#e2e8f0;border-radius:1rem;overflow:hidden}
.ur-axis .bar i{display:block;height:100%;border-radius:1rem}
.ur-near{margin-top:.9rem;font-size:.72rem;color:#fff}
.ur-near span{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:1rem;padding:.15rem .7rem;margin:.2rem .2rem 0 0}
`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
const ov=document.createElement('div'); ov.id='uranaiOv'; document.body.appendChild(ov);
const au=document.createElement('audio'); au.src='BGM_home_cute.ogg'; au.loop=true; au.volume=.35; document.body.appendChild(au);

const AX={E:['行動力','#f59e0b'],A:['気づき力','#ec4899'],S:['こだわり','#8b5cf6'],C:['ひらめき','#10b981']};
const QS=[
 ['E','活力','人と話すと元気になる'],
 ['E','挑戦','新しいことに挑戦するのはわくわくする'],
 ['E','行動','思いついたらすぐ動くほうだ'],
 ['A','承認','がんばったときはだれかに気づいてほしい'],
 ['A','違和感','いつもと様子がちがうことに気づくほうだ'],
 ['A','空気','人がいる場で空気が変わるとすぐ気づく'],
 ['S','没頭','好きなことにはまわりが見えなくなるほど集中する'],
 ['S','美学','どんな時も、自分なりのスタイルや美学を崩さずにいたい'],
 ['S','信念','自分の考えはわりと曲げないほうだ'],
 ['C','ひらめき','アイデアは急に思いつくことが多い'],
 ['C','即断','なにかを決めるときはわりと早く決められる'],
 ['C','直感重視','複雑に考えるより、直感で動くことを大切にしている']
];
const OPT=[[2,'とてもあてはまる'],[1,'ややあてはまる'],[0,'どちらでもない'],[-1,'あまりあてはまらない'],[-2,'まったくあてはまらない']];

// [名前,記号,絵文字,画像,キャッチ,短評,解説,E,A,S,C]
const EL=[
 ['ツリウム','Tm','🌫','Tm2.png','必要な時にだけ現れる、幻の救世主','控えめな実力者。いざという時の決定打。','あなたは必要なときに力を発揮する、「レアな安定感を持つ、隠れた実力派」です。',-0.5,0,1,-3],
 ['スカンジウム','Sc','🧲','Sc2.png','あらゆる可能性を底上げする、希代の補強材','信頼で強くする人。土台を支える安定型。','あなたは「土台を静かに固める、隠れた功労者」です。',1.5,0.5,-0.5,-2],
 ['イットリウム','Y','🧩','Y2.png','バラバラの個体をつなぎ止める、世界の接着剤','場を整えるつなぎ役。天性の調律師。','あなたは「場の摩擦を消し去る、天性の調律師」です。',0,2,-2,-1],
 ['ランタン','La','🌞','La2.png','未来を照らす、安定の蓄電池','場を明るく回すまとめ役。エネルギーの源泉。','あなたは「自然と人が集まる、エネルギーの源泉」です。',3,1,-0.5,0.5],
 ['セリウム','Ce','⚙','Ce2.png','澱みを磨き上げる、完璧な研磨師','現場を回す実務家。改善のプロ。','あなたは改善のプロ、「無駄を削ぎ落とし、輝きを引き出す実務家」です。',2,-2,1,2],
 ['プラセオジム','Pr','🎨','Pr2.png','世界に独自の彩りを与える、孤高の色彩家','感性の職人。日常に彩りを与える人。','あなたは「日常に彩りを与えるアーティスト」です。',-2,2,1.5,-1.5],
 ['ネオジム','Nd','🧲','Nd2.png','すべてを惹きつけ、世界を回す最強のエンジン','動かすリーダー。推進力のエース。','あなたは圧倒的リーダーです。',3,0,1,2],
 ['プロメチウム','Pm','🔬','Pm2.png','闇の中で自ら光る、神秘の探求者','深く考える人。知の求道者。','あなたは知の求道者です。',-3,-2,2.5,0.5],
 ['サマリウム','Sm','🔥','Sm2.png','熱を力に変える、不屈の耐熱ランナー','耐える人。タフな不屈派。','あなたはタフな不屈派です。',2,-2.5,2.5,0],
 ['ユウロピウム','Eu','✨','Eu3.png','暗闇を鮮やかに染める、光の表現者','輝く表現者。華やかさは才能。','あなたは生粋の表現者です。',2,2.5,-2,1.5],
 ['テルビウム','Tb','🧠','Tb.png','一分の狂いも許さない、知性の設計図','設計する人。知性の戦略家。','あなたは知性の戦略家です。',-1,-2.5,1.5,3],
 ['ジスプロシウム','Dy','🛡','Dy2.png','最後の砦を守り抜く、鉄壁のディフェンダー','守りを固める人。最強の守護神。','あなたは最強の守護神です。',-0.5,-1.5,2,-2],
 ['ホルミウム','Ho','🎯','Ho2.png','一点突破で壁を穿つ、集中力の狙撃手','一点集中型の爆発的スペシャリスト。','あなたは爆発的スペシャリストです。',0,-2.5,3,1.5],
 ['エルビウム','Er','📡','Er2.png','情報を光速でつなぐ、無口な司令塔','静かな参謀。未来を予測する人。','あなたは未来を予測するナビゲーターです。',-0.5,0.5,0.5,3],
 ['イッテルビウム','Yb','🌙','Yb2.png','静寂の中で真実を映す、銀色の観測鏡','観測者。高精度のセンサー。','あなたは高精度センサーの持ち主です。',-2,2,0.5,2],
 ['ルテチウム','Lu','👑','Lu2.png','揺らぎを安定に変える、最後の拠り所','精神的支柱。本物の安定感。','あなたは精神的支柱です。',-2.5,0.5,2,-2.5],
 ['ガドリニウム','Gd','🏥','Gd2.png','見えない傷を察知する、静かなる守護聖人','静かなヒーロー。慈愛の人。','あなたは慈愛の人です。',-0.5,3,0.5,-0.5]
];

let idx=-1, ans=[], lock=false;
const wrap=h=>`<div class="ur-box"><div class="ur-head"><button class="ur-back" onclick="closeUranai()">← ホームへ戻る</button><b>🔮 レアアース診断</b></div><div class="ur-body">${h}</div></div>`;

function draw(){
  let h='';
  if(idx<0){
    h=`<div class="ur-bubble"><img src="chara0_Y.png" alt="" onerror="this.style.visibility='hidden'">
      <div>「こんにちは！イットリウムだよ。<br>12の質問に答えると、あなたにいちばん近い<b>レアアース元素</b>がわかるよ！<br>直感でサクサク答えてね♪」</div></div>
      <div class="ur-card" style="text-align:left;border-top-color:#10b981">
        <b>🧪 診断の流れ</b><br>・全12問（約1分）<br>・答えをタップすると自動で次の質問へ<br>・「← 前の質問」でやり直しもOK</div>
      <button class="ur-main" onclick="urNext()">🔮 診断をはじめる</button>
      <button class="ur-sub" onclick="closeUranai()">やめてホームに戻る</button>`;
  } else {
    const q=QS[idx], ax=AX[q[0]];
    h=`<div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:bold"><span>Q${idx+1} / ${QS.length}</span><span>${Math.round(idx/QS.length*100)}%</span></div>
      <div class="ur-prog"><i style="width:${(idx+1)/QS.length*100}%"></i></div>
      <span class="ur-tag" style="background:${ax[1]}">${ax[0]}｜${q[1]}</span>
      <div class="ur-q">${q[2]}</div>
      ${OPT.map(o=>`<button class="ur-opt ${ans[idx]===o[0]?'sel':''}" onclick="urAnswer(${o[0]})"><span class="dot"></span>${o[1]}</button>`).join('')}
      <button class="ur-sub" onclick="urPrev()">← 前の質問</button>`;
  }
  ov.innerHTML=wrap(h);
}

function result(){
  const u={}; 
  Object.keys(AX).forEach(k=>{ const a=QS.map((q,i)=>q[0]===k?ans[i]:null).filter(v=>v!==null); u[k]=a.reduce((s,v)=>s+v,0)/a.length; });
  const r=EL.map(e=>{ const d=Math.sqrt(['E','A','S','C'].reduce((s,k,i)=>s+Math.pow(u[k]-e[7+i],2),0)); return {e,d}; }).sort((a,b)=>a.d-b.d);
  const top=r[0].e, pct=Math.round(Math.max(60,Math.min(99,100-r[0].d*7)));
  try{ gameState.uranaiResult=top[1]; save(); }catch(e){}
  const bars=Object.keys(AX).map(k=>{ const p=Math.max(5,Math.min(100,(u[k]+2)/4*100)); return `<div class="r"><span class="n">${AX[k][0]}</span><div class="bar"><i style="width:${p}%;background:${AX[k][1]}"></i></div></div>`; }).join('');
  const h=`<div style="text-align:center;font-weight:bold;margin-bottom:.5rem">🎉 診断結果発表！</div>
    <div class="ur-card"><span class="lbl">あなたに最も近いレアアース</span>
      <h3>${top[2]} ${top[0]}（${top[1]}）</h3>
      <img class="ur-img" src="${top[3]}" alt="${top[0]}" onerror="this.outerHTML='<div class=&quot;ur-emoji&quot;>${top[2]}</div>'">
      <div class="ur-catch">「${top[4]}」</div>
      <div style="font-weight:bold;font-size:.8rem">${top[5]}</div>
      <div class="ur-pct">適合度 <b>${pct}%</b></div>
      <div class="ur-long">${top[6]}</div>
      <div class="ur-axis"><b>📊 あなたのタイプ</b><div style="margin-top:.4rem">${bars}</div></div>
    </div>
    <div class="ur-near">🤝 次に近い元素：${r.slice(1,3).map(x=>`<span>${x.e[2]} ${x.e[0]}</span>`).join('')}</div>
    <button class="ur-main" onclick="closeUranai()">🏠 ホームに戻る</button>
    <button class="ur-sub" onclick="urRestart()">もう一度診断する</button>`;
  ov.innerHTML=wrap(h);
  ov.querySelector('.ur-body').scrollTop=0;
}

window.urNext=()=>{ idx=0; draw(); };
window.urPrev=()=>{ if(idx>=0){ idx--; draw(); } };
window.urRestart=()=>{ idx=-1; ans=[]; draw(); };
window.urAnswer=v=>{
  if(lock) return; lock=true; ans[idx]=v; draw();
  setTimeout(()=>{ lock=false; if(idx<QS.length-1){ idx++; draw(); } else result(); },200);
};
window.openGameUranai=()=>{
  try{ closeModal(); }catch(e){}
  idx=-1; ans=[]; lock=false; draw(); ov.style.display='flex';
  try{ if(bgm) bgm.pause(); }catch(e){}
  try{ if(!isMuted) au.play().catch(()=>{}); }catch(e){}
};
window.closeUranai=()=>{
  ov.style.display='none'; au.pause(); au.currentTime=0;
  try{ if(!isMuted && bgm) bgm.play().catch(()=>{}); }catch(e){}
};
window.calcGameUranai=result; // 旧関数名の互換
})();
