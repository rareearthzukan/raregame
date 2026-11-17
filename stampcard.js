/*! stampcard.js  ─  レアアース ゲーム用「スタンプカード（ミッション）」システム  v1.0
 *
 * ■ つかいかた（本編の各ページに 2行 たすだけ）
 *   <script src="stampcard.js"></script>             ← </body> の前に1行
 *   Stamp.report('mine');                            ← 採掘した瞬間に1行
 *
 * ■ 報告するイベント名（Stamp.report の第1引数）
 *   mine=採掘  generate=生成  refine=精製(工場)  ship=出荷  shop_buy=ショップで購入
 *   furniture_place=家具を置いた  taste_change=テイスト変更  char_place=キャラをお部屋に置いた
 *   minigame_play=ミニゲームをあそんだ（第3引数 {game:'Ho'} のように ゲームの名前も渡す）
 *   zukan_open=図鑑を開いた  recycle_play=リサイクル工場をあそんだ
 *   ※ 個数がまとまるときは Stamp.report('generate', 10) のように個数も渡せます
 *   ※ レベルのミッションは 本編の保存データ(rareEarthGameState.level)を 自動で読みます
 *
 * ■ まとめ体験チケット（ごほうび）を 本編で使うとき
 *   if (Stamp.useTicket('bulkGen'))  { …10個まとめて生成… }   // 券があれば true（1枚へる）
 *   if (Stamp.useTicket('bulkMine')) { …5個まとめて採掘… }
 *
 * ■ ミッションの追加・変更は 下の CARDS を 書きかえるだけ
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 1. 設定
   * ============================================================ */
  const CFG = {
    storageKey: 'rareEarthStampCard',   // スタンプカードの保存先（本編のデータとは別）
    gameKey: 'rareEarthGameState',      // 本編の保存先（レベルを読む・ごほうびを入れる）
    charPath: 'chara0_{sym}.png',       // 元素キャラ画像（無いときは 元素記号のタイルで表示）
    soundKey: 'stampSound',
    button: true,                       // 画面の📒ボタンを自動で出す
    buttonBottom: 78,                   // 📒ボタンの位置（下からのpx）
    buttonSide: 'right',                // 'right' か 'left'
    dailyBonus: 150,                    // 「きょうのおすすめ」ボーナス(G)
    maxLineDraws: 3,                    // 1枚のカードで 福引を引ける ビンゴ列の数
    grant: null,                        // ごほうびの渡し方を自分で決めたいとき (reward)=>{}
    onGraduate: null                    // Lv50そつぎょうのときに呼ばれる
  };
  const SYMS = ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Sc', 'Y'];
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  /* ============================================================
   * 2. カードのデータ（ここを書きかえると ミッションが かわります）
   *   M(アイコン, タイトル, 説明, イベント名, 回数, 元素キャラ, ごほうび)
   *   D(…, イベント名, 種類の数, 数える項目名, …)   ← 「ちがうミニゲーム 2しゅるい」など
   *   L(…, レベル, 元素キャラ, ごほうび)             ← 「Lv5になる」など
   * ============================================================ */
  const M = (icon, title, desc, event, count, char, reward, hint) => ({ icon, title, desc, event, count, char, reward, hint });
  const D = (icon, title, desc, event, count, key, char, reward, hint) => ({ icon, title, desc, event, count, char, reward, hint, type: 'distinct', key });
  const L = (icon, title, desc, level, char, reward) => ({ icon, title, desc, type: 'level', count: level, char, reward, hint: 'あそんで EXPを ためよう！' });
  const CARDS = [
    { id: 'c1', title: 'はじめての レアアース', sub: 'ぜんぶの きのうを ちょっとずつ ためしてみよう！', ink: '#ff5d8f', nav: 'Y', unlock: { lv: 1 },
      missions: [
        M('⛏️', 'ほってみよう', '採掘を 1かい やってみよう', 'mine', 1, 'La', { money: 200 }, 'マップから 採掘に いってみよう'),
        M('🧪', 'つくってみよう', '生成を 1かい やってみよう', 'generate', 1, 'Ce', { money: 200 }),
        M('⚗️', 'みがいてみよう', '精製を 1かい やってみよう', 'refine', 1, 'Pr', { money: 200 }),
        M('📦', 'おくりだそう', '出荷を 1かい やってみよう', 'ship', 1, 'Nd', { money: 250 }),
        M('🛍️', 'おかいもの', 'ショップで 1こ 買ってみよう', 'shop_buy', 1, 'Sm', { money: 200 }),
        M('🪑', 'かざってみよう', 'お部屋に 家具を 1こ 置いてみよう', 'furniture_place', 1, 'Eu', { money: 200 }),
        M('🎮', 'ミニゲームに ちょうせん', 'ミニゲームを 1かい あそんでみよう', 'minigame_play', 1, 'Tb', { money: 300 }),
        M('📖', 'ずかんを みてみよう', '図鑑を ひらいてみよう', 'zukan_open', 1, 'Dy', { money: 200 }),
        L('🆙', 'Lv2に なろう', 'レベルを 2に しよう', 2, 'Y', { money: 300 })
      ],
      finish: { money: 1000, exp: 50, elements: { Y: 5 }, tickets: { bulkGen: 1, bulkMine: 1 } } },
    { id: 'c2', title: 'もっと つかいこなそう', sub: '同じ作業も あきずに くりかえして みよう', ink: '#35a7ff', nav: 'Ho', unlock: { lv: 5 }, diag: true,
      missions: [
        M('⛏️', 'ほりほり 3かい', '採掘を 3かい やろう', 'mine', 3, 'Gd', { money: 300 }),
        M('🧪', 'つくりまくろう', '生成を 3かい やろう', 'generate', 3, 'Er', { money: 300 }),
        M('⚗️', 'ピカピカに', '精製を 3かい やろう', 'refine', 3, 'Tm', { money: 300 }),
        M('📦', 'どんどん 出荷', '出荷を 3かい やろう', 'ship', 3, 'Yb', { money: 350 }),
        M('🎨', 'イメチェン', 'お部屋の テイストを かえてみよう', 'taste_change', 1, 'Lu', { money: 300 }),
        M('🧸', 'なかまを よぼう', 'キャラを お部屋に 置いてみよう', 'char_place', 1, 'Ho', { money: 300 }),
        M('🎮', 'ゲームしよう！', 'ミニゲームを 3かい あそぼう', 'minigame_play', 3, 'Sc', { money: 400 }),
        D('🕹️', 'ちがう ゲームも！', 'ちがう ミニゲームを 2しゅるい あそぼう', 'minigame_play', 2, 'game', 'Pm', { money: 400 }, 'ミニゲームを ぜんぶ ためしてみよう'),
        L('🆙', 'Lv5に なろう', 'レベルを 5に しよう', 5, 'La', { money: 500 })
      ],
      finish: { money: 2000, exp: 120, elements: { Nd: 5 }, tickets: { bulkGen: 2, bulkMine: 1 } } },
    { id: 'c3', title: 'コレクター', sub: '集めて かざって あそびつくそう！', ink: '#2fbf71', nav: 'Lu', unlock: { lv: 15 },
      missions: [
        M('🪑', 'おへやを にぎやかに', '家具を 5こ 置こう', 'furniture_place', 5, 'Ce', { money: 500 }),
        M('🧸', 'なかま だいしゅうごう', 'キャラを 3かい 置こう', 'char_place', 3, 'Pr', { money: 500 }),
        M('🛍️', 'おかいもの 名人', 'ショップで 5こ 買おう', 'shop_buy', 5, 'Nd', { money: 500 }),
        M('📖', 'ずかん はかせ', '図鑑を 10かい ひらこう', 'zukan_open', 10, 'Sm', { money: 500 }),
        D('🕹️', 'ゲーム めぐり', 'ちがう ミニゲームを 4しゅるい あそぼう', 'minigame_play', 4, 'game', 'Eu', { money: 600 }),
        M('♻️', 'リサイクル', 'リサイクル工場を あそぼう', 'recycle_play', 1, 'Tb', { money: 500 }),
        M('📦', '出荷 10かい', '出荷を 10かい やろう', 'ship', 10, 'Dy', { money: 600 }),
        M('🧪', '生成 10かい', '生成を 10かい やろう', 'generate', 10, 'Er', { money: 600 }),
        L('🆙', 'Lv15に なろう', 'レベルを 15に しよう', 15, 'Gd', { money: 800 })
      ],
      finish: { money: 4000, exp: 250, elements: { Dy: 5 }, tickets: { bulkGen: 2, bulkMine: 2 } } },
    { id: 'c4', title: '工場長', sub: 'もう ベテラン！ はたらく 工場を まわそう', ink: '#a46bff', nav: 'Nd', unlock: { lv: 30 },
      missions: [
        M('⛏️', 'ほって ほって 10かい', '採掘を 10かい やろう', 'mine', 10, 'Tm', { money: 800 }),
        M('🧪', '生成ライン 20かい', '生成を 20かい やろう', 'generate', 20, 'Yb', { money: 900 }),
        M('⚗️', '精製ライン 15かい', '精製を 15かい やろう', 'refine', 15, 'Pm', { money: 900 }),
        M('📦', '出荷 20かい', '出荷を 20かい やろう', 'ship', 20, 'Ho', { money: 900 }),
        M('🎮', 'ゲーム 10かい', 'ミニゲームを 10かい あそぼう', 'minigame_play', 10, 'La', { money: 900 }),
        M('🎨', 'おしゃれ上手', 'テイストを 3かい かえよう', 'taste_change', 3, 'Lu', { money: 800 }),
        M('🛍️', 'かいまくり', 'ショップで 10こ 買おう', 'shop_buy', 10, 'Sc', { money: 900 }),
        D('🕹️', 'ゲーム マスター', 'ちがう ミニゲームを 6しゅるい あそぼう', 'minigame_play', 6, 'game', 'Y', { money: 1000 }),
        L('🆙', 'Lv30に なろう', 'レベルを 30に しよう', 30, 'Ce', { money: 1200 })
      ],
      finish: { money: 8000, exp: 500, elements: { Tb: 8 }, tickets: { bulkGen: 3, bulkMine: 2 } } },
    { id: 'c5', title: 'Lv50 そつぎょう試験', sub: 'ここまで きたら もう すぐ！ まとめ生成・まとめ掘削が ひらくよ', ink: '#e8a317', nav: 'Eu', unlock: { lv: 40 }, graduation: true,
      missions: [
        M('📦', '出荷 30かい', '出荷を 30かい やろう', 'ship', 30, 'Sm', { money: 1200 }),
        M('🧪', '生成 40かい', '生成を 40かい やろう', 'generate', 40, 'Pr', { money: 1200 }),
        M('⚗️', '精製 30かい', '精製を 30かい やろう', 'refine', 30, 'Gd', { money: 1200 }),
        M('🪑', 'おへやの たつじん', '家具を 10こ 置こう', 'furniture_place', 10, 'Er', { money: 1200 }),
        M('🎮', 'ゲーム 15かい', 'ミニゲームを 15かい あそぼう', 'minigame_play', 15, 'Dy', { money: 1200 }),
        L('🆙', 'Lv40に なろう', 'レベルを 40に しよう', 40, 'Lu', { money: 1500 }),
        L('🆙', 'Lv45に なろう', 'レベルを 45に しよう', 45, 'Yb', { money: 2000 }),
        M('📖', 'ずかん かんぺき', '図鑑を 20かい ひらこう', 'zukan_open', 20, 'Tm', { money: 1200 }),
        L('🎓', 'Lv50に なろう！', 'レベルを 50に しよう（そつぎょう！）', 50, 'Y', { money: 5000 })
      ],
      finish: { money: 20000, exp: 1000, elements: { Sc: 3, Pm: 3 }, tickets: { bulkGen: 5, bulkMine: 5 } } }
  ];
  CARDS.forEach(c => c.missions.forEach((m, i) => { m.id = 'm' + (i + 1); }));

  // 好み診断（カード2が かんせいしたとき）
  const CATS = {
    mine: { n: '採掘', icon: '⛏️', type: 'ほりほり 探検家', tip: '掘削の まとめ体験券で もっと ほれるよ！ 採掘の レベルを 上げてみよう' },
    generate: { n: '生成', icon: '🧪', type: 'ものづくり 職人', tip: '生成を いっぱい まわして 元素を ためよう！ Lv50で 10こ まとめて つくれるよ' },
    refine: { n: '精製', icon: '⚗️', type: '精製 マスター', tip: '精製ボーナスの あるお部屋アイテムを ショップで さがしてみよう' },
    ship: { n: '出荷', icon: '📦', type: 'おしごと 商人', tip: '出荷で お金を ためて ショップで お買いもの！ あたらしい家具を ねらおう' },
    shop: { n: 'お買いもの', icon: '🛍️', type: 'お買いもの 名人', tip: 'マイル価格の アイテムは 精製ボーナスつき！ チェックしてみよう' },
    room: { n: 'お部屋づくり', icon: '🏠', type: 'お部屋 デザイナー', tip: 'テイストや 家具で お部屋を 自分色に！ キャラも ふやして にぎやかに' },
    mini: { n: 'ミニゲーム', icon: '🎮', type: 'ゲーム チャンピオン', tip: 'まだ あそんでない ミニゲームに ちょうせん！ 元素や お金も もらえるよ' },
    zukan: { n: '図鑑', icon: '📖', type: '元素 はかせ', tip: '図鑑の キャラを ぜんぶ しらべて ものしりに なろう！' }
  };
  const EVENT_CAT = { mine: 'mine', generate: 'generate', refine: 'refine', ship: 'ship', shop_buy: 'shop', furniture_place: 'room', taste_change: 'room', char_place: 'room', minigame_play: 'mini', recycle_play: 'mini', zukan_open: 'zukan' };
  const TICKET_NAMES = { bulkGen: 'まとめ生成(10こ)', bulkMine: 'まとめ掘削(5こ)' };

  /* ============================================================
   * 3. ユーティリティ・保存
   * ============================================================ */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = a => a[Math.random() * a.length | 0];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const cardIdx = id => CARDS.findIndex(c => c.id === id);
  const cardById = id => CARDS.find(c => c.id === id);
  const keyOf = (c, m) => c.id + '.' + m.id;

  let S = null;
  function freshState() {
    const st = { v: 1, t0: Date.now(), cards: {}, tickets: { bulkGen: 0, bulkMine: 0 }, counters: {}, fresh: [], pending: [], seenIntro: false, daily: { d: '', id: '', done: false }, stars: 0, graduated: false, view: 'c1' };
    CARDS.forEach((c, i) => { st.cards[c.id] = { unlocked: i === 0, finished: false, lines: [], draws: 0, m: {} }; c.missions.forEach(m => { st.cards[c.id].m[m.id] = { p: 0, done: false, at: 0, rot: 0, holo: false, keys: [] }; }); });
    return st;
  }
  function load() {
    let st = null; try { st = JSON.parse(ls.get(CFG.storageKey)); } catch (e) {}
    const base = freshState();
    if (!st || st.v !== 1) return base;
    // 新しく足したカード・ミッションにも対応
    Object.keys(base).forEach(k => { if (!(k in st)) st[k] = base[k]; });
    CARDS.forEach(c => { if (!st.cards[c.id]) st.cards[c.id] = base.cards[c.id]; c.missions.forEach(m => { if (!st.cards[c.id].m[m.id]) st.cards[c.id].m[m.id] = { p: 0, done: false, at: 0, rot: 0, holo: false, keys: [] }; }); });
    return st;
  }
  const save = () => ls.set(CFG.storageKey, JSON.stringify(S));
  function gameState() { try { return JSON.parse(ls.get(CFG.gameKey)) || {}; } catch (e) { return {}; } }
  const playerLevel = () => gameState().level || 1;

  /* ---- ごほうび ---- */
  function defaultGrant(r) {
    const gs = gameState();
    if (gs.money == null) gs.money = 1500;
    if (gs.level == null) { gs.level = 1; if (gs.mudStock == null) gs.mudStock = 5; }
    if (r.money) gs.money += r.money;
    if (r.elements) { gs.elements = gs.elements || {}; Object.keys(r.elements).forEach(k => { gs.elements[k] = (gs.elements[k] || 0) + r.elements[k]; }); }
    if (r.exp) { let lv = gs.level, ex = (gs.exp || 0) + r.exp; while (ex >= lv * 100) { ex -= lv * 100; lv++; } gs.level = lv; gs.exp = ex; }
    ls.set(CFG.gameKey, JSON.stringify(gs));
  }
  function applyReward(r) {
    r = JSON.parse(JSON.stringify(r || {}));
    if (r.elements && r.elements.__rand) { const n = r.elements.__rand; r.elements = {}; r.elements[pick(SYMS)] = n; }
    (CFG.grant || defaultGrant)({ money: r.money || 0, exp: r.exp || 0, elements: r.elements || null });
    if (r.tickets) Object.keys(r.tickets).forEach(k => { S.tickets[k] = (S.tickets[k] || 0) + r.tickets[k]; });
    return r;
  }
  function rewardLines(r) {
    const out = []; if (!r) return out;
    if (r.money) out.push('💰 ' + r.money.toLocaleString() + ' G');
    if (r.exp) out.push('⭐ EXP +' + r.exp);
    if (r.elements) Object.keys(r.elements).forEach(k => out.push('🧪 ' + k + ' ×' + r.elements[k]));
    if (r.tickets) Object.keys(r.tickets).forEach(k => out.push('🎫 ' + (TICKET_NAMES[k] || k) + 'おためし券 ×' + r.tickets[k]));
    return out;
  }
  function lotteryRoll(card) {
    const k = cardIdx(card.id) + 1;
    const pool = [{ w: 38, r: { money: 300 * k } }, { w: 24, r: { money: 600 * k } }, { w: 12, r: { money: 1200 * k } }, { w: 18, r: { elements: { __rand: 2 + k } } }, { w: 8, r: { tickets: { bulkGen: 1 } } }];
    let t = Math.random() * pool.reduce((a, p) => a + p.w, 0);
    for (const p of pool) { t -= p.w; if (t <= 0) return p.r; }
    return pool[0].r;
  }

  /* ============================================================
   * 4. ミッションの進み方
   * ============================================================ */
  let busy = false, uiReady = false, queueStamps = [], dirty = false;
  function isUnlocked(c) { return !!S.cards[c.id].unlocked; }
  function activeCard() { for (let i = CARDS.length - 1; i >= 0; i--) if (isUnlocked(CARDS[i]) && !S.cards[CARDS[i].id].finished) return CARDS[i]; return CARDS[CARDS.length - 1]; }
  function checkUnlocks() {
    const lv = playerLevel();
    CARDS.forEach((c, i) => {
      const cs = S.cards[c.id]; if (cs.unlocked || i === 0) return;
      const prev = S.cards[CARDS[i - 1].id];
      if (prev.finished || lv >= c.unlock.lv) { cs.unlocked = true; notifyUnlock(c); }
    });
  }
  function notifyUnlock(c) { if (!uiReady || openFlag || modalOpen) return; setTimeout(() => toast('🆕 あたらしい カード「' + esc(c.title) + '」が ひらいたよ！', { label: 'みる', fn: () => openCard(c.id) }, 5000), 900); }
  function ensureDaily() {
    if (S.daily.d === today()) return;
    const c = activeCard(), cs = S.cards[c.id], open = c.missions.filter(m => !cs.m[m.id].done && m.type !== 'level');
    S.daily = { d: today(), id: open.length ? c.id + '.' + pick(open).id : '', done: false };
  }
  function doneCount(c) { const cs = S.cards[c.id]; return c.missions.filter(m => cs.m[m.id].done).length; }
  function completedLines(c) { const cs = S.cards[c.id]; return LINES.filter(l => l.every(i => cs.m[c.missions[i].id].done)); }

  function stampMission(c, m) {
    const cs = S.cards[c.id], st = cs.m[m.id]; if (st.done) return;
    st.done = true; st.at = Date.now(); st.rot = Math.round(rnd(-14, 14)); st.holo = doneCount(c) === 0 || Math.random() < .15;
    const rw = applyReward(m.reward), info = { card: c.id, m: m.id, title: m.title, char: m.char, holo: st.holo, lines: rewardLines(rw), daily: false };
    const key = keyOf(c, m);
    if (S.daily.id === key && !S.daily.done) { S.daily.done = true; S.stars++; applyReward({ money: CFG.dailyBonus }); info.daily = true; info.lines.push('⭐ きょうの おすすめ +' + CFG.dailyBonus + ' G'); }
    S.fresh.push(key); queueStamps.push(info);
    // ビンゴ
    const lines = completedLines(c).map(l => l.join('-')), newL = lines.filter(l => !cs.lines.includes(l));
    newL.forEach(l => { cs.lines.push(l); if (cs.draws < CFG.maxLineDraws) { cs.draws++; S.pending.push({ type: 'lottery', card: c.id }); info.bingo = true; } else info.bingo = info.bingo || false; });
    // カードかんせい
    if (doneCount(c) === c.missions.length && !cs.finished) {
      cs.finished = true; S.pending.push({ type: 'chest', card: c.id }); info.complete = true;
      if (c.diag) S.pending.push({ type: 'diag' });
      if (c.graduation && !S.graduated) { S.graduated = true; S.pending.push({ type: 'grad' }); }
      checkUnlocks();
    }
  }
  function refreshLevels() {
    if (busy || !S) return; busy = true;
    try {
      const lv = playerLevel(); let changed = false;
      checkUnlocks();
      CARDS.forEach(c => { const cs = S.cards[c.id]; if (!cs.unlocked) return; c.missions.forEach(m => { if (m.type !== 'level') return; const st = cs.m[m.id]; if (st.done) return; const p = Math.min(lv, m.count); if (p !== st.p) { st.p = p; changed = true; } if (lv >= m.count) { stampMission(c, m); changed = true; } }); });
      checkUnlocks(); ensureDaily();
      if (changed) save();
      dirty = dirty || changed;
    } finally { busy = false; }
    const ch = dirty; dirty = false; afterChange(ch);
  }
  function report(event, n, meta) {
    try {
      if (!S) { pendingReports.push([event, n, meta]); return; }
      n = n == null ? 1 : n; if (busy) return; busy = true;
      try {
        S.counters[event] = (S.counters[event] || 0) + n; const cat = EVENT_CAT[event]; if (cat) S.counters['cat_' + cat] = (S.counters['cat_' + cat] || 0) + n;
        ensureDaily();
        CARDS.forEach(c => {
          const cs = S.cards[c.id]; if (!cs.unlocked) return;
          c.missions.forEach(m => {
            const st = cs.m[m.id]; if (st.done || m.event !== event) return;
            if (m.type === 'distinct') { const k = meta && meta[m.key]; if (k != null && !st.keys.includes(String(k))) st.keys.push(String(k)); st.p = Math.min(m.count, st.keys.length); }
            else st.p = Math.min(m.count, st.p + n);
            if (st.p >= m.count) stampMission(c, m);
          });
        });
        save();
      } finally { busy = false; }
      dirty = true; refreshLevels();   // ごほうびEXPで レベルが あがったときも拾う
    } catch (e) { try { console.warn('[stampcard]', e); } catch (_) {} }
  }
  const pendingReports = [];

  /* ============================================================
   * 5. サウンド
   * ============================================================ */
  let AC = null, bus = null, nbuf = null, soundOn = ls.get(CFG.soundKey) !== 'off';
  function initAudio() {
    if (!AC) { try { AC = new (global.AudioContext || global.webkitAudioContext)(); const comp = AC.createDynamicsCompressor(); bus = AC.createGain(); bus.gain.value = .9; bus.connect(comp); comp.connect(AC.destination); nbuf = AC.createBuffer(1, AC.sampleRate * .4, AC.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(f, dur, type, vol, when, slide) {
    if (!soundOn || !AC) return; const t = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol || .2, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, when, hp) {
    if (!soundOn || !AC) return; const t = AC.currentTime + (when || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = nbuf; f.type = 'highpass'; f.frequency.value = hp || 5000; g.gain.setValueAtTime(vol || .1, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + .02);
  }
  const SE = {
    click() { tone(700, .06, 'square', .07); },
    slam(holo) { tone(95, .35, 'sine', .55, 0, -55); noise(.14, .2, 0, 1400); tone(1568, .35, 'triangle', .1, .08); if (holo) [1319, 1760, 2349].forEach((f, i) => tone(f, .3, 'triangle', .1, .12 + i * .07)); },
    pop() { tone(500, .12, 'sine', .2, 0, 500); },
    coin() { tone(1319, .08, 'square', .09); tone(1760, .2, 'square', .09, .07); },
    chime() { [784, 988, 1319, 1568].forEach((f, i) => tone(f, .3, 'triangle', .16, i * .08)); },
    bingo() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .26, 'triangle', .16, i * .07)); },
    fanfare() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, .34, 'triangle', .17, i * .11); tone(f / 2, .34, 'sine', .12, i * .11); }); noise(.5, .1, 0, 6000); },
    shake() { tone(220 + Math.random() * 60, .06, 'square', .06); noise(.05, .05, 0, 3000); }
  };

  /* ============================================================
   * 6. 画面（Shadow DOM の中に作る ＝ 本編のCSSと まざらない）
   * ============================================================ */
  let root, $, host, fx, fxc, parts = [], fxRun = false, view = 'c1', openFlag = false, cerBusy = false, modalOpen = false;
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;font-family:"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo",system-ui,sans-serif}
.fab{position:fixed;bottom:78px;width:60px;height:60px;border-radius:50%;background:linear-gradient(#fff3a0,#ffd23f);border:3px solid #1b1f3b;box-shadow:0 4px 0 #1b1f3b,0 6px 14px rgba(0,0,0,.3);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;user-select:none;color:#1b1f3b}
.fab:active{transform:translateY(3px);box-shadow:0 1px 0 #1b1f3b}
.fab small{position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);background:#1b1f3b;color:#fff;font-size:10px;font-weight:900;padding:1px 7px;border-radius:8px;white-space:nowrap}
.fab .badge{position:absolute;top:-7px;right:-7px;min-width:24px;height:24px;border-radius:12px;background:#ff2e63;color:#fff;font-size:13px;font-weight:900;display:none;align-items:center;justify-content:center;border:2px solid #fff;padding:0 5px;animation:pulse 1s infinite}
.fab.wiggle{animation:wig 1.4s infinite}
@keyframes wig{0%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
.ov{position:fixed;inset:0;z-index:2147483100;background:rgba(10,14,34,.7);display:none;align-items:center;justify-content:center;padding:10px}
.ov.show{display:flex;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sheet{position:relative;width:100%;max-width:440px;max-height:calc(100dvh - 20px);overflow-y:auto;background:repeating-linear-gradient(#fff8e7 0 23px,#f3e6c6 23px 24px);border:4px solid #1b1f3b;border-radius:24px;box-shadow:0 8px 0 #1b1f3b;padding:12px 12px 14px;color:#1b1f3b;animation:popIn .3s cubic-bezier(.2,1.5,.4,1)}
@keyframes popIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.x{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:3px solid #1b1f3b;background:#fff;font-size:16px;font-weight:900;cursor:pointer;z-index:3;padding:0;color:#1b1f3b}
.snd{position:absolute;top:8px;right:50px;width:36px;height:36px;border-radius:50%;border:3px solid #1b1f3b;background:#fff;font-size:16px;cursor:pointer;z-index:3;padding:0}
.tabs{display:flex;gap:6px;margin:0 90px 8px 0}
.tab{flex:1;height:34px;border-radius:12px;border:3px solid #1b1f3b;background:#fff;font-weight:900;font-size:14px;cursor:pointer;color:#1b1f3b;padding:0;position:relative}
.tab.sel{background:var(--ink);color:#fff;transform:translateY(-2px);box-shadow:0 3px 0 #1b1f3b}
.tab.lock{background:#cfd4de;color:#7d8696}
.tab.fin::after{content:"✓";position:absolute;right:-5px;top:-9px;width:18px;height:18px;border-radius:50%;background:#2fd46b;color:#fff;font-size:11px;line-height:15px;border:2px solid #fff}
.head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.nav{width:58px;height:58px;object-fit:contain;flex:none;filter:drop-shadow(0 3px 0 rgba(0,0,0,.2));animation:floaty 2.4s ease-in-out infinite}
.navtile{width:58px;height:58px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid var(--ink);background:#fff;font-size:22px;font-weight:900;color:var(--ink)}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.say{position:relative;flex:1;background:#fff;border:3px solid #1b1f3b;border-radius:14px;padding:6px 10px;font-size:12.5px;font-weight:900;line-height:1.4}
.say::before{content:"";position:absolute;left:-11px;top:16px;border:8px solid transparent;border-right:10px solid #1b1f3b;border-left:0}
.say::after{content:"";position:absolute;left:-6px;top:18px;border:6px solid transparent;border-right:8px solid #fff;border-left:0}
.ttl{display:flex;align-items:center;justify-content:space-between;background:var(--ink);color:#fff;border:3px solid #1b1f3b;border-radius:14px;padding:5px 12px;margin-bottom:8px;box-shadow:0 3px 0 #1b1f3b}
.ttl b{font-size:16px;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.ttl span{font-size:13px;font-weight:900;background:rgba(0,0,0,.25);border-radius:10px;padding:1px 9px}
.sub{font-size:11.5px;font-weight:bold;margin:-2px 2px 8px;color:#6b5a2f}
.daily{font-size:12px;font-weight:900;background:#fff3a0;border:2px dashed #d9a500;border-radius:12px;padding:4px 10px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cell{position:relative;aspect-ratio:1;border-radius:16px;border:3px dashed #c9a66b;background:rgba(255,255,255,.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px;cursor:pointer;text-align:center;overflow:visible}
.cell:active{transform:scale(.96)}
.cell .ic{font-size:30px;line-height:1.1;filter:grayscale(.15)}
.cell .tt{font-size:11px;font-weight:900;line-height:1.25}
.cell .pg{font-size:10.5px;font-weight:900;color:#a56a00;background:#fff1c7;border-radius:8px;padding:0 6px;margin-top:2px}
.cell.done{border-style:solid;border-color:var(--ink);background:#fffdf4}
.cell.done .tt{font-size:10.5px;color:#6b5a2f;margin-top:1px}
.cell.line{box-shadow:0 0 0 3px #ffd23f,0 0 16px #ffd23f}
.cell.daily::after{content:"⭐";position:absolute;top:-8px;right:-6px;font-size:20px;animation:pulse 1s infinite}
.cell.locked{opacity:.55;border-color:#aab}
.sw{width:74%;aspect-ratio:1}
.stamp{position:relative;width:100%;height:100%;border-radius:50%;border:4px solid var(--ink);background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;transform:rotate(var(--rot,0deg));box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 5px var(--ink);overflow:hidden}
.stamp img{width:80%;height:80%;object-fit:contain}
.stamp .tile{font-weight:900;font-size:22px;color:var(--ink)}
.stamp.holo::after{content:"";position:absolute;inset:0;background:conic-gradient(from 0deg,#ff9ff3,#ffd23f,#7dffd4,#3de0ff,#a98bff,#ff9ff3);mix-blend-mode:color;opacity:.7;animation:spin 3s linear infinite}
.stamp.holo::before{content:"✦";position:absolute;right:8%;top:4%;font-size:15px;color:#fff;text-shadow:0 0 6px #ffd23f;z-index:2;animation:pulse 1.2s infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cell.fresh .sw{animation:slam .75s cubic-bezier(.2,1.3,.4,1) both}
.cell.fresh::before{content:"";position:absolute;left:50%;top:44%;width:30px;height:30px;margin:-15px;border-radius:50%;border:4px solid var(--ink);opacity:0;animation:ink .8s .25s ease-out}
@keyframes slam{0%{transform:translateY(-110px) scale(3.2) rotate(-30deg);opacity:0}50%{transform:translateY(0) scale(.8) rotate(0);opacity:1}72%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes ink{0%{opacity:.8;transform:scale(.6)}100%{opacity:0;transform:scale(4)}}
.card.shake{animation:cshake .35s}
@keyframes cshake{0%,100%{transform:translate(0,0)}20%{transform:translate(-4px,3px)}40%{transform:translate(4px,-3px)}60%{transform:translate(-3px,-2px)}80%{transform:translate(3px,2px)}}
.foot{margin-top:10px;font-size:11.5px;font-weight:bold;line-height:1.55}
.foot .tk{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.chip{background:#fff;border:2px solid #1b1f3b;border-radius:10px;padding:2px 8px;font-weight:900;font-size:11.5px}
.btn{display:block;width:100%;font-weight:900;font-size:16px;text-align:center;border:3px solid #1b1f3b;border-radius:16px;padding:11px 10px;cursor:pointer;color:#1b1f3b;box-shadow:0 5px 0 #1b1f3b;margin-top:10px;background:linear-gradient(#fff3a0,#ffd23f)}
.btn:active{transform:translateY(4px);box-shadow:0 1px 0 #1b1f3b}
.btn.go{background:linear-gradient(#ffb3cf,#ff5d8f);color:#fff;animation:pulse 1s infinite}
.btn.mint{background:linear-gradient(#c5ffe9,#5fe8b4)}
.lockmsg{text-align:center;padding:26px 10px;font-weight:900;font-size:14px;line-height:1.7;color:#6b5a2f}
.lockmsg b{font-size:40px;display:block}
/* モーダル */
.md{position:fixed;inset:0;z-index:2147483300;background:rgba(10,14,34,.78);display:none;align-items:center;justify-content:center;padding:14px}
.md.show{display:flex}
.mdc{width:100%;max-width:340px;max-height:calc(100dvh - 28px);overflow-y:auto;background:#fff;color:#1b1f3b;border:4px solid #1b1f3b;border-radius:24px;box-shadow:0 8px 0 #1b1f3b;padding:16px;text-align:center;animation:popIn .3s cubic-bezier(.2,1.5,.4,1)}
.mdc h3{margin:0 0 6px;font-size:21px}
.mdc p{margin:4px 0 8px;font-size:13px;line-height:1.55;font-weight:bold}
.rw{display:flex;flex-direction:column;gap:5px;margin:8px 0}
.rw div{background:#fff8e1;border:2px solid #f0c24b;border-radius:12px;padding:6px 10px;font-weight:900;font-size:15px;opacity:0;transform:translateY(8px);animation:rowIn .4s forwards}
@keyframes rowIn{to{opacity:1;transform:none}}
.caps{display:flex;justify-content:center;gap:12px;margin:14px 0}
.cap{width:78px;height:78px;border-radius:50%;border:4px solid #1b1f3b;cursor:pointer;font-size:34px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 32% 30%,#fff,var(--c) 60%);box-shadow:0 5px 0 #1b1f3b;animation:capb 1.1s infinite;color:#fff;font-weight:900}
.cap:nth-child(2){animation-delay:.2s}.cap:nth-child(3){animation-delay:.4s}
.cap.pop{animation:cappop .5s forwards}
.cap.out{opacity:.25;animation:none}
@keyframes capb{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px) rotate(6deg)}}
@keyframes cappop{0%{transform:scale(1)}40%{transform:scale(1.5) rotate(-12deg)}100%{transform:scale(1.2)}}
.chest{font-size:84px;line-height:1;cursor:pointer;display:inline-block;animation:shk 0.6s infinite}
.chest.open{animation:chop .6s forwards}
@keyframes shk{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes chop{0%{transform:scale(1)}50%{transform:scale(1.5) rotate(6deg)}100%{transform:scale(1.2)}}
.bar{display:flex;align-items:center;gap:6px;margin:5px 0;font-size:12.5px;font-weight:900;text-align:left}
.bar i{display:block;height:14px;border-radius:7px;background:linear-gradient(90deg,#ff9ff3,#35a7ff);min-width:4px;border:2px solid #1b1f3b}
.bar span{width:84px;flex:none}
.gold{background:linear-gradient(#fff8c4,#ffd23f)}
/* スタンプの演出（カードを とじているときに 出る） */
.cer{position:fixed;inset:0;z-index:2147483200;background:rgba(10,14,34,.45);display:none;align-items:center;justify-content:center;pointer-events:auto}
.cer.show{display:flex;animation:fadeIn .15s}
.cerp{position:relative;width:min(80vw,300px);background:#fff8e7;border:4px solid #1b1f3b;border-radius:24px;box-shadow:0 8px 0 #1b1f3b;padding:16px 14px 14px;text-align:center;color:#1b1f3b;animation:popIn .25s cubic-bezier(.2,1.5,.4,1)}
.cerp .big{width:128px;height:128px;margin:0 auto 6px;position:relative}
.cerp .big .sw{width:100%;animation:slam .75s cubic-bezier(.2,1.3,.4,1) both}
.cerp .big::before{content:"";position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;border:5px solid var(--ink);opacity:0;animation:ink .9s .3s ease-out}
.cerp .t1{font-size:22px;font-weight:900;color:var(--ink);text-shadow:0 2px 0 #fff}
.cerp .t2{font-size:14px;font-weight:900;margin-top:2px}
.cerp .t3{font-size:12.5px;font-weight:900;margin-top:6px;color:#b36b00;line-height:1.5}
.cerp .t4{font-size:12.5px;font-weight:900;margin-top:6px;color:#fff;background:#ff5d8f;border-radius:10px;padding:3px 8px;display:inline-block}
.toast{position:fixed;left:50%;top:12px;transform:translate(-50%,-90px);z-index:2147483250;background:#fff;color:#1b1f3b;border:3px solid #1b1f3b;border-radius:16px;box-shadow:0 4px 0 #1b1f3b;padding:8px 14px;font-weight:900;font-size:13px;max-width:92vw;text-align:center;transition:transform .35s cubic-bezier(.2,1.5,.4,1);line-height:1.5}
.toast.show{transform:translate(-50%,0)}
.toast button{margin-left:8px;border:2px solid #1b1f3b;background:#ffd23f;border-radius:10px;font-weight:900;padding:2px 10px;cursor:pointer}
#fx{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483400}
`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const charSrc = sym => CFG.charPath.replace('{sym}', sym);
  function tileEl(sym) { const b = document.createElement('b'); b.className = 'tile'; b.textContent = sym; return b; }
  function charImg(sym, cls) { const im = document.createElement('img'); if (cls) im.className = cls; im.alt = sym; im.src = charSrc(sym); im.onerror = () => { const t = tileEl(sym); if (cls === 'nav') t.className = 'navtile tile'; im.replaceWith(t); }; return im; }
  function stampEl(sym, ink, rot, holo) { const w = document.createElement('div'); w.className = 'sw'; const s = document.createElement('div'); s.className = 'stamp' + (holo ? ' holo' : ''); s.style.setProperty('--ink', ink); s.style.setProperty('--rot', rot + 'deg'); s.appendChild(charImg(sym)); w.appendChild(s); return w; }

  function buildUI() {
    host = document.createElement('div'); host.id = 'stamp-card-root'; document.body.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="fab" id="fab" role="button" aria-label="スタンプカード">📒<small id="fabTx">0/9</small><span class="badge" id="fabBadge">0</span></div>
      <div class="ov" id="ov"><div class="sheet card" id="sheet"><button class="snd" id="snd">🔊</button><button class="x" id="x">✕</button><div id="body"></div></div></div>
      <div class="cer" id="cer"><div class="cerp" id="cerp"></div></div>
      <div class="md" id="md"><div class="mdc" id="mdc"></div></div>
      <div class="toast" id="toast"></div>
      <canvas id="fx"></canvas>`;
    $ = id => root.getElementById(id);
    fx = $('fx'); fxc = fx.getContext('2d'); sizeFx(); global.addEventListener('resize', sizeFx);
    const fab = $('fab'); fab.style[CFG.buttonSide === 'left' ? 'left' : 'right'] = '12px'; fab.style.bottom = CFG.buttonBottom + 'px'; if (!CFG.button) fab.style.display = 'none';
    fab.onclick = () => { initAudio(); SE.click(); openCard(); };
    $('x').onclick = () => { SE.click(); closeCard(); };
    $('ov').addEventListener('pointerdown', e => { if (e.target === $('ov')) closeCard(); });
    $('snd').onclick = () => { soundOn = !soundOn; ls.set(CFG.soundKey, soundOn ? 'on' : 'off'); $('snd').textContent = soundOn ? '🔊' : '🔇'; initAudio(); SE.click(); };
    $('snd').textContent = soundOn ? '🔊' : '🔇';
    $('cer').addEventListener('pointerdown', () => { cerClose(true); });
    root.addEventListener('pointerdown', initAudio, { once: true });
  }

  /* ---- ふわっと出るお知らせ ---- */
  let toastT = 0;
  function toast(html, action, ms) {
    const t = $('toast'); t.innerHTML = html; if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { t.classList.remove('show'); action.fn(); }; t.appendChild(b); }
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 3800);
  }

  /* ---- パーティクル ---- */
  function sizeFx() { if (!fx) return; const d = Math.min(global.devicePixelRatio || 1, 2); fx.width = innerWidth * d; fx.height = innerHeight * d; fx._d = d; }
  const PAL = ['#ff5d8f', '#ffd23f', '#7dffd4', '#3de0ff', '#a98bff', '#ffffff'];
  function starP(c, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  function burst(x, y, n, power, cols) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (Math.random() * .7 + .3) * (power || 9); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, s: Math.random() * 7 + 5, c: pick(cols || PAL), r: Math.random() * 6, vr: (Math.random() - .5) * .4, star: Math.random() < .55, life: 1, dec: .014 + Math.random() * .014 }); } runFx(); }
  function rain(n) { for (let i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 220, vx: (Math.random() - .5) * 3, vy: Math.random() * 3 + 2, s: Math.random() * 8 + 6, c: pick(PAL), r: Math.random() * 6, vr: (Math.random() - .5) * .3, star: Math.random() < .3, life: 1, dec: .005 }); runFx(); }
  function runFx() {
    if (fxRun) return; fxRun = true;
    const loop = () => {
      const d = fx._d; fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, fx.width, fx.height); fxc.scale(d, d);
      parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
      parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.r += p.vr; p.life -= p.dec; fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.globalAlpha = clamp(p.life * 1.6, 0, 1); fxc.fillStyle = p.c; if (p.star) { starP(fxc, p.s); fxc.fill(); } else fxc.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); fxc.restore(); });
      if (parts.length) requestAnimationFrame(loop); else { fxRun = false; fxc.clearRect(0, 0, fx.width, fx.height); }
    };
    requestAnimationFrame(loop);
  }
  function burstAt(el, n, power, cols) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n, power, cols); }

  /* ---- 📒ボタンの表示 ---- */
  function updateFab() {
    if (!root) return; const c = activeCard(), n = doneCount(c), tot = c.missions.length;
    $('fabTx').textContent = n + '/' + tot;
    const badge = S.fresh.length + S.pending.length; const b = $('fabBadge'); b.style.display = badge ? 'flex' : 'none'; b.textContent = badge;
    $('fab').classList.toggle('wiggle', badge > 0 || !S.seenIntro);
  }

  /* ---- スタンプが おされる演出（カードを とじているとき） ---- */
  function cerClose(skip) { clearTimeout(cerT); $('cer').classList.remove('show'); cerBusy = false; if (queueStamps.length) setTimeout(playCeremony, skip ? 120 : 250); else postCeremony(); }
  let cerT = 0;
  function playCeremony() {
    if (cerBusy || openFlag || modalOpen || !queueStamps.length) return;
    const info = queueStamps.shift(), c = cardById(info.card); cerBusy = true; initAudio();
    const p = $('cerp'); p.style.setProperty('--ink', c.ink); p.innerHTML = '';
    const big = document.createElement('div'); big.className = 'big'; big.style.setProperty('--ink', c.ink); big.appendChild(stampEl(info.char, c.ink, S.cards[info.card].m[info.m].rot, info.holo)); p.appendChild(big);
    const add = (cls, txt) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; p.appendChild(d); };
    add('t1', info.holo ? '✨ キラキラ スタンプ GET！' : 'スタンプ GET！'); add('t2', info.title);
    if (info.lines.length) add('t3', info.lines.join('　'));
    if (info.bingo) add('t4', '🎉 ビンゴ！ 福引が ひけるよ');
    if (info.complete) add('t4', '🎁 カード かんせい！');
    S.fresh = S.fresh.filter(k => k !== info.card + '.' + info.m); save();
    $('cer').classList.add('show'); setTimeout(() => { SE.slam(info.holo); }, 280);
    setTimeout(() => { const r = big.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, info.holo ? 40 : 22, 9, info.holo ? PAL : [c.ink, '#ffd23f', '#ffffff']); if (info.lines.length) SE.coin(); }, 520);
    cerT = setTimeout(() => cerClose(false), info.bingo || info.complete ? 2600 : 2000);
    updateFab();
  }
  function postCeremony() {
    updateFab();
    if (S.pending.length && !openFlag && !modalOpen) toast('🎁 ごほうびが たまってるよ！', { label: 'ひらく', fn: () => openCard() }, 4200);
  }
  function afterChange(ch) {
    if (!uiReady) return;
    if (openFlag) { if (ch) { renderCard(); queueStamps = []; } return; }
    updateFab(); if (queueStamps.length) setTimeout(playCeremony, 150);
  }

  /* ============================================================
   * 7. スタンプカードの画面
   * ============================================================ */
  function openCard(id) {
    if (!uiReady) return; initAudio(); openFlag = true; view = id || (cardById(view) && isUnlocked(cardById(view)) ? view : activeCard().id);
    if (!id) view = activeCard().id;
    queueStamps = []; clearTimeout(cerT); cerBusy = false; $('cer').classList.remove('show'); $('toast').classList.remove('show');
    $('ov').classList.add('show'); S.seenIntro = true; renderCard(); save(); updateFab();
  }
  function closeCard() { openFlag = false; $('ov').classList.remove('show'); updateFab(); }
  function say(c) {
    const cs = S.cards[c.id], n = doneCount(c), tot = c.missions.length;
    if (n === 0) return 'スタンプカードへ ようこそ！ 好きな マスから ためして みよう！';
    if (cs.finished) return 'カード かんせい！ すごい！ つぎの カードも ひらいたよ';
    const near = LINES.find(l => l.filter(i => cs.m[c.missions[i].id].done).length === 2 && !cs.lines.includes(l.join('-')));
    if (near) return 'あと 1マスで ビンゴ！ ねらってみて！';
    if (n >= tot - 2) return 'もう すぐ かんせい！ ラストスパート！';
    return pick(['いい ちょうし！ ぜんぶの きのうを ためしてみよう', 'どれから やる？ すきな ものから で いいよ！', 'スタンプが たまると ごほうびが もらえるよ']);
  }
  function renderCard() {
    const body = $('body'); body.innerHTML = ''; const c = cardById(view), cs = S.cards[c.id], unlocked = cs.unlocked;
    $('sheet').style.setProperty('--ink', c.ink);
    // タブ
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    CARDS.forEach((cc, i) => { const b = document.createElement('button'); b.className = 'tab' + (cc.id === view ? ' sel' : '') + (!S.cards[cc.id].unlocked ? ' lock' : '') + (S.cards[cc.id].finished ? ' fin' : ''); b.style.setProperty('--ink', cc.ink); b.textContent = S.cards[cc.id].unlocked ? String(i + 1) : '🔒'; b.onclick = () => { SE.click(); view = cc.id; renderCard(); }; tabs.appendChild(b); });
    body.appendChild(tabs);
    // ナビ
    const head = document.createElement('div'); head.className = 'head'; head.appendChild(charImg(c.nav, 'nav'));
    const sy = document.createElement('div'); sy.className = 'say'; sy.textContent = unlocked ? say(c) : 'まだ ひらいて いないよ。じゅんびが できたら 見に きてね！'; head.appendChild(sy); body.appendChild(head);
    const ttl = document.createElement('div'); ttl.className = 'ttl'; ttl.innerHTML = `<b>${esc(c.title)}</b><span>${doneCount(c)} / ${c.missions.length}</span>`; body.appendChild(ttl);
    const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = c.sub; body.appendChild(sub);
    if (!unlocked) {
      const lm = document.createElement('div'); lm.className = 'lockmsg'; lm.innerHTML = `<b>🔒</b>Lv${c.unlock.lv} に なるか、<br>ひとつ前の カードを かんせいすると<br>ひらくよ！`; body.appendChild(lm); return;
    }
    // きょうのおすすめ
    ensureDaily(); const dm = S.daily.id && !S.daily.done ? S.daily.id : '';
    if (dm) { const [cid, mid] = dm.split('.'); const mm = cardById(cid) && cardById(cid).missions.find(m => m.id === mid); if (mm && cid === c.id) { const d = document.createElement('div'); d.className = 'daily'; d.textContent = `⭐ きょうの おすすめ: 「${mm.title}」で ボーナス +${CFG.dailyBonus}G！`; body.appendChild(d); } }
    // マス
    const grid = document.createElement('div'); grid.className = 'grid'; const lineCells = new Set(completedLines(c).flat());
    const freshCells = [];
    c.missions.forEach((m, i) => {
      const st = cs.m[m.id], key = keyOf(c, m), cell = document.createElement('div');
      cell.className = 'cell' + (st.done ? ' done' : '') + (lineCells.has(i) ? ' line' : '') + (dm === key ? ' daily' : '') + (S.fresh.includes(key) ? ' fresh' : ''); cell.style.setProperty('--ink', c.ink);
      if (st.done) { cell.appendChild(stampEl(m.char, c.ink, st.rot, st.holo)); const t = document.createElement('div'); t.className = 'tt'; t.textContent = m.title; cell.appendChild(t); if (S.fresh.includes(key)) freshCells.push(cell); }
      else { cell.innerHTML = `<div class="ic">${m.icon}</div><div class="tt">${esc(m.title)}</div>` + (m.count > 1 ? `<div class="pg">${m.type === 'level' ? 'Lv' + Math.min(playerLevel(), m.count) + ' / ' + m.count : st.p + ' / ' + m.count}</div>` : ''); }
      cell.onclick = () => { SE.click(); showDetail(c, m); }; grid.appendChild(cell);
    });
    body.appendChild(grid);
    // 新しいスタンプの演出
    if (freshCells.length) { const sheet = $('sheet'); freshCells.forEach((el, i) => setTimeout(() => { SE.slam(false); sheet.classList.remove('shake'); void sheet.offsetWidth; sheet.classList.add('shake'); setTimeout(() => burstAt(el, 18, 8, [c.ink, '#ffd23f', '#fff']), 330); }, 200 + i * 650)); S.fresh = S.fresh.filter(k => !k.startsWith(c.id + '.')); save(); updateFab(); }
    // フッター
    const foot = document.createElement('div'); foot.className = 'foot';
    const lineNote = `ビンゴ(たて・よこ・ななめ): 🎰 ミニ福引（${cs.draws}/${CFG.maxLineDraws}）　かんせい: 🎁 ごほうび箱`;
    foot.innerHTML = `<div>${lineNote}</div><div>かんせいの ごほうび: ${rewardLines(c.finish).map(esc).join(' ／ ')}</div><div class="tk"><span class="chip">🎫 ${TICKET_NAMES.bulkGen} ×${S.tickets.bulkGen || 0}</span><span class="chip">🎫 ${TICKET_NAMES.bulkMine} ×${S.tickets.bulkMine || 0}</span><span class="chip">⭐ ${S.stars}</span></div>`;
    body.appendChild(foot);
    const pend = S.pending;
    if (pend.length) { const b = document.createElement('button'); b.className = 'btn go'; b.textContent = `🎁 ごほうびを うけとる (${pend.length})`; b.onclick = () => { SE.click(); runPending(); }; body.appendChild(b); }
  }
  function showDetail(c, m) {
    const st = S.cards[c.id].m[m.id], mc = $('mdc'); modalOpen = true; $('md').classList.add('show');
    const lv = m.type === 'level' ? `Lv${Math.min(playerLevel(), m.count)} / ${m.count}` : `${st.p} / ${m.count}`;
    mc.innerHTML = `<div style="font-size:46px">${st.done ? '✅' : m.icon}</div><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p>${m.hint ? `<p style="color:#7a5a00">💡 ${esc(m.hint)}</p>` : ''}<div class="rw"><div style="opacity:1;transform:none">${st.done ? 'スタンプ ゲット ずみ！' : '進みぐあい ' + lv}</div><div style="opacity:1;transform:none">ごほうび: ${rewardLines(m.reward).join(' ')}</div></div><button class="btn mint" id="mdok">とじる</button>`;
    $('mdok').onclick = () => { SE.click(); closeModal(); };
  }
  function closeModal() { $('md').classList.remove('show'); modalOpen = false; }

  /* ---- ごほうびを うけとる（福引・ごほうび箱・診断・そつぎょう） ---- */
  function runPending() {
    const i = S.pending.length ? 0 : -1; if (i < 0) { renderCard(); return; }
    const p = S.pending[i]; S.pending.splice(i, 1); save();
    if (p.type === 'lottery') lotteryModal(p); else if (p.type === 'chest') chestModal(p); else if (p.type === 'diag') diagModal(); else if (p.type === 'grad') gradModal();
  }
  function mdOpen(html) { modalOpen = true; $('mdc').innerHTML = html; $('md').classList.add('show'); }
  function mdDone(next) { closeModal(); save(); updateFab(); renderCard(); refreshLevels(); if (S.pending.length) setTimeout(runPending, 350); }
  function lotteryModal(p) {
    const c = cardById(p.card), cols = ['#ff5d8f', '#35a7ff', '#2fbf71'];
    mdOpen(`<h3>🎉 ビンゴ！ ミニ福引</h3><p>カプセルを 1つ えらんで タップ！</p><div class="caps" id="caps">${cols.map((k, i) => `<div class="cap" data-i="${i}" style="--c:${k}">？</div>`).join('')}</div><div id="res"></div>`);
    SE.bingo(); rain(40); let picked = false;
    root.querySelectorAll('.cap').forEach(el => { el.onclick = () => {
      if (picked) return; picked = true; SE.pop(); el.classList.add('pop'); root.querySelectorAll('.cap').forEach(o => { if (o !== el) o.classList.add('out'); });
      setTimeout(() => { const rw = applyReward(lotteryRoll(c)); save(); SE.chime(); burstAt(el, 36, 11); el.textContent = '🎁'; $('res').innerHTML = `<div class="rw">${rewardLines(rw).map((t, i) => `<div style="animation-delay:${i * .15}s">${esc(t)}</div>`).join('')}</div><button class="btn mint" id="ok">やったー！</button>`; $('ok').onclick = () => { SE.click(); mdDone(); }; refreshLevelsSoft(); }, 450); }; });
  }
  function refreshLevelsSoft() { /* ごほうびEXPで レベルが あがった分は とじたときに反映 */ }
  function chestModal(p) {
    const c = cardById(p.card); const nxt = CARDS[cardIdx(c.id) + 1];
    mdOpen(`<h3>🎊 カード かんせい！</h3><p>「${esc(c.title)}」を ぜんぶ あつめたよ！<br>ごほうび箱を タップして あけよう！</p><div class="chest" id="chest">🎁</div><div id="res"></div>`);
    SE.fanfare(); rain(70); let opened = false; const el = $('chest');
    el.onclick = () => { if (opened) return; opened = true; SE.pop(); el.classList.add('open'); setTimeout(() => { const rw = applyReward(c.finish); save(); SE.chime(); el.textContent = '✨'; burstAt(el, 50, 12); $('res').innerHTML = `<div class="rw">${rewardLines(rw).map((t, i) => `<div style="animation-delay:${i * .18}s">${esc(t)}</div>`).join('')}</div>${nxt && S.cards[nxt.id].unlocked ? `<p style="color:#0b6b46">🆕 つぎの カード「${esc(nxt.title)}」が ひらいたよ！</p>` : ''}<button class="btn mint" id="ok">やったー！</button>`; $('ok').onclick = () => { SE.click(); if (nxt && S.cards[nxt.id].unlocked) view = nxt.id; mdDone(); }; }, 550); };
  }
  function diagModal() {
    const cats = Object.keys(CATS).map(k => ({ k, v: S.counters['cat_' + k] || 0 })).sort((a, b) => b.v - a.v), top = cats[0], max = Math.max(1, top.v), t = CATS[top.k];
    mdOpen(`<h3>🔍 すきな あそびかた しんだん</h3><div style="font-size:50px">${t.icon}</div><p style="font-size:18px;font-weight:900;color:#d63a73">あなたは「${esc(t.type)}」タイプ！</p><p>${esc(t.tip)}</p><div style="text-align:left">${cats.slice(0, 4).map(c => `<div class="bar"><span>${CATS[c.k].icon} ${CATS[c.k].n}</span><i style="width:${Math.max(4, Math.round(c.v / max * 100) * .55)}%"></i><b>${c.v}</b></div>`).join('')}</div><p style="font-size:11.5px;color:#6b5a2f">いままで いちばん たくさん あそんだ ことから しらべたよ。ほかの きのうも ためしたら かわるかも！</p><button class="btn mint" id="ok">なるほど！</button>`);
    SE.chime(); burstAt($('mdc'), 24, 9); $('ok').onclick = () => { SE.click(); mdDone(); };
  }
  function gradModal() {
    mdOpen(`<h3 style="color:#c98a00">🎓 Lv50 そつぎょう！</h3><div style="font-size:64px">🏆</div><p style="font-size:15px">ここまで あそんでくれて ありがとう！<br>Lv50で ひらく <b>まとめ生成(10こ)</b> と <b>まとめ掘削(5こ)</b> で、<br>これからも 工場を どんどん まわそう！</p><button class="btn gold" id="ok">ありがとう！</button>`);
    SE.fanfare(); rain(120); [0, 400, 800, 1200].forEach(t => setTimeout(() => burst(innerWidth * rnd(.2, .8), innerHeight * rnd(.15, .5), 40, 12), t));
    $('ok').onclick = () => { SE.click(); mdDone(); try { if (CFG.onGraduate) CFG.onGraduate(); } catch (e) {} };
  }

  /* ============================================================
   * 8. 公開API
   * ============================================================ */
  function init(opts) {
    if (S) return; Object.assign(CFG, opts || {});
    S = load(); ensureDaily();
    const start = () => {
      buildUI(); uiReady = true; view = activeCard().id; refreshLevels(); updateFab();
      pendingReports.splice(0).forEach(a => report.apply(null, a));
      if (!S.seenIntro) setTimeout(() => { if (openFlag || modalOpen) return; toast('📒 スタンプカードを もらったよ！<br>ミッションを クリアして スタンプを あつめよう', { label: 'みる', fn: () => openCard() }, 6000); }, 1200);
      setInterval(() => { try { refreshLevels(); } catch (e) {} }, 4000);
      global.addEventListener('storage', e => { if (e.key === CFG.gameKey) refreshLevels(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshLevels(); });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  const API = {
    init, report, open: openCard, close: closeCard, refresh: refreshLevels,
    hasTicket: k => !!S && (S.tickets[k] || 0) > 0,
    useTicket: k => { if (!S || (S.tickets[k] || 0) <= 0) return false; S.tickets[k]--; save(); updateFab(); if (openFlag) renderCard(); return true; },
    addTicket: (k, n) => { if (!S) return; S.tickets[k] = (S.tickets[k] || 0) + (n || 1); save(); },
    tickets: () => Object.assign({}, S && S.tickets),
    state: () => S, config: CFG, cards: CARDS,
    reset: () => { ls.set(CFG.storageKey, ''); S = freshState(); save(); ensureDaily(); if (uiReady) { queueStamps = []; renderCard(); updateFab(); } }
  };
  global.Stamp = API;
  if (global.STAMP_AUTO !== false) init();
})(window);
