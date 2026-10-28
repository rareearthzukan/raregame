/*
 * areaconfig.js  ── 産地（採掘エリア）設定の共通ファイル
 * map.html / mine.html / seisei.html から読み込みます（factory.html / zukan.html からも使えます）。
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
    // 沖ノ鳥島：全17元素が均等（重希土類もPm・Tmも出やすい）
    okinotori: { name: '沖ノ鳥島沖',               short: '沖ノ鳥島',     flagImg: 'hata_jp.png',         color: '#ffffff', cost: 500, yield: [7, 13], gemRate: 0.03, targets: ALL17, uniform: true }
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
    const pool = gems.filter(g => g.id !== PRISM_ID);   // プリズム鉱は沖ノ鳥島でだけ出る
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

  global.RE = {
    ALL17: ALL17, ELEMENT_NAMES: ELEMENT_NAMES, AREAS: AREAS, GEM_HOME: GEM_HOME, GEM_OF: GEM_OF,
    TARGET_SHARE: TARGET_SHARE, GEM_HOME_SHARE: GEM_HOME_SHARE,
    elementWeights: elementWeights, rollElement: rollElement, rollYield: rollYield, rollGem: rollGem, gemHomeName: gemHomeName,
    syncBag: syncBag, addMud: addMud, drawFromBag: drawFromBag, composition: composition,
    expectedElements: expectedElements, recommendAreasFor: recommendAreasFor, goToAreaFor: goToAreaFor,
    areaShort: areaShort, flagHTML: flagHTML, originHTML: originHTML, areaOddsText: areaOddsText
  };
})(window);
