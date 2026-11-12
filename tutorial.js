/* チュートリアル：画面を暗くして対象だけ光らせ、指でタップ先を示す。各ゲームページ末尾で <script src="tutorial.js"></script> を読み込む。
   進行は localStorage 'rareEarthTutorialStep'（未開始=なし / 数字=現在のステップ / -1=完了）。スタート画面の「はじめる」が 0 を書き込む。

   ［改修メモ］
   ・止まる問題の修正：
       1) ページ名の判定から ".html" を外して比較（.html なしのURLで配信される環境でも動く）
       2) 現在のステップと違う画面を開いても黙って消えず、「続きへ」ボタン付きの案内を出す
       3) 画面の再描画で押す対象が差し替わっても、探し直して追従する
       4) ブラウザの「戻る」(bfcache復元)で状態がずれないよう、復元時は再読み込みする
       5) ホームの .overlay ポップアップも「開いている間は待つ」対象に追加
   ・演出：BGM_tutorial.ogg（ページをまたいで続きから再生）、SE（peta / kira / kingaku / 50ren）、
           タイプライター表示、進捗バー、波紋とキラキラ、完了時の紙吹雪
   ・BGMは各ページの「🎵 ON/OFF」ボタンに連動。チュートリアル中はページ本来のBGMを止め、終了/スキップで元のBGMへ戻す */
