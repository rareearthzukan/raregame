/*
 * areaconfig.js  ── 産地（採掘エリア）設定＋全ページ共通機能（解放演出・経験値・貿易ナビ・BGM自動停止）
 * 全ページ（map / mine / seisei / factory / home / zukan / export）から読み込みます。
 * 数値の調整はこのファイルだけで完結します。
 */
(function (global) {
  'use strict';

  const ALL17 = ['Y', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Sc'];
  const LIGHT = ['La', 'Ce', 'Pr', 'Nd', 'Sm', 'Sc'];   // 全体抽選では重み×3（従来どおり）

  const ELEMENT_NAMES = {
    Y: 'イットリウム', La: 'ランタン', Ce: 'セリウム', Pr: 'プラセオジム', Nd: 'ネオジム', Pm: 'プロメチウム',
    Sm: 'サマリウム', Eu: 'ユウロピウム', Gd: 'ガドリニウム', Tb: 'テルビウム', Dy: 'ジスプロシウム',
    Ho: 'ホルミウム', Er: 'エルビウム', Tm: 'ツリウム', Yb: 'イッテルビウム', Lu: 'ルテチウム', Sc: 'スカンジウム'
  };

  // 「主な元素」から出る割合。残りは全体抽選（どのエリアでも全元素が出る可能性あり）
  const TARGET_SHARE = 0.6;
  // 宝石が出たとき、そのエリアの「産地の石」から選ぶ割合。残りは全宝石から（プリズム鉱を除く）
  const GEM_HOME_SHARE = 0.6;
  const PRISM_ID = 100;

  // yield: 1回の採掘で得る掘削物の個数 [最小, 最大]（整数の一様乱数）
  const AREAS = {
    baiyun:    { name: '白雲鄂博',                 short: '白雲鄂博',     flagImg: 'hata_cn.png',         color: '#e74c3c', cost: 10,  yield: [1, 2],  gemRate: 0.03, targets: ['La', 'Ce', 'Pr', 'Nd'] },
    america:   { name: 'マウンテンパス',           short: 'アメリカ',     flagImg: 'hata_us.png',         color: '#f1c40f', cost: 30,  yield: [1, 2],  gemRate: 0.03, targets: ['Eu', 'Y', 'La'] },
    mount:     { name: 'マウント・ウェルド',       short: 'オーストラリア', flagImg: 'hata_au.png',       color: '#2ecc71', cost: 50,  yield: [1, 3],  gemRate: 0.03, targets: ['Nd', 'Sm', 'Pr'] },
    myanmar:   { name: 'ミャンマー',               short: 'ミャンマー',   flagImg: 'hata_mm.png',         color: '#e056fd', cost: 100, yield: [2, 4],  gemRate: 0.03, targets: ['Dy', 'Tb', 'Y'] },
    africa:    { name: 'アフリカ新興鉱床',         short: 'アフリカ',     flagImg: 'hata_af.png',         color: '#e67e22', cost: 150, yield: [3, 5],  gemRate: 0.03, targets: ['Lu', 'Yb', 'Sc'] },
    tahiti:    { name: '南太平洋',                 short: '南太平洋',     flagImg: 'hata_pf.png',         color: '#3498db', cost: 200, yield: [3, 7],  gemRate: 0.03, targets: ['Dy', 'Tb', 'Er', 'Yb'] },
    greenland: { name: 'グリーンランド',           short: 'グリーンランド', flagImg: 'hata_greenisland.png', color: '#aed6f1', cost: 300, yield: [5, 9],  gemRate: 0.03, targets: ['Gd', 'Ho', 'Er'] },
    // 南鳥島：全17元素が均等（重希土類もPm・Tmも出やすい）
    okinotori: { name: '南鳥島沖',               short: '南鳥島',     flagImg: 'hata_jp.png',         color: '#ffffff', cost: 500, yield: [7, 13], gemRate: 0.03, targets: ALL17, uniform: true }
  };
  const MIXED = { name: '混合', short: 'ミックス', color: '#7f8c8d' };   // 旧データなど産地不明の掘削物

  // ───── 宝石の産地（1つの宝石につき主産地は1エリア。合計100種） ─────
  const GEM_HOME = {
    baiyun:    [15, 17, 18, 38, 86, 12, 16, 37, 55, 58, 19],
    america:   [10, 68, 52, 98, 54, 90, 88, 8, 7, 74, 40, 75, 33, 27],
    mount:     [11, 97, 99, 50, 24, 3, 29, 94, 71, 44, 30],
    myanmar:   [2, 25, 87, 14, 73, 26, 70, 66, 23, 62, 60, 61, 59],
    africa:    [22, 65, 39, 91, 92, 93, 95, 53, 81, 64, 69, 32, 1, 4, 5],
    tahiti:    [48, 9, 34, 49, 89, 63, 43, 56, 35, 20, 31, 67],
    greenland: [45, 82, 84, 83, 76, 80, 77, 57, 21, 36, 46, 72],
    okinotori: [100, 47, 13, 41, 78, 79, 96, 85, 42, 51, 28, 6]
  };
  const GEM_OF = {};
  Object.keys(GEM_HOME).forEach(a => GEM_HOME[a].forEach(id => { GEM_OF[id] = a; }));

  // ───── 元素の出現率 ─────
  function normalize(w) {
    const s = Object.keys(w).reduce((a, k) => a + w[k], 0);
    const o = {};
    Object.keys(w).forEach(k => { o[k] = w[k] / s; });
    return o;
  }
  const GLOBAL_W = (function () {
    const w = {};
    ALL17.forEach(k => { w[k] = LIGHT.indexOf(k) >= 0 ? 3 : 1; });
    return normalize(w);
  })();
  const WEIGHT_CACHE = {};
  function elementWeights(areaId) {
    if (WEIGHT_CACHE[areaId]) return WEIGHT_CACHE[areaId];
    const area = AREAS[areaId];
    let out = {};
    if (!area) {
      out = Object.assign({}, GLOBAL_W);
    } else if (area.uniform) {
      ALL17.forEach(k => { out[k] = 1 / ALL17.length; });
    } else {
      ALL17.forEach(k => {
        out[k] = (1 - TARGET_SHARE) * GLOBAL_W[k] + (area.targets.indexOf(k) >= 0 ? TARGET_SHARE / area.targets.length : 0);
      });
    }
    WEIGHT_CACHE[areaId] = out;
    return out;
  }
  function weightedPick(w) {
    let r = Math.random(), last = null;
    const keys = Object.keys(w);
    for (let i = 0; i < keys.length; i++) {
      last = keys[i];
      r -= w[last];
      if (r < 0) return last;
    }
    return last;
  }
  function rollElement(areaId) { return weightedPick(elementWeights(areaId)); }

  // ───── 採掘量・宝石 ─────
  function rollYield(areaId) {
    const a = AREAS[areaId] || AREAS.baiyun;
    return a.yield[0] + Math.floor(Math.random() * (a.yield[1] - a.yield[0] + 1));
  }
  function rollGem(areaId, gems) {
    const home = GEM_HOME[areaId];
    if (home && Math.random() < GEM_HOME_SHARE) {
      const id = home[Math.floor(Math.random() * home.length)];
      return gems.find(g => g.id === id) || gems[0];
    }
    const pool = gems.filter(g => g.id !== PRISM_ID);   // プリズム鉱は南鳥島でだけ出る
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function gemHomeName(id) { const a = AREAS[GEM_OF[id]]; return a ? a.name : '各地'; }

  // ───── 掘削物の産地バッグ（gameState.mudByArea）─────
  // mudStock（総数）は従来どおり維持し、内訳だけをバッグで持つ。
  // 他のページが mudStock だけ増減しても、syncBag が差分を「混合」で吸収する。
  function syncBag(gs) {
    if (!gs.mudByArea) gs.mudByArea = {};
    const bag = gs.mudByArea;
    const stock = Math.max(0, gs.mudStock || 0);
    let total = 0;
    Object.keys(bag).forEach(k => { if (!(bag[k] > 0)) delete bag[k]; else total += bag[k]; });
    if (total < stock) {
      bag.mixed = (bag.mixed || 0) + (stock - total);
    } else if (total > stock) {
      let over = total - stock;
      const take = k => { const t = Math.min(bag[k] || 0, over); bag[k] = (bag[k] || 0) - t; over -= t; };
      take('mixed');
      while (over > 0) {
        const ks = Object.keys(bag).filter(k => bag[k] > 0).sort((a, b) => bag[b] - bag[a]);
        if (!ks.length) break;
        take(ks[0]);
      }
      Object.keys(bag).forEach(k => { if (!(bag[k] > 0)) delete bag[k]; });
    }
    return bag;
  }
  function addMud(gs, areaId, n) {
    syncBag(gs);
    gs.mudStock = (gs.mudStock || 0) + n;
    gs.mudByArea[areaId] = (gs.mudByArea[areaId] || 0) + n;
  }
  // バッグから n 個を（産地の割合どおりに）引く。mudStock の減算は呼び出し側で行う。
  function drawFromBag(gs, n) {
    syncBag(gs);
    const bag = gs.mudByArea, out = [];
    for (let i = 0; i < n; i++) {
      const keys = Object.keys(bag);
      let total = 0;
      keys.forEach(k => { total += bag[k]; });
      if (total <= 0) { out.push('mixed'); continue; }
      let r = Math.random() * total, pick = keys[keys.length - 1];
      for (let j = 0; j < keys.length; j++) {
        r -= bag[keys[j]];
        if (r < 0) { pick = keys[j]; break; }
      }
      bag[pick]--;
      if (bag[pick] <= 0) delete bag[pick];
      out.push(pick);
    }
    return out;
  }
  function composition(gs) {
    syncBag(gs);
    const bag = gs.mudByArea;
    const total = Object.keys(bag).reduce((a, k) => a + bag[k], 0);
    if (!total) return [];
    return Object.keys(bag).map(k => ({ id: k, count: bag[k], pct: bag[k] / total * 100 })).sort((a, b) => b.count - a.count);
  }
  // 今の配合で出やすい元素の上位 k 件
  function expectedElements(gs, k) {
    const comp = composition(gs);
    if (!comp.length) return [];
    const w = {};
    ALL17.forEach(e => { w[e] = 0; });
    comp.forEach(c => {
      const ew = elementWeights(c.id);
      ALL17.forEach(e => { w[e] += ew[e] * c.pct / 100; });
    });
    return ALL17.slice().sort((a, b) => w[b] - w[a]).slice(0, k || 3);
  }
  // ある元素が出やすいエリア（上位 k 件）
  function recommendAreasFor(key, k) {
    return Object.keys(AREAS)
      .map(id => ({ id: id, pct: elementWeights(id)[key] * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, k || 2);
  }
  function goToAreaFor(key) {
    try { localStorage.setItem('recommendElement', key); } catch (e) { /* noop */ }
    location.href = 'map.html';
  }

  // ───── 表示用ヘルパー ─────
  function areaShort(id) { return AREAS[id] ? AREAS[id].short : MIXED.short; }
  function flagHTML(id, cls) {
    const a = AREAS[id];
    if (!a) return '<span class="' + cls + '">🌐</span>';
    return '<img class="' + cls + '" src="' + a.flagImg + '" alt="" onerror="this.style.display=\'none\'">';
  }
  function originHTML(id) {
    return flagHTML(id, 'origin-flag') + (AREAS[id] ? AREAS[id].short + '産' : '混合');
  }
  function areaOddsText(id) {
    const a = AREAS[id];
    if (!a) return '';
    const y = a.yield[0] === a.yield[1] ? a.yield[0] + '個' : a.yield[0] + '〜' + a.yield[1] + '個';
    const el = a.uniform ? '全17元素が均等（Pm・Tmもここが一番）' : a.targets.map(k => ELEMENT_NAMES[k]).join('・');
    return '1回で ' + y + ' ／ 出やすい元素：' + el;
  }


  // ═════════════════════════════════════════════════════════════
  //  共通機能：解放レベル／経験値／解放演出／貿易ナビ／BGMの自動停止
  //  各ページは最後に RE.initCommon(gameState, {page:'○○'}) を1回呼ぶだけ。
  // ═════════════════════════════════════════════════════════════
  const SAVE_KEY = 'rareEarthGameState';
  const MAX_LEVEL = 50;
  // ★ 貿易の解放レベル（変更はここ1か所だけ）
  const TRADE_UNLOCK_LEVEL = 50;
  function isTradeUnlocked(gs) { return ((gs && gs.level) || 1) >= TRADE_UNLOCK_LEVEL; }

  function persist(gs) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(gs)); } catch (e) { /* noop */ } }

  // ───── 経験値テーブル（mine / factory / map / seisei で共通。ここだけ直せば全ページに反映）─────
  const EXP_TABLE = [
    0,
    100, 300, 600, 1000, 1600, 2400, 3500, 4800, 6500, 8500,
    11000, 14000, 18000, 23000, 29000, 36000, 45000, 56000, 70000, 90000,
    115000, 145000, 180000, 220000, 270000, 330000, 400000, 480000, 580000, 700000,
    850000, 1050000, 1300000, 1600000, 2000000, 2500000, 3100000, 3800000, 4700000, 5800000,
    7200000, 9000000, 11200000, 14000000, 17500000, 22000000, 28000000, 36000000, 48000000
  ];
  function getRequiredExp(level) {
    if (level >= MAX_LEVEL) return 50000000;
    return EXP_TABLE[level] || (level * 2000000);
  }
  // exp が足りていればレベルを上げる（複数レベル分まとめて）。レベルが変わったら true
  function syncLevel(gs) {
    if (!gs) return false;
    if (!(gs.level >= 1)) gs.level = 1;
    if (!(gs.exp >= 0)) gs.exp = 0;
    const from = gs.level;
    for (;;) {
      if (gs.level >= MAX_LEVEL) { gs.exp = 0; break; }
      const req = getRequiredExp(gs.level);
      if (gs.exp >= req) { gs.exp -= req; gs.level++; } else break;
    }
    return gs.level !== from;
  }
  // 経験値を加えてレベル判定まで行う。戻り値＝加算前のレベル
  function addExp(gs, amount) {
    const from = gs.level || 1;
    gs.exp = (gs.exp || 0) + (amount || 0);
    syncLevel(gs);
    return from;
  }

  // ───── レベル解放の一覧（解放演出に使う）─────
  const CATS = {
    trade:   { icon: '🌐', label: '貿易',     page: 'export'  },
    map:     { icon: '🗺️', label: 'マップ',   page: 'map'     },
    seisei:  { icon: '🧪', label: '精製',     page: 'seisei'  },
    factory: { icon: '🏭', label: '工場',     page: 'factory' },
    zukan:   { icon: '📖', label: '図鑑',     page: 'zukan'   },
    home:    { icon: '🏠', label: 'ホーム',   page: 'home'    }
  };
  const UNLOCKS = [];
  function U(lv, id, cat, icon, title, desc, extra) {
    UNLOCKS.push(Object.assign({ lv: lv, id: id, cat: cat, icon: icon, title: title, desc: desc || '' }, extra || {}));
  }
  // マップ（エリア）。名前は map.html の表示に合わせています
  [[5, 'mount', 'マウント・ウェルド鉱山'], [10, 'myanmar', 'ミャンマー（イオン吸着鉱床）'], [15, 'africa', 'アフリカ新興鉱床'],
   [20, 'tahiti', '南太平洋（深海エリア）'], [30, 'greenland', 'グリーンランド（氷河エリア）'], [50, 'okinotori', '南鳥島（EEZ海底泥エリア）']
  ].forEach(a => U(a[0], 'area-' + a[1], 'map', '🗺️', '新エリア「' + a[2] + '」', areaOddsText(a[1])));
  // 精製
  U(7,  'seisei-5',  'seisei', '🧪', '「5個まとめて精製」が使えるように', '150G。まとめて精製すると特別イベントも起きやすくなります');
  U(15, 'seisei-10', 'seisei', '🧪', '「10個まとめて精製」が使えるように', '300G。カード10枚が一度に出て、エルビウムの特別イベントも起きます');
  // 工場レシピ（factory.html の minLevel から生成）
  const RECIPE_LV = {
  "2": [
    "🕶️ 偏光サングラス",
    "🏺 陶磁器（きれいな器）"
  ],
  "3": [
    "🛡️ 強じん保護ガラス"
  ],
  "4": [
    "🚙 エコ・車のマフラー",
    "🎧 高音質ヘッドホン"
  ],
  "5": [
    "📏 厚さ計（工業用）",
    "✨ ピカピカ蛍光塗料"
  ],
  "6": [
    "💵 偽造防止・お札インク",
    "💡 省エネLEDライト"
  ],
  "7": [
    "🔊 重低音スピーカー",
    "📳 スマホの振動モーター"
  ],
  "8": [
    "💿 高画質ブルーレイ",
    "☀️ 赤外線カットガラス"
  ],
  "9": [
    "🏥 ハンディX線検査機"
  ],
  "10": [
    "🔬 超精密レーザーメス",
    "🧲 耐熱サマコバ磁石"
  ],
  "11": [
    "🧲 ネオジム磁石",
    "⛽ ガソリン精製触媒"
  ],
  "12": [
    "⚡ 磁歪材料"
  ],
  "13": [
    "🔋 特殊原子力電池"
  ],
  "14": [
    "🌐 超高速光通信ケーブル",
    "📡 高精度圧力センサー"
  ],
  "16": [
    "🌌 量子暗号通信ユニット"
  ],
  "18": [
    "🩺 病院のMRI造影剤"
  ],
  "20": [
    "⚛️ 原子炉制御棒"
  ],
  "22": [
    "🌀 超強力・磁力マシーン"
  ],
  "25": [
    "💻 次世代ノートパソコン"
  ],
  "28": [
    "🏎️ 耐熱ECOエンジン"
  ],
  "31": [
    "🔬 最新型PETスキャン"
  ],
  "34": [
    "🚆 超伝導リニアモーター"
  ],
  "37": [
    "💊 ナノ粒子がん治療薬"
  ],
  "39": [
    "✈️ 超軽量飛行機ボディ"
  ],
  "42": [
    "⏱️ 究極の光格子時計"
  ],
  "45": [
    "🧠 高性能AIニューラルコア"
  ],
  "48": [
    "🚀 宇宙ロケットフレーム"
  ],
  "49": [
    "☀️ 核融合炉プラズマ制御コア"
  ],
  "50": [
    "🗼 宇宙エレベーター・ナノケーブル"
  ]
};
  Object.keys(RECIPE_LV).forEach(lv => U(+lv, 'recipe-' + lv, 'factory', '🏭', '新レシピ ' + RECIPE_LV[lv].length + '種', RECIPE_LV[lv].join('、')));
  // ホーム
  function charaCount(lv) { return Math.min(17, lv < 3 ? 1 : lv < 5 ? 2 : lv < 8 ? 3 : 4 + Math.floor((lv - 8) / 3)); }
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    if (charaCount(lv) > charaCount(lv - 1)) U(lv, 'chara-' + lv, 'home', '🧑‍🔬', '新しい仲間がホームに登場', '仲間が ' + charaCount(lv) + '人 になります（全17人）');
  }
  U(3,  'home-taste', 'home', '🎨', 'ホームのテイスト変更', 'お部屋の雰囲気を着せ替えできます');
  U(5,  'home-juke',  'home', '🎵', 'ジュークボックス', 'ホームのBGMを好きな曲に変えられます');
  U(12, 'home-work',  'home', '🛠️', 'キャラクターの「おしごと」（製造）', 'ホームのキャラが製造のお手伝いをしてくれます');
  // 図鑑（zukan.html の reqLevel から生成）
  const ZUKAN_LV = {
  "2": "ランタン（別表情）、セリウム（別表情）",
  "6": "ランタン（イベント）、セリウム（イベント）、ジスプロシウム（別表情）、ホルミウム（別表情）、プロメチウム（別表情）",
  "3": "プラセオジム（別表情）、ネオジム（別表情）",
  "7": "プラセオジム（イベント）、エルビウム（別表情）、ツリウム（別表情）",
  "8": "ネオジム（イベント）、イッテルビウム（別表情）、ルテチウム（別表情）",
  "4": "サマリウム（別表情）、ユーロピウム（別表情）",
  "9": "サマリウム（イベント）、ユーロピウム（イベント）、スカンジウム（別表情）",
  "5": "ガドリニウム（別表情）、テルビウム（別表情）、イットリウム（別表情）",
  "10": "ガドリニウム（イベント）、テルビウム（イベント）、イットリウム（イベント）",
  "11": "ジスプロシウム（イベント）、ホルミウム（イベント）、プロメチウム（イベント）",
  "12": "エルビウム（イベント）、ツリウム（イベント）",
  "13": "イッテルビウム（イベント）、ルテチウム（イベント）",
  "14": "スカンジウム（イベント）"
};
  Object.keys(ZUKAN_LV).forEach(lv => U(+lv, 'zukan-' + lv, 'zukan', '📖', '図鑑に新しいイラスト', ZUKAN_LV[lv]));
  U(40, 'zukan-40', 'zukan', '🎁', 'シークレットイラストの解放条件を達成', '大好物の鉱物をプレゼントして、特別な姿を見せてもらおう');
  // 貿易（既存プレイヤーにも必ず一度お知らせする：retro）
  U(TRADE_UNLOCK_LEVEL, 'trade', 'trade', '🌐', '国際貿易公社がオープン！', '余った元素を世界のパートナーへ輸出して大きな利益に。下のメニューに「貿易」が追加されました', { hot: true, retro: true });
  UNLOCKS.sort((a, b) => a.lv - b.lv);

  // 古いセーブでも、過去に解放済みのものを一気に表示しないための初期化
  function ensureUnlockState(gs) {
    let changed = false;
    const lv = gs.level || 1;
    if (!gs.unlockSeen) {
      gs.unlockSeen = {};
      UNLOCKS.forEach(u => { if (u.lv <= lv && !u.retro) gs.unlockSeen[u.id] = true; });
      changed = true;
    }
    if (gs.celebratedLv === undefined) { gs.celebratedLv = lv; changed = true; }
    return changed;
  }

  // ───── 解放演出（レベルアップ共通モーダル）─────
  let modalEl = null, announceQueued = false, queuedFrom = null, queuedClosers = [];
  function injectStyle() {
    if (document.getElementById('re-common-style')) return;
    const st = document.createElement('style');
    st.id = 're-common-style';
    st.textContent = [
      '.re-lu-ov{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;display:flex;align-items:center;justify-content:center;',
      'padding:calc(1rem + env(safe-area-inset-top,0px)) calc(1rem + env(safe-area-inset-right,0px)) calc(1rem + env(safe-area-inset-bottom,0px)) calc(1rem + env(safe-area-inset-left,0px));',
      'background:rgba(5,8,18,.84);backdrop-filter:blur(2px);animation:reFade .2s ease-out;font-family:inherit;-webkit-user-select:none;user-select:none}',
      '.re-lu-card{position:relative;overflow:hidden;width:100%;max-width:24rem;max-height:100%;display:flex;flex-direction:column;',
      'background:linear-gradient(135deg,#16213e,#0f3460);border:3px solid #ffde59;border-radius:1.2rem;padding:1.1rem 1rem .9rem;',
      'text-align:center;color:#fff;box-shadow:0 0 30px rgba(255,222,89,.55);animation:rePop .35s cubic-bezier(.2,1.4,.4,1)}',
      '.re-lu-card.max{border-color:#ff9f43;box-shadow:0 0 40px rgba(255,159,67,.75)}',
      '.re-lu-confetti{position:absolute;top:0;left:0;right:0;height:100%;pointer-events:none;overflow:hidden}',
      '.re-lu-confetti i{position:absolute;top:-1rem;width:.45rem;height:.8rem;border-radius:.1rem;opacity:0;animation:reFall 2.4s ease-in infinite}',
      '.re-lu-emoji{font-size:2.3rem;line-height:1.1;animation:reBounce 1s ease-in-out infinite}',
      '.re-lu-title{font-size:1.15rem;font-weight:bold;color:#ffde59;letter-spacing:.05em;margin:.1rem 0}',
      '.re-lu-lv{font-size:1.6rem;font-weight:bold;color:#00fff5;margin-bottom:.5rem;text-shadow:0 0 10px rgba(0,255,245,.5)}',
      '.re-lu-sub{font-size:.78rem;color:#cbd5e1;margin-bottom:.4rem}',
      '.re-lu-list{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;text-align:left;display:flex;flex-direction:column;gap:.45rem;padding:.1rem .1rem .3rem}',
      '.re-lu-group{background:rgba(15,23,42,.7);border:1px solid rgba(0,255,245,.35);border-radius:.7rem;padding:.4rem .55rem}',
      '.re-lu-group.hot{border-color:#ffde59;background:rgba(255,222,89,.12);box-shadow:0 0 12px rgba(255,222,89,.35)}',
      '.re-lu-ghead{display:flex;align-items:center;justify-content:space-between;gap:.4rem;font-size:.8rem;font-weight:bold;color:#00fff5;margin-bottom:.2rem}',
      '.re-lu-group.hot .re-lu-ghead{color:#ffde59}',
      '.re-lu-go{background:transparent;border:1px solid #00fff5;color:#00fff5;border-radius:.8rem;font-size:.68rem;font-weight:bold;padding:.15rem .55rem;min-height:1.6rem;cursor:pointer;font-family:inherit;touch-action:manipulation;white-space:nowrap}',
      '.re-lu-go:active{transform:scale(.95)}',
      '.re-lu-item{font-size:.78rem;line-height:1.45;color:#f1f5f9;padding:.15rem 0}',
      '.re-lu-item b{display:block;color:#fff}',
      '.re-lu-item small{display:block;color:#94a3b8;font-size:.7rem}',
      '.re-lu-tag{display:inline-block;background:#ffde59;color:#0f3460;border-radius:.6rem;font-size:.6rem;font-weight:bold;padding:0 .35rem;margin-right:.3rem;vertical-align:middle}',
      '.re-lu-next{font-size:.7rem;color:#94a3b8;margin:.4rem 0 .1rem}',
      '.re-lu-btn{margin-top:.5rem;background:#00fff5;color:#0f3460;border:none;padding:.7rem 1rem;min-height:2.8rem;font-size:.95rem;font-weight:bold;border-radius:.8rem;cursor:pointer;width:100%;box-shadow:0 3px 10px rgba(0,255,245,.4);font-family:inherit;touch-action:manipulation;flex-shrink:0}',
      '.re-lu-btn:active{transform:scale(.97)}',
      '@keyframes reFade{from{opacity:0}to{opacity:1}}',
      '@keyframes rePop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}',
      '@keyframes reBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-.25rem)}}',
      '@keyframes reFall{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(24rem) rotate(540deg);opacity:0}}',
      '.re-lu-confetti i:nth-child(4n+1){background:#ffde59}.re-lu-confetti i:nth-child(4n+2){background:#00fff5}',
      '.re-lu-confetti i:nth-child(4n+3){background:#ff6b9d}.re-lu-confetti i:nth-child(4n){background:#7bed9f}',
      '@media (min-width:900px){.re-lu-card{max-width:30rem}}',
      '@media (max-height:520px){.re-lu-emoji{font-size:1.6rem}.re-lu-lv{font-size:1.2rem;margin-bottom:.2rem}.re-lu-card{padding:.7rem .8rem .6rem}.re-lu-btn{min-height:2.4rem;padding:.4rem}}',
      '@media (prefers-reduced-motion:reduce){.re-lu-card,.re-lu-ov,.re-lu-emoji{animation:none}.re-lu-confetti{display:none}}'
    ].join('');
    document.head.appendChild(st);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function currentPage() { return (location.pathname.split('/').pop() || '').replace(/\.html?$/, ''); }
  function playUnlockSe() {
    try {
      const a = document.getElementById('se-unlock') || document.getElementById('se-itemget');
      if (a) { a.currentTime = 0; a.play().catch(() => {}); }
      else { new Audio('itemget.mp3').play().catch(() => {}); }
    } catch (e) { /* noop */ }
  }
  function openModal(from, to, items, page, closers) {
    injectStyle();
    const up = to > from, isMax = up && to >= MAX_LEVEL;
    const order = ['trade', 'map', 'seisei', 'factory', 'zukan', 'home'];
    const groups = {};
    items.forEach(u => { (groups[u.cat] = groups[u.cat] || []).push(u); });
    const multi = items.some(u => u.lv !== items[0].lv);
    let list = '';
    order.forEach(cat => {
      const g = groups[cat]; if (!g) return;
      const c = CATS[cat], hot = g.some(u => u.hot);
      const go = (c.page !== page) ? '<button class="re-lu-go" data-go="' + c.page + '.html">' + esc(c.label) + 'へ ▶</button>' : '';
      list += '<div class="re-lu-group' + (hot ? ' hot' : '') + '"><div class="re-lu-ghead"><span>' + c.icon + ' ' + esc(c.label) + '</span>' + go + '</div>' +
        g.map(u => '<div class="re-lu-item"><b>' + (hot && u.hot ? '<span class="re-lu-tag">NEW</span>' : '') + (multi ? '<span class="re-lu-tag" style="background:#334155;color:#cbd5e1">Lv.' + u.lv + '</span>' : '') + esc(u.title) + '</b>' +
          (u.desc ? '<small>' + esc(u.desc) + '</small>' : '') + '</div>').join('') + '</div>';
    });
    const nxt = UNLOCKS.filter(u => u.lv > to);
    let nextTxt = '';
    if (nxt.length) {
      const nl = nxt[0].lv, same = nxt.filter(u => u.lv === nl);
      nextTxt = '次の解放は Lv.' + nl + '：' + esc(same[0].title) + (same.length > 1 ? ' ほか' : '');
    }
    let confetti = '';
    for (let i = 0; i < 16; i++) confetti += '<i style="left:' + (3 + i * 6) + '%;animation-delay:' + ((i * 0.37) % 2.2).toFixed(2) + 's"></i>';
    const ov = document.createElement('div');
    ov.className = 're-lu-ov';
    ov.innerHTML = '<div class="re-lu-card' + (isMax ? ' max' : '') + '" role="dialog" aria-modal="true"><div class="re-lu-confetti">' + confetti + '</div>' +
      '<div class="re-lu-emoji">' + (isMax ? '👑' : up ? '🎉' : '🌟') + '</div>' +
      '<div class="re-lu-title">' + (isMax ? 'MAX LEVEL 到達！' : up ? 'LEVEL UP!' : 'NEW! 新しい機能') + '</div>' +
      (up ? '<div class="re-lu-lv">Lv. ' + from + ' ➔ Lv. ' + to + '</div>' : '') +
      (items.length ? '<div class="re-lu-sub">新しく解放されたもの</div>' : '<div class="re-lu-sub">職人ランクが上がりました！</div>') +
      '<div class="re-lu-list">' + list + '</div>' +
      (nextTxt ? '<div class="re-lu-next">' + nextTxt + '</div>' : '') +
      '<button class="re-lu-btn">やったね！</button></div>';
    modalEl = ov;
    ov.addEventListener('click', e => {
      const go = e.target.closest && e.target.closest('.re-lu-go');
      if (go) { location.href = go.getAttribute('data-go'); return; }
      if (e.target.closest && e.target.closest('.re-lu-btn')) {
        ov.remove(); modalEl = null;
        closers.forEach(f => { try { f(); } catch (err) { /* noop */ } });
      }
    });
    document.body.appendChild(ov);
    playUnlockSe();
  }
  function whenIdle(busy, fn) {
    if (!busy()) { fn(); return; }
    const t = setInterval(() => { if (!document.hidden && !busy()) { clearInterval(t); fn(); } }, 600);
  }
  /**
   * レベルアップ・新機能の解放をプレイヤーに知らせる。どのページから呼んでもOK。
   * opts.fromLevel : レベルアップ前のレベル（わかる場合）
   * opts.busy      : () => true の間は表示を待つ（ミニゲーム中など）
   * opts.exclude   : そのページが独自に案内する解放ID（表示せず既読にする）
   * opts.onClose   : モーダルを閉じたあとに実行（画面遷移の前に見せたいとき）
   * opts.page      : 現在のページ名（'map' など。省略時はURLから判定）
   */
  function announceUnlocks(gs, opts) {
    opts = opts || {};
    if (!gs) { if (opts.onClose) opts.onClose(); return; }
    if (announceQueued) {
      if (opts.fromLevel != null && (queuedFrom == null || opts.fromLevel < queuedFrom)) queuedFrom = opts.fromLevel;
      if (opts.onClose) queuedClosers.push(opts.onClose);
      return;
    }
    announceQueued = true;
    queuedFrom = opts.fromLevel != null ? opts.fromLevel : null;
    queuedClosers = opts.onClose ? [opts.onClose] : [];
    whenIdle(() => !!modalEl || (opts.busy ? !!opts.busy() : false), () => {
      announceQueued = false;
      const closers = queuedClosers; queuedClosers = [];
      try {
        ensureUnlockState(gs);
        const level = gs.level || 1;
        const ex = new Set(opts.exclude || []);
        const pend = UNLOCKS.filter(u => u.lv <= level && !gs.unlockSeen[u.id]);
        pend.forEach(u => { gs.unlockSeen[u.id] = true; });
        const show = pend.filter(u => !ex.has(u.id));
        const from = Math.min(queuedFrom != null ? queuedFrom : level, gs.celebratedLv);
        gs.celebratedLv = level;
        persist(gs);
        setupTradeNav(gs);
        if (!show.length && !(level > from)) { closers.forEach(f => f()); return; }
        openModal(from, level, show, opts.page || currentPage(), closers);
      } catch (e) {
        console.warn('RE.announceUnlocks', e);
        closers.forEach(f => { try { f(); } catch (err) { /* noop */ } });
      }
    });
  }

  // ───── 下部ナビに「🌐貿易」を追加（Lv解放前は非表示）─────
  function setupTradeNav(gs) {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const unlocked = isTradeUnlocked(gs);
    let item = document.getElementById('nav-export-item');
    if (!item && unlocked) {
      const ref = Array.prototype.find.call(nav.children, k => /factory/i.test(k.getAttribute('onclick') || ''));
      if (!ref) return;
      item = ref.cloneNode(true);
      item.id = 'nav-export-item';
      item.classList.remove('active', 'on');
      item.setAttribute('onclick', "location.href='export.html'");
      item.innerHTML = ref.innerHTML.replace('🏭', '🌐').replace('工場', '貿易');
      ref.insertAdjacentElement('afterend', item);
    }
    if (item && !unlocked) item.style.display = 'none';
  }

  // ───── 共通初期化：各ページの最後に1回だけ呼ぶ ─────
  function initCommon(gs, opts) {
    opts = opts || {};
    try {
      if (syncLevel(gs)) persist(gs);          // 他ページで貯まった経験値をここで確定
      if (ensureUnlockState(gs)) persist(gs);
      setupTradeNav(gs);
      setTimeout(() => announceUnlocks(gs, opts), opts.delay != null ? opts.delay : 600);
    } catch (e) { console.warn('RE.initCommon', e); }
  }

  // ───── BGM：画面を閉じる／最小化／タブ切替で自動停止、戻ったら再開（全ページ共通）─────
  (function audioLifecycle() {
    const wasPlaying = new Set();
    function allAudios() {
      let list = Array.prototype.slice.call(document.querySelectorAll('audio'));
      document.querySelectorAll('iframe').forEach(f => {      // 深海ドリルなど、同じサイト内のiframeの音も対象
        try { list = list.concat(Array.prototype.slice.call(f.contentDocument.querySelectorAll('audio'))); } catch (e) { /* 別オリジンは触れない */ }
      });
      return list;
    }
    function pauseAll() {
      allAudios().forEach(a => {
        if (!a.paused && !a.ended) { if (a.loop) wasPlaying.add(a); a.pause(); }
      });
    }
    function resumeAll() {
      const list = Array.from(wasPlaying); wasPlaying.clear();
      list.forEach(a => {
        if (!a.isConnected) return;
        const p = a.play();
        if (p && p.catch) p.catch(() => {
          const evs = ['pointerdown', 'touchend', 'keydown'];
          const retry = () => { evs.forEach(ev => document.removeEventListener(ev, retry, true)); a.play().catch(() => {}); };
          evs.forEach(ev => document.addEventListener(ev, retry, true));
        });
      });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); else resumeAll(); });
    window.addEventListener('pagehide', pauseAll);
    window.addEventListener('pageshow', e => { if (e.persisted) resumeAll(); });
  })();

  global.RE = {
    ALL17: ALL17, ELEMENT_NAMES: ELEMENT_NAMES, AREAS: AREAS, GEM_HOME: GEM_HOME, GEM_OF: GEM_OF,
    TARGET_SHARE: TARGET_SHARE, GEM_HOME_SHARE: GEM_HOME_SHARE,
    elementWeights: elementWeights, rollElement: rollElement, rollYield: rollYield, rollGem: rollGem, gemHomeName: gemHomeName,
    syncBag: syncBag, addMud: addMud, drawFromBag: drawFromBag, composition: composition,
    expectedElements: expectedElements, recommendAreasFor: recommendAreasFor, goToAreaFor: goToAreaFor,
    areaShort: areaShort, flagHTML: flagHTML, originHTML: originHTML, areaOddsText: areaOddsText,
    TRADE_UNLOCK_LEVEL: TRADE_UNLOCK_LEVEL, MAX_LEVEL: MAX_LEVEL, isTradeUnlocked: isTradeUnlocked,
    getRequiredExp: getRequiredExp, syncLevel: syncLevel, addExp: addExp, UNLOCKS: UNLOCKS,
    announceUnlocks: announceUnlocks, setupTradeNav: setupTradeNav, initCommon: initCommon
  };
})(window);
