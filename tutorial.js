/* チュートリアル：画面を暗くして対象だけ光らせ、指でタップ先を示す。各ゲームページ末尾で <script src="tutorial.js"></script> を読み込む。
   進行は localStorage 'rareEarthTutorialStep'（未開始=なし / 数字=現在のステップ / -1=完了）。スタート画面の「はじめる」が 0 を書き込む。 */
(() => {
  const KEY = 'rareEarthTutorialStep', DONE = 'rareEarthTutorialDone';
  const page = location.pathname.split('/').pop() || 'index.html';
  // ── ステップ定義：sel=指すボタン（クリックで次へ）/ type:'msg'=OKボタンで次へ / waitHide=そのモーダルが閉じるまで待つ ──
  const STEPS = [
    { page: 'map.html',     type: 'msg', text: 'ようこそ！案内役のテルビウムだよ。このゲームの目標は、レベルを上げて「南鳥島」のエリアを解放すること。まずは採掘に出かけよう！' },
    { page: 'map.html',     sel: '#spot-baiyun', text: '採掘エリアを選ぼう。まずは中国の「白雲鄂博」のピンをタップ！' },
    { page: 'map.html',     sel: '#action-btn:not([disabled])', text: '「移動」ボタンをタップして、採掘エリアへ出発だ！' },
    { page: 'mine.html',    sel: '#mine-btn', text: 'ここが採掘エリア。このボタンをタップして、資源を掘り出してみよう！' },
    { page: 'mine.html',    sel: '.nav-item[onclick*="seisei.html"]', delay: 1800, text: '掘り出したものは「精製」で元素にできるよ。精製画面へ行ってみよう！' },
    { page: 'seisei.html',  sel: 'button[onclick="refineElement(1)"]', delay: 500, text: '精製ボタンをタップ！掘削物から、レアアース元素のキャラクターがとり出せるよ。' },
    { page: 'seisei.html',  sel: '.nav-item[onclick*="factory.html"]', delay: 600, waitHide: '#minigameModal', text: '元素は素材になって、所持品に並んだよ。次は「工場」で製品にしよう！' },
    { page: 'factory.html', type: 'msg', sel: '#recipe-list', delay: 500, text: '素材がそろうと「🔨製造」できるよ。作った製品は「💰売却」でゴールドとEXPになるよ。製造すると、キャラクターのイベントも見られるよ！' },
    { page: 'factory.html', sel: '.nav-item[onclick*="home.html"]', text: '最後に「ホーム」をのぞいてみよう！' },
    { page: 'home.html',    type: 'msg', last: true, text: 'ホームでは、キャラクターとおしゃべりするとミニゲームが遊べるよ。仲良くなると、掘削・精製・製造のお仕事も手伝ってくれるんだ。レベルを上げて、レベル50で解放される「南鳥島」をめざそう！' }
  ];
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const put = v => { try { localStorage.setItem(KEY, String(v)); } catch (e) {} };
  let i = parseInt(get(), 10);
  if (isNaN(i) || i < 0 || i >= STEPS.length) return;
  if (STEPS[i].page !== page) {           // 現在ページに該当する先のステップへ（地図での寄り道などを吸収）
    const j = STEPS.findIndex((s, k) => k > i && s.page === page);
    if (j < 0) return;
    i = j; put(i);
  }

  const css = document.createElement('style');
  css.textContent = `
  #tut-ov{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:inherit}
  #tut-ov .d{position:fixed;background:rgba(3,7,18,.82);pointer-events:auto}
  #tut-ov .ring{position:fixed;border:3px solid #00fff5;border-radius:.8rem;box-shadow:0 0 0 4px rgba(0,255,245,.25),0 0 22px #00fff5;animation:tutPulse 1.2s ease-in-out infinite;pointer-events:none}
  #tut-ov .fg{position:fixed;font-size:2.6rem;line-height:1;pointer-events:none;filter:drop-shadow(0 3px 4px #000);animation:tutTap .9s ease-in-out infinite}
  #tut-ov .pn{position:fixed;left:50%;transform:translateX(-50%);width:min(94%,32rem);display:flex;gap:.6rem;align-items:center;background:rgba(22,33,62,.97);border:2px solid #00fff5;border-radius:1rem;padding:.7rem;pointer-events:auto;box-shadow:0 .5rem 1.6rem rgba(0,0,0,.6)}
  #tut-ov .pn img{width:4rem;height:4rem;object-fit:contain;flex:none}
  #tut-ov .bb{flex:1;color:#1a1a2e;background:#f8f9fa;border-radius:.7rem;padding:.55rem .75rem;font-weight:700;font-size:.9rem;line-height:1.55}
  #tut-ov .bb small{display:block;color:#64748b;font-size:.7rem;margin-bottom:.15rem}
  #tut-ov .ok{display:block;margin:.5rem 0 0 auto;border:0;border-radius:.6rem;padding:.45rem 1.2rem;font:inherit;font-weight:900;background:#00fff5;color:#0f3460;cursor:pointer}
  #tut-ov .sk{position:fixed;right:.6rem;top:calc(.5rem + env(safe-area-inset-top,0px));pointer-events:auto;border:1px solid #9db0cf;background:rgba(15,23,42,.85);color:#cbd5e1;border-radius:1rem;padding:.25rem .8rem;font:inherit;font-size:.72rem;cursor:pointer}
  @keyframes tutPulse{50%{box-shadow:0 0 0 8px rgba(0,255,245,.1),0 0 32px #00fff5}}
  @keyframes tutTap{50%{transform:translateY(var(--dy,10px))}}
  @media (prefers-reduced-motion:reduce){#tut-ov .ring,#tut-ov .fg{animation:none}}`;
  document.head.appendChild(css);

  let ov, raf, tgt;
  const h = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; ov.appendChild(e); return e; };
  function clear() { cancelAnimationFrame(raf); if (ov) ov.remove(); ov = null; if (tgt) tgt.removeEventListener('click', onTap, true); tgt = null; }
  function finish() { put(-1); try { localStorage.setItem(DONE, '1'); } catch (e) {} clear(); }
  function advance() {
    clear();
    if (STEPS[i].last) return finish();
    i++; put(i);
    if (STEPS[i].page === page) start();       // 同じページ内で続く場合のみ即表示（別ページは移動先で再開）
  }
  function onTap() { advance(); }              // クリックはそのままゲーム側に通る（ボタン本来の動作が実行される）

  function show() {
    const s = STEPS[i], isMsg = s.type === 'msg'; tgt = s.sel ? document.querySelector(s.sel) : null;
    if (s.sel && !tgt) return false;
    ov = document.createElement('div'); ov.id = 'tut-ov'; document.body.appendChild(ov);
    const dT = h('d'), dB = h('d'), dL = h('d'), dR = h('d'), ring = h('ring'), hb = (isMsg && tgt) ? h('d') : null, fg = h('fg'), pn = h('pn');
    if (hb) hb.style.background = 'transparent';   // 説明だけのステップは、囲った部分も押せないようにする
    const total = STEPS.length;
    pn.innerHTML = `<img src="navtb.png" alt="" onerror="this.remove()"><div class="bb"><small>チュートリアル ${i + 1}/${total}</small>${s.text}${s.type === 'msg' ? '<button class="ok">' + (s.last ? 'はじめる！' : 'OK') + '</button>' : ''}</div>`;
    const ok = pn.querySelector('.ok'); if (ok) ok.onclick = advance;
    const sk = h('sk', 'button'); sk.textContent = 'スキップ'; sk.onclick = finish;
    const box = (e, l, t, w, hh) => Object.assign(e.style, { left: l + 'px', top: t + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, hh) + 'px' });
    if (tgt && !isMsg) {
      tgt.addEventListener('click', onTap, true);
      const r0 = tgt.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight) tgt.scrollIntoView({ block: 'center' });
    }
    const loop = () => {
      const W = innerWidth, H = innerHeight;
      if (tgt) {
        const r = tgt.getBoundingClientRect(), p = 6, x = r.left - p, y = r.top - p, w = r.width + p * 2, hh = r.height + p * 2;
        box(dT, 0, 0, W, y); box(dB, 0, y + hh, W, H - y - hh); box(dL, 0, y, x, hh); box(dR, x + w, y, W - x - w, hh);
        box(ring, x, y, w, hh); if (hb) box(hb, x, y, w, hh);
        const low = y + hh / 2 > H / 2;                       // 対象が下半分 → 指は上から👇、案内は上へ
        fg.textContent = low ? '👇' : '👆'; fg.style.setProperty('--dy', low ? '10px' : '-10px');
        fg.style.left = (x + w / 2 - 20) + 'px'; fg.style.top = (low ? y - 48 : y + hh + 4) + 'px';
        pn.style.top = low ? 'calc(2.4rem + env(safe-area-inset-top,0px))' : 'auto';
        pn.style.bottom = low ? 'auto' : 'calc(5rem + env(safe-area-inset-bottom,0px))';
      } else {
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
    pn.innerHTML = `<img src="navtb.png" alt="" onerror="this.remove()"><div class="bb"><small>チュートリアルが進めません</small>${reMissing ? '「areaconfig.js」が読み込めていません。ゲームの元のフォルダ（画像などが入っている場所）にファイルを置いて、開き直してください。' : 'このステップのボタンが見つかりませんでした。ページを再読み込みしてやり直すか、スキップしてください。'}<button class="ok">スキップ</button></div>`;
    pn.querySelector('.ok').onclick = finish;
  }
  function start() {
    const s = STEPS[i];
    setTimeout(function wait(n = 0) {
      const hidden = !s.waitHide || (document.querySelector(s.waitHide) || {}).style?.display === 'none' || !document.querySelector(s.waitHide);
      if (hidden && show()) return;
      if (n < 60) setTimeout(() => wait(n + 1), 250); else fail();       // 最大約15秒、条件が整うのを待つ
    }, s.delay || 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