(() => {
  const KEY = 'rareEarthTutorialStep', DONE = 'rareEarthTutorialDone', BGM_T = 'rareEarthTutBgmT';
  // ★ チュートリアルを最後まで見終えたときの「ごほうび」ゴールド。0 にすると支給なし（金額はここだけ変えればOK）
  const REWARD_GOLD = 1000;
  const REW_HINT = REWARD_GOLD > 0 ? 'おしまいまで進むと、ごほうび（' + REWARD_GOLD.toLocaleString() + 'G）がもらえるよ！' : '';
  const norm = s => String(s).replace(/\.html?$/i, '');
  const page = norm(location.pathname.split('/').pop() || 'index');
  const PAGE_LABEL = { map: 'マップ', mine: '採掘', seisei: '精製', factory: '工場', home: 'ホーム' };
  // ── ステップ定義：sel=指すボタン（クリックで次へ）/ type:'msg'=OKボタンで次へ / se=表示時のSE（省略は kira） ──
  const STEPS = [
    { page: 'map.html',     type: 'msg', text: 'ようこそ！案内役のテルビウムだよ。このゲームの目標は、レベルを上げて「南鳥島」のエリアを解放すること。まずは採掘に出かけよう！' + REW_HINT },
    { page: 'map.html',     sel: '#spot-baiyun', text: '採掘エリアを選ぼう。まずは中国の「白雲鄂博」のピンをタップ！' },
    { page: 'map.html',     sel: '#action-btn:not([disabled])', text: '「移動」ボタンをタップして、採掘エリアへ出発だ！' },
    { page: 'mine.html',    sel: '#mine-btn', text: 'ここが採掘エリア。このボタンをタップして、資源を掘り出してみよう！' },
    { page: 'mine.html',    sel: '.nav-item[onclick*="seisei.html"]', delay: 1800, text: '掘り出したものは「精製」で元素にできるよ。精製画面へ行ってみよう！' },
    { page: 'seisei.html',  sel: 'button[onclick="refineElement(1)"]', delay: 500, text: '精製ボタンをタップ！掘削物から、レアアース元素のキャラクターがとり出せるよ。' },
    { page: 'seisei.html',  sel: '.nav-item[onclick*="factory.html"], .nav-item[onclick*="goToFactory"]', delay: 600, text: '元素は素材になって、所持品に並んだよ。次は「工場」で製品にしよう！' },
    { page: 'factory.html', type: 'msg', sel: '#recipe-list', delay: 500, se: 'gold', text: '素材がそろうと「🔨製造」できるよ。作った製品は「💰売却」でゴールドとEXPになるよ。製造すると、キャラクターのイベントも見られるよ！' },
    { page: 'factory.html', sel: '.nav-item[onclick*="home.html"]', text: '最後に「ホーム」をのぞいてみよう！' },
    { page: 'home.html',    type: 'msg', last: true, text: 'ホームでは、キャラクターとおしゃべりするとミニゲームが遊べるよ。仲良くなると、掘削・精製・製造のお仕事も手伝ってくれるんだ。レベルを上げて、レベル50で解放される「南鳥島」をめざそう！' + (REWARD_GOLD > 0 ? 'それじゃあ、ごほうびをどうぞ！' : '') }
  ];
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const put = v => { try { localStorage.setItem(KEY, String(v)); } catch (e) {} };
  let i = parseInt(get(), 10);
  if (isNaN(i) || i < 0 || i >= STEPS.length) return;
  let offRoute = false;
  if (norm(STEPS[i].page) !== page) {     // 現在ページに該当する先のステップへ（地図での寄り道などを吸収）
    const j = STEPS.findIndex((s, k) => k > i && norm(s.page) === page);
    if (j >= 0) { i = j; put(i); } else offRoute = true;   // 該当なし（戻った/図鑑など）→ 黙って消えず案内を出す
  }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══ 音 ═══════════════════════════════════════════════ */
  const mk = (src, vol) => { const a = new Audio(src); a.preload = 'auto'; a.volume = vol; return a; };
  const SE = { peta: mk('SE_peta.mp3', .55), kira: mk('SE_kira.mp3', .4), gold: mk('SE_kingaku.mp3', .5), ren: mk('SE_50ren.mp3', .6) };
  const playSE = n => { const a = SE[n]; if (!a) return; try { a.currentTime = 0; } catch (e) {} const p = a.play(); if (p && p.catch) p.catch(() => {}); };

  const tbgm = new Audio('BGM_tutorial.ogg'); tbgm.loop = true; tbgm.volume = .35; tbgm.preload = 'auto';
  try { const t = parseFloat(sessionStorage.getItem(BGM_T)); if (t > 0) tbgm.addEventListener('loadedmetadata', () => { try { tbgm.currentTime = t % (tbgm.duration || 1e9); } catch (e) {} }, { once: true }); } catch (e) {}
  const PAGE_BGM = /^bgm(-mine)?$/;                 // 各ページ本来のBGM（効果音・イベントBGMは対象外）
  const pageBgm = () => document.querySelector('audio#bgm, audio#bgm-mine');
  const pageMuted = () => { const b = document.getElementById('bgm-btn'); return !!(b && b.classList.contains('muted')); };
  let bgmLock = true, bgmStarted = false;
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {   // チュートリアル中は、ページ側のBGM再生を横取りして止める
    if (bgmLock && this !== tbgm && PAGE_BGM.test(this.id)) { try { this.pause(); } catch (e) {} return Promise.resolve(); }
    return nativePlay.apply(this, arguments);
  };
  document.querySelectorAll('audio').forEach(a => { if (PAGE_BGM.test(a.id)) { try { a.pause(); } catch (e) {} } });
  const syncBgm = () => {
    if (!bgmLock || !bgmStarted) return;
    if (pageMuted() || document.hidden) tbgm.pause(); else tbgm.play().catch(() => {});
  };
  function startBgm() {
    if (bgmStarted) return;
    bgmStarted = true;
    if (pageMuted()) return;
    tbgm.play().catch(() => {                       // 自動再生が止められたら、最初の操作で再生
      const evs = ['pointerdown', 'touchend', 'keydown'];
      const un = () => { evs.forEach(e => document.removeEventListener(e, un, true)); syncBgm(); };
      evs.forEach(e => document.addEventListener(e, un, true));
    });
  }
  function releaseBgm() {                           // 終了/スキップ：BGMをフェードアウトしてページ本来のBGMへ戻す
    if (!bgmLock) return; bgmLock = false;
    const v0 = tbgm.volume, iv = setInterval(() => {
      tbgm.volume = Math.max(0, tbgm.volume - v0 / 10);
      if (tbgm.volume <= .001) { clearInterval(iv); tbgm.pause(); }
    }, 60);
    try { sessionStorage.removeItem(BGM_T); } catch (e) {}
    if (!pageMuted()) { const pb = pageBgm(); if (pb) pb.play().catch(() => {}); }
  }
  const bb0 = document.getElementById('bgm-btn');
  if (bb0) new MutationObserver(syncBgm).observe(bb0, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', syncBgm);
  addEventListener('pagehide', () => { try { if (bgmLock) sessionStorage.setItem(BGM_T, String(tbgm.currentTime)); } catch (e) {} });
  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });   // 戻る操作で古い状態が復元されたときは作り直す
  // ページの「🎵 ON/OFF」表示が確定する load を待つ。ただし画像が重くて load が遅れても、1.2秒で始める
  if (document.readyState === 'complete') setTimeout(startBgm, 80); else { addEventListener('load', () => setTimeout(startBgm, 80)); setTimeout(startBgm, 1200); }

  /* ═══ 見た目 ═══════════════════════════════════════════ */
  const css = document.createElement('style');
  css.textContent = `
  #tut-ov{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:inherit}
  #tut-ov .d{position:fixed;background:rgba(3,7,18,.82);pointer-events:auto}
  #tut-ov .ring{position:fixed;border:3px solid #00fff5;border-radius:.8rem;box-shadow:0 0 0 4px rgba(0,255,245,.25),0 0 22px #00fff5;animation:tutPulse 1.2s ease-in-out infinite;pointer-events:none}
  #tut-ov .rip{position:fixed;border:2px solid #ffde59;border-radius:.8rem;pointer-events:none;animation:tutRip 1.4s ease-out infinite}
  #tut-ov .sp{position:fixed;font-size:1.1rem;line-height:1;pointer-events:none;animation:tutTw 1.3s ease-in-out infinite;filter:drop-shadow(0 0 4px #ffde59)}
  #tut-ov .fg{position:fixed;font-size:2.6rem;line-height:1;pointer-events:none;filter:drop-shadow(0 3px 4px #000);animation:tutTap .9s ease-in-out infinite}
  #tut-ov .pn{position:fixed;left:50%;transform:translateX(-50%);width:min(94%,32rem);display:flex;gap:.6rem;align-items:center;background:rgba(22,33,62,.97);border:2px solid #00fff5;border-radius:1rem;padding:.7rem;pointer-events:auto;box-shadow:0 .5rem 1.6rem rgba(0,0,0,.6),0 0 14px rgba(0,255,245,.25);animation:tutIn .25s ease-out}
  #tut-ov .pn img{width:4rem;height:4rem;object-fit:contain;flex:none;animation:tutBob 1.6s ease-in-out infinite}
  #tut-ov .bb{flex:1;color:#1a1a2e;background:#f8f9fa;border-radius:.7rem;padding:.5rem .75rem .55rem;font-weight:700;font-size:.9rem;line-height:1.55;animation:tutPop .28s ease-out}
  #tut-ov .bb small{display:block;color:#64748b;font-size:.7rem;margin-bottom:.15rem}
  #tut-ov .bar{height:5px;background:#dfe6ee;border-radius:3px;overflow:hidden;margin-bottom:.3rem}
  #tut-ov .bar i{display:block;height:100%;background:linear-gradient(90deg,#00fff5,#ffde59);border-radius:3px;transition:width .4s}
  #tut-ov .tx{display:block;position:relative}
  #tut-ov .tx .gh{visibility:hidden}
  #tut-ov .tx .ty{position:absolute;left:0;top:0;right:0}
  #tut-ov .ok{display:block;margin:.5rem 0 0 auto;border:0;border-radius:.6rem;padding:.45rem 1.2rem;font:inherit;font-weight:900;background:#00fff5;color:#0f3460;cursor:pointer;box-shadow:0 2px 0 #0a8f8a}
  #tut-ov .ok:active{transform:translateY(2px);box-shadow:none}
  #tut-ov .ok.sub{background:#dbe3ee;color:#334155;box-shadow:0 2px 0 #94a3b8}
  #tut-ov .row{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}
  #tut-ov .row .ok{margin:0}
  #tut-ov .sk{position:fixed;right:.6rem;top:calc(.5rem + env(safe-area-inset-top,0px));pointer-events:auto;border:1px solid #9db0cf;background:rgba(15,23,42,.85);color:#cbd5e1;border-radius:1rem;padding:.25rem .8rem;font:inherit;font-size:.72rem;cursor:pointer}
  @keyframes tutPulse{50%{box-shadow:0 0 0 8px rgba(0,255,245,.1),0 0 32px #00fff5}}
  @keyframes tutRip{from{transform:scale(1);opacity:.8}to{transform:scale(1.28);opacity:0}}
  @keyframes tutTw{0%,100%{transform:scale(.3) rotate(0);opacity:0}50%{transform:scale(1) rotate(25deg);opacity:1}}
  @keyframes tutTap{50%{transform:translateY(var(--dy,10px))}}
  @keyframes tutIn{from{opacity:0}}
  @keyframes tutBob{50%{transform:translateY(-4px)}}
  @keyframes tutPop{from{transform:scale(.92);opacity:0}}
  @media (prefers-reduced-motion:reduce){#tut-ov .ring,#tut-ov .fg,#tut-ov .rip,#tut-ov .sp,#tut-ov .pn,#tut-ov .pn img,#tut-ov .bb{animation:none}}`;
  document.head.appendChild(css);

  let ov, raf, tgt, tw;
  const h = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; ov.appendChild(e); return e; };
  function clear() { cancelAnimationFrame(raf); clearInterval(tw); if (ov) ov.remove(); ov = null; if (tgt) tgt.removeEventListener('click', onTap, true); tgt = null; }
  function finish(done) {                          // done===true：最後まで見終わった（スキップ時はお祝いなし）
    put(-1); try { localStorage.setItem(DONE, '1'); } catch (e) {}
    clear(); releaseBgm();
    if (done === true) celebrate();
  }
  function advance() {
    clear();
    if (STEPS[i].last) return finish(true);
    i++; put(i);
    if (norm(STEPS[i].page) === page) start();     // 同じページ内で続く場合のみ即表示（別ページは移動先で再開）
  }
  function onTap() { playSE('peta'); advance(); }  // クリックはそのままゲーム側に通る（ボタン本来の動作が実行される）

  // ごほうびゴールドの支給（1回だけ。ページ側の gameState を直接更新するので、後のセーブで上書きされない）
  function giveReward() {
    if (!(REWARD_GOLD > 0)) return null;
    try {
      const live = (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') ? gameState : null;
      const data = live || JSON.parse(localStorage.getItem('rareEarthGameState') || 'null') || {};
      if (data.tutorialRewarded) return null;
      const before = data.money || 0;
      data.money = before + REWARD_GOLD; data.tutorialRewarded = true;
      localStorage.setItem('rareEarthGameState', JSON.stringify(data));
      return { before, after: data.money };
    } catch (e) { return null; }
  }
  // ヘッダーの所持金を数えながら増やす（無ければページ側の再描画に任せる）
  function countUpMoney(r) {
    const el = document.getElementById('money'), fin = () => { try { if (typeof updateUI === 'function') updateUI(); else if (typeof updateHeader === 'function') updateHeader(); } catch (e) {} };
    if (!el || reduceMotion) return fin();
    el.textContent = r.before.toLocaleString();
    const t0 = performance.now(), D = 900;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / D);
      el.textContent = Math.round(r.before + (r.after - r.before) * (1 - Math.pow(1 - k, 3))).toLocaleString();
      if (k < 1) requestAnimationFrame(tick); else fin();
    })(t0);
  }

  // 完了のお祝い：紙吹雪＋トースト＋SE（＋ごほうび）
  function celebrate() {
    const reward = giveReward();
    playSE('ren');
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;overflow:hidden';
    document.body.appendChild(c);
    const dur = reward ? 4200 : 2600;
    const cols = ['#00fff5', '#ffde59', '#e94560', '#7cfc9a', '#c084fc', '#ffffff'];
    for (let n = 0; n < (reduceMotion ? 0 : 70); n++) {
      const p = document.createElement('i'), s = 6 + Math.random() * 8, a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 280;
      p.style.cssText = `position:absolute;left:50%;top:40%;width:${s}px;height:${s * 1.6}px;background:${cols[n % cols.length]};border-radius:2px`;
      c.appendChild(p);
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 90;
      p.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 600}deg)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx * 1.15}px,${dy + innerHeight * .55}px) rotate(900deg)`, opacity: 0 }
      ], { duration: 1500 + Math.random() * 1000, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    }
    const t = document.createElement('div');
    t.innerHTML = '🎉 チュートリアル完了！' + (reward ? '<div id="tut-rw" style="font-size:1rem;margin-top:.35rem;color:#fff;opacity:0;transition:opacity .3s">💰 ごほうび <b style="color:#ffde59">+' + REWARD_GOLD.toLocaleString() + ' G</b> ゲット！</div>' : '');
    t.style.cssText = 'position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);background:rgba(22,33,62,.95);color:#ffde59;border:2px solid #00fff5;border-radius:1rem;padding:.8rem 1.4rem;font-weight:900;font-size:1.25rem;white-space:nowrap;text-align:center;box-shadow:0 0 24px rgba(0,255,245,.6)';
    c.appendChild(t);
    if (!reduceMotion) t.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.12)', opacity: 1, offset: .35 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .8 }, { transform: 'translate(-50%,-60%) scale(1)', opacity: 0 }], { duration: dur, fill: 'forwards' });
    if (reward) setTimeout(() => {              // ファンファーレのあとに、金額の表示とコインの音
      const rw = t.querySelector('#tut-rw'); if (rw) rw.style.opacity = 1;
      playSE('gold'); countUpMoney(reward);
    }, 1000);
    setTimeout(() => c.remove(), dur + 400);
  }

  function show() {
    const s = STEPS[i], isMsg = s.type === 'msg'; tgt = s.sel ? document.querySelector(s.sel) : null;
    if (s.sel && !tgt) return false;
    ov = document.createElement('div'); ov.id = 'tut-ov'; document.body.appendChild(ov);
    const dT = h('d'), dB = h('d'), dL = h('d'), dR = h('d'), ring = h('ring'), hb = (isMsg && tgt) ? h('d') : null;
    const rip = (tgt && !isMsg) ? h('rip') : null;
    const sps = (tgt && !isMsg && !reduceMotion) ? [0, 1, 2].map(k => { const e = h('sp'); e.textContent = '✨'; e.style.animationDelay = (k * .43) + 's'; return e; }) : [];
    const fg = h('fg'), pn = h('pn');
    if (hb) hb.style.background = 'transparent';   // 説明だけのステップは、囲った部分も押せないようにする
    const total = STEPS.length;
    pn.innerHTML = `<img src="navtb.png" alt="" onerror="this.remove()"><div class="bb"><div class="bar"><i style="width:${(i + 1) / total * 100}%"></i></div><small>チュートリアル ${i + 1}/${total}</small><span class="tx"><span class="gh"></span><span class="ty"></span></span>${isMsg ? '<button class="ok">' + (s.last ? 'はじめる！' : 'OK') + '</button>' : ''}</div>`;
    // 文字を1文字ずつ表示（先に全文を透明で置いて高さを確保し、パネルが伸び縮みしないようにする）。バブルをタップで全文表示
    const gh = pn.querySelector('.gh'), ty = pn.querySelector('.ty');
    gh.textContent = s.text;
    if (reduceMotion) ty.textContent = s.text;
    else {
      let k = 0; const dt = Math.max(10, Math.min(28, 1300 / s.text.length));
      tw = setInterval(() => { ty.textContent = s.text.slice(0, ++k); if (k >= s.text.length) clearInterval(tw); }, dt);
      pn.querySelector('.bb').addEventListener('click', () => { clearInterval(tw); ty.textContent = s.text; });
    }
    const ok = pn.querySelector('.ok'); if (ok) ok.onclick = () => { if (!s.last) playSE('peta'); advance(); };
    const sk = h('sk', 'button'); sk.textContent = 'スキップ'; sk.onclick = finish;
    playSE(s.se || 'kira');
    const box = (e, l, t, w, hh) => Object.assign(e.style, { left: l + 'px', top: t + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, hh) + 'px' });
    const bind = () => {
      if (tgt && !isMsg) {
        tgt.addEventListener('click', onTap, true);
        const r0 = tgt.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight) tgt.scrollIntoView({ block: 'center' });
      }
    };
    bind();
    const loop = () => {
      if (!ov) return;
      if (s.sel && !(tgt && tgt.isConnected)) {          // 画面の再描画で対象が差し替わったら探し直す
        if (tgt) tgt.removeEventListener('click', onTap, true);
        tgt = document.querySelector(s.sel); bind();
      }
      const lost = s.sel && !tgt;
      ov.style.display = (lost || modalOpen()) ? 'none' : '';
      const W = innerWidth, H = innerHeight;
      if (tgt) {
        const r = tgt.getBoundingClientRect(), p = 6, x = r.left - p, y = r.top - p, w = r.width + p * 2, hh = r.height + p * 2;
        [dB, dL, dR, ring].forEach(e => e.style.display = ''); fg.style.display = '';
        box(dT, 0, 0, W, y); box(dB, 0, y + hh, W, H - y - hh); box(dL, 0, y, x, hh); box(dR, x + w, y, W - x - w, hh);
        box(ring, x, y, w, hh); if (hb) box(hb, x, y, w, hh); if (rip) box(rip, x, y, w, hh);
        sps.forEach((e, k) => { e.style.left = (x + w * [.08, .92, .5][k] - 8) + 'px'; e.style.top = (y + hh * [.1, .3, .95][k] - 10) + 'px'; });
        const low = y + hh / 2 > H / 2;                       // 対象が下半分 → 指は上から👇、案内は上へ
        fg.textContent = low ? '👇' : '👆'; fg.style.setProperty('--dy', low ? '10px' : '-10px');
        fg.style.left = (x + w / 2 - 20) + 'px'; fg.style.top = (low ? y - 48 : y + hh + 4) + 'px';
        pn.style.top = low ? 'calc(2.4rem + env(safe-area-inset-top,0px))' : 'auto';
        pn.style.bottom = low ? 'auto' : 'calc(5rem + env(safe-area-inset-bottom,0px))';
      } else if (!s.sel) {
        box(dT, 0, 0, W, H); [dB, dL, dR, ring].forEach(e => e.style.display = 'none'); fg.style.display = 'none';
        pn.style.top = '50%'; pn.style.transform = 'translate(-50%,-50%)';
      }
      raf = requestAnimationFrame(loop);
    };
    loop(); return true;
  }
  // ボタンが見つからず進めないとき、黙って消えずに原因を表示する
  function fail() {
    clear();
    ov = document.createElement('div'); ov.id = 'tut-ov'; document.body.appendChild(ov);
    const pn = h('pn'), reMissing = typeof RE === 'undefined';
    pn.style.bottom = 'calc(5rem + env(safe-area-inset-bottom,0px))';
    pn.innerHTML = `<img src="navtb.png" alt="" onerror="this.remove()"><div class="bb"><small>チュートリアルが進めません</small>${reMissing ? '「areaconfig.js」が読み込めていません。ゲームの元のフォルダ（画像などが入っている場所）にファイルを置いて、開き直してください。' : 'このステップのボタンが見つかりませんでした。ページを再読み込みしてやり直すか、スキップしてください。'}<small style="margin-top:.4rem">（対象: ${STEPS[i].sel || '-'}）</small><button class="ok">スキップ</button></div>`;
    pn.querySelector('.ok').onclick = () => finish();
  }
  // 現在のステップとは別の画面にいるとき：続きの画面へ案内（暗幕なし・操作は妨げない）
  function resume() {
    const s = STEPS[i], label = PAGE_LABEL[norm(s.page)] || norm(s.page);
    ov = document.createElement('div'); ov.id = 'tut-ov'; document.body.appendChild(ov);
    const pn = h('pn'); pn.style.bottom = 'calc(5rem + env(safe-area-inset-bottom,0px))';
    pn.innerHTML = `<img src="navtb.png" alt="" onerror="this.remove()"><div class="bb"><small>チュートリアルの途中だよ（${i + 1}/${STEPS.length}）</small>続きは「${label}」画面だよ。いっしょに続けよう！<div class="row"><button class="ok sub">スキップ</button><button class="ok go">続きへ</button></div></div>`;
    pn.querySelector('.sub').onclick = () => finish();
    pn.querySelector('.go').onclick = () => { playSE('peta'); setTimeout(() => { location.href = s.page; }, 120); };
  }
  // ゲーム側のポップアップが開いているか（開いている間はチュートリアルを出さず、閉じるまで待つ）
  const modalOpen = () => [...document.querySelectorAll('.modal-overlay, .overlay')].some(m => {
    const c = getComputedStyle(m);
    return c.display !== 'none' && c.visibility !== 'hidden' && c.opacity !== '0' && m.getBoundingClientRect().width > 0;
  });
  function start() {
    const s = STEPS[i];
    setTimeout(function wait(n = 0) {
      if (modalOpen()) return setTimeout(() => wait(n), 250);       // ポップアップ中は待つ（時間は数えない）
      if (show()) return;
      if (n < 60) setTimeout(() => wait(n + 1), 250); else fail();   // ボタン自体が無いときだけ、約15秒で諦める
    }, s.delay || 300);
  }
  const boot = () => offRoute ? resume() : start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
