/*
 * foundation.js ── みんなのレアアース17元素財団（Lv50〜）イベントのデータと判定
 *
 * ・読み込み元：areaconfig.js（全ページ。Lv50以上のときだけ自動で読み込む）／foundation.html／home.html
 * ・保存先    ：gameState.foundation（財団の状態）／gameState.observatory（観測室に届いた結果・おみやげ）
 * ・数値や台詞を直すときは、このファイルの EVENTS と TIER を編集するだけで済みます
 *
 * 行動の回数＝採掘＋精製＋貿易出航（実時間ではなく回数基準）
 *   採掘…areaconfig.js の RE.addMud が数える（gameState.actCount.mine / mineBy）
 *   精製…areaconfig.js の RE.drawFromBag が数える（gameState.actCount.refine）
 *   貿易…export.html が増やす友好度（gameState.affinity）の合計
 */
(function (global) {
  'use strict';

  const SAVE_KEY = 'rareEarthGameState';
  const FOUND_LEVEL = 50;
  const GAP_ACTIONS = 2;                       // 前のイベントに答えてから、次の知らせが届くまでの最小行動回数

  const AXES = [
    { k: 'local', e: '🤝', n: '地域' }, { k: 'academic', e: '🎓', n: '学術' },
    { k: 'env', e: '🌱', n: '環境' }, { k: 'intl', e: '🌐', n: '国際' }
  ];
  // 金額の段階と結果の確率 [大成功, 成功, ほろ苦い, 想定外]（％）
  const TIER = {
    s: { n: '小', cost: 10000, w: [5, 55, 35, 5] },
    m: { n: '中', cost: 30000, w: [15, 60, 20, 5] },
    l: { n: '大', cost: 100000, w: [30, 55, 10, 5] }
  };
  const KEYS = ['great', 'good', 'bitter', 'odd'];
  const RESULT_NAME = { great: '★★★ 大成功', good: '★★ 成功', bitter: '★ ほろ苦い', odd: '？ 想定外' };
  const TB_LINE = {
    great: '「やりましたね。あなたの支援、ちゃんと届いていました。」',
    good: '「やりましたね。あなたの支援、ちゃんと届いていました。」',
    bitter: '「今回は思うようにいきませんでした。でも、ここから見えたこともあります。次に活かしましょう。」',
    odd: '「おや、思いがけない展開になりましたね。」'
  };
  const WHO = { Tb: 'テルビウム', Dy: 'ジスプロシウム', Er: 'エルビウム', Eu: 'ユウロピウム' };

  // ───── おみやげ（地震イベント）と観測室の飾り。home.html の furnitureMaster にも登録されます ─────
  const COUNTRIES = {
    indonesia: { name: 'インドネシア', flag: '🇮🇩', ev: 'E01' },
    philippines: { name: 'フィリピン', flag: '🇵🇭', ev: 'E16' },
    peru: { name: 'ペルー', flag: '🇵🇪', ev: 'E17' }
  };
  const SOUVENIRS = {
    indo_furniture5: { name: 'アジアン家具5点セット', emoji: '🛖', size: 40, bonus: 1.0, y: 90, country: 'indonesia', slot: 'great' },
    indo_bali_cat: { name: '特大バリ猫（木彫り人形）', emoji: '🐈', size: 24, bonus: 0.6, y: 90, country: 'indonesia', slot: 'good' },
    indo_mask: { name: '木彫りの顔のお面', emoji: '🎭', size: 12, bonus: 0.2, y: 60, country: 'indonesia', slot: 'bitter' },
    indo_table_set: { name: 'インドネシア料理が並ぶテーブルと椅子セット', emoji: '🍛', size: 34, bonus: 0.5, y: 92, country: 'indonesia', slot: 'odd' },
    phil_rattan5: { name: '南国リゾート風の籐家具5点セット', emoji: '🏝️', size: 40, bonus: 1.0, y: 90, country: 'philippines', slot: 'great' },
    phil_parol: { name: '特大パロール（星形のクリスマスランタン）', emoji: '⭐', size: 24, bonus: 0.6, y: 55, country: 'philippines', slot: 'good' },
    phil_tarsier: { name: '木彫りのメガネザルの置物', emoji: '🐒', size: 12, bonus: 0.2, y: 70, country: 'philippines', slot: 'bitter' },
    phil_table_set: { name: 'ハロハロとパンシットが並ぶテーブルと椅子セット', emoji: '🍧', size: 34, bonus: 0.5, y: 92, country: 'philippines', slot: 'odd' },
    peru_andes5: { name: 'アンデス風の家具5点セット', emoji: '🏔️', size: 40, bonus: 1.0, y: 90, country: 'peru', slot: 'great' },
    peru_alpaca: { name: '特大アルパカのぬいぐるみ', emoji: '🦙', size: 24, bonus: 0.6, y: 90, country: 'peru', slot: 'good' },
    peru_quena: { name: '小さなケーナ（竹の笛）', emoji: '🎶', size: 12, bonus: 0.2, y: 60, country: 'peru', slot: 'bitter' },
    peru_table_set: { name: 'セビーチェとじゃがいも料理が並ぶテーブルと椅子セット', emoji: '🍲', size: 34, bonus: 0.5, y: 92, country: 'peru', slot: 'odd' }
  };
  const DECOR = {
    obs_sunset: { name: '観測室の飾り「南鳥島の夕焼け」', emoji: '🌅', size: 30, bonus: 0.4, y: 40 },
    obs_shell: { name: '観測室の飾り「南鳥島の貝殻」', emoji: '🐚', size: 12, bonus: 0.2, y: 88 }
  };
  function itemInfo(id) { return SOUVENIRS[id] || DECOR[id] || null; }

  // ───── 小さな関数たち ─────
  const A = (o) => o;                                      // 評判の変化を読みやすく書くための印
  const hasF = (F, k) => !!(F.flags && F.flags[k]);
  const doneOK = (F, id) => !!(F.done && F.done[id]);
  const spentIn = (F, ids) => ids.some(id => F.spent && F.spent[id]);

  /* ═══════════════════════════ イベントのデータ ═══════════════════════════
   * id / title / icon / kind('quake' 前向き地震・'good' 前向き・'bad' 負の側面) / wait(結果までの行動回数)
   * cond(c)   : 知らせが届く条件。c = { lv, acts, trade, okiMine, seen, F }
   * news      : 知らせの文。[話し手, 文, (必要なフラグ)]  話し手 '' は地の文
   * opts      : [小, 中, 大] の選択肢の文（E03だけ options で個別指定）
   * results   : great / good / bitter / odd。関数にすればフラグで文が変わる
   * mods(F)   : { great:+N, bad:+N } …大成功／悪化の重み補正
   * skip      : 見送ったとき { text, axes, flags, retry:N }（retry＝N回後に半額の再提案）
   */
  const EVENTS = [];
  function E(o) { EVENTS.push(o); return o; }

  function quake(id, country, title, minOthers, newsLine, tbLine, optTexts, texts, sv) {
    return E({
      id, title, icon: '🌏', kind: 'quake', wait: 3, country,
      // 地震イベントは間をあける：地震以外のイベントが minOthers 本おわってから届く（E01は最初、E16は6本後、E17は12本後）
      cond: (c) => c.lv >= FOUND_LEVEL && Object.keys(c.F.done).filter(k => !byId(k).country).length >= minOthers,
      news: [['', newsLine], ['Tb', tbLine]], opts: optTexts,
      onSpend: (F) => { F.flags.F_AID_DONE = F.flags.F_AID_DONE || (id === 'E01'); },
      results: {
        great: { text: texts[0], axes: A({ intl: 3, local: 1 }), souvenir: sv[0], flags: [{ E01: 'F_INDO_FRIEND', E16: 'F_PHIL_FRIEND', E17: 'F_PERU_FRIEND' }[id]] },
        good: { text: texts[1], axes: A({ intl: 2 }), souvenir: sv[1] },
        bitter: { text: texts[2], axes: A({ intl: 1 }), souvenir: sv[2], flags: id === 'E01' ? ['F_AID_LEARN'] : [] },
        odd: { text: texts[3], axes: A({ intl: 2, local: 1 }), souvenir: sv[3] }
      },
      skip: { text: '数日後、復興が進むニュースが流れます。', tb: '「私たちにできること、また探しましょう」' }
    });
  }

  quake('E01', 'indonesia', '義援金（インドネシア地震）', 0,
    'インドネシアで大きな地震。多くの家が壊れ、避難所に身を寄せる人が増えています。',
    'Lv50になる前、現地で採鉱のお手伝いをしましたよね。あの人たちは、無事でしょうか…。私たちにできること、探してみませんか？',
    ['まず水と毛布を', '避難所の仮設トイレと井戸を', '学校の再建まで見すえた長期支援'],
    ['現地の学校から、子どもたちの寄せ書きが届きました。「再建した校舎の壁に、日本の友だちの名前を書いたよ」。同封の手紙で、現地の鉱山会社の社長が「スズを採るときに出る砂には、レアアースを含む鉱物がまざることがあります。いつか一緒に仕事をしましょう」と。',
     '避難所から感謝のビデオメッセージが届きました。「井戸の水で、はじめて温かいスープを作れました」',
     '道路が寸断され、物資の一部が届くのが遅れました。支援は「届け方」も大切だと知ります。',
     '混乱で義援金の一部が行方不明に。しかし現地の鉱山仲間が自力で探し出し「恩返しだ」と届けてくれました。'],
    ['indo_furniture5', 'indo_bali_cat', 'indo_mask', 'indo_table_set']);

  E({
    id: 'E02', title: '教育基金', icon: '🎓', kind: 'good', wait: 5,
    cond: (c) => doneOK(c.F, 'E01'),
    news: [['', '大学の研究室の先生から。「南鳥島の泥からレアアースを分ける研究をしている学生がいます。ところが奨学金も実験器具も足りません。未来の担い手を、いっしょに育てていただけませんか。」']],
    opts: ['奨学生1名', '奨学生3名＋実験器具', '財団名を冠した寄付講座を設立'],
    results: {
      great: { text: '第一期の奨学生が学会で最優秀発表賞。「南鳥島の泥から重レアアースを効率よく分ける新手法」の発表に、会場がどよめきました。', axes: A({ academic: 3 }), bonus: 'refine+1%' },
      good: { text: '奨学生から手紙。「顕微鏡でみる鉱物は、宝石みたいでした。将来は南鳥島の技術者になりたいです」。高専の学生チームがロボコンに出場したとの報告も。', axes: A({ academic: 2, local: 1 }) },
      bitter: { text: '優秀な卒業生が海外企業にスカウトされました（頭脳流出）。「向こうで学んだことを、いつか日本に持ち帰ります」と手紙。', axes: A({ academic: 1, intl: 1 }), flags: ['F_BRAIN_DRAIN'] },
      odd: { text: '学生の「失敗した実験」から、これまでにない磁石材料の手がかりが見つかりました。', axes: A({ academic: 2 }), flags: ['F_EDU_SEED'] }
    },
    skip: { text: '研究室がクラウドファンディングで続けるとの便りが届きました。' }
  });

  E({
    id: 'E03', title: '環境保全（具体策3種）', icon: '🌱', kind: 'good', wait: 5,
    cond: (c) => doneOK(c.F, 'E01'),
    news: [['', '環境担当から「財団の3つの環境対策案」が届きました。'],
      ['', 'A：排水処理設備と水質モニタリング（川・海）'], ['', 'B：採掘跡地の緑化（その土地に合う在来の植物を植える）'], ['', 'C：使い終わったネオジム磁石のリサイクル回収ライン']],
    options: [
      { id: 'A_s', tier: 's', cost: 10000, pick: ['A'], label: 'A 水質モニタリング（試行）' }, { id: 'A_m', tier: 'm', cost: 30000, pick: ['A'], label: 'A 水質モニタリング（本格）' },
      { id: 'B_s', tier: 's', cost: 10000, pick: ['B'], label: 'B 採掘跡地の緑化（試行）' }, { id: 'B_m', tier: 'm', cost: 30000, pick: ['B'], label: 'B 採掘跡地の緑化（本格）' },
      { id: 'C_s', tier: 's', cost: 10000, pick: ['C'], label: 'C 磁石のリサイクル（試行）' }, { id: 'C_m', tier: 'm', cost: 30000, pick: ['C'], label: 'C 磁石のリサイクル（本格）' },
      { id: 'ALL', tier: 'l', cost: 100000, pick: ['A', 'B', 'C'], label: 'A・B・Cの3つ全部' }
    ],
    onSpend: (F, opt) => { (opt.pick || []).forEach(p => { F.flags['F_ENV_' + p] = true; }); },
    results: {
      great: (F, p) => {
        const t = { A: 'モニタリングが小さな漏水を早期に見つけ、被害ゼロで修繕。漁協から「海がきれいなままでありがとう」。', B: '緑化した斜面に、渡り鳥が休むようになりました。', C: '回収した磁石から取り出した元素が、在庫に少量加わりました（ネオジム＋2、ジスプロシウム＋1）。' };
        return { text: (p.picks || ['A']).map(k => t[k]).join(' '), axes: A({ env: 3 }), give: (p.picks || []).includes('C') ? { Nd: 2, Dy: 1 } : null };
      },
      good: { text: '対策が計画どおり動き、年次報告の環境評価が上がりました。', axes: A({ env: 2 }) },
      bitter: {
        text: '調査で「想定外の影響」が見つかりました。どう扱いますか？',
        choice: [
          { label: '正直に公表する', text: '一時的に評判は下がりますが、誠実さが伝わり、あとで評価されました。', axes: A({ env: 2, local: -1, intl: 1 }) },
          { label: '小さく扱う', text: 'その場は何も変わりません。ただ、あとで問われるかもしれません。', flags: ['F_ENV_HIDDEN'] }
        ]
      },
      odd: { text: '台風でテスト区画が被害を受けましたが、対策のおかげで流出は最小限に。', axes: A({ env: 2, local: 1 }) }
    },
    skip: { text: '環境担当が少ししょんぼりしています。', flags: ['F_ENV_SKIP'] }
  });

  E({
    id: 'E04', title: '知識普及キャンペーン', icon: '📚', kind: 'good', wait: 4,
    cond: (c) => doneOK(c.F, 'E02'),
    news: [['', '科学館の学芸員さんから。「『レアアース展』を開きたいんです。でも来場者の多くは、『レアな土って、本当に珍しいの？』と思っています」']],
    tip: 'レアアースは地殻に意外と多くあります。難しいのは「分けて取り出す」こと。',
    opts: ['パンフレットと解説動画', '全国の学校への出前授業', '科学館に常設展示＋元素キャラのパネル'],
    results: {
      great: { text: '中学生の自由研究「身の回りのレアアース探し」が県の科学賞に。同級生が元素キャラへのファンレターを送ってくれました。', axes: A({ academic: 2, local: 2 }), bonus: 'zukan_special' },
      good: { text: '来場者アンケート「スマホにも入っているなんて！」。理解度が大きく上がりました。', axes: A({ academic: 1, local: 2 }) },
      bitter: { text: '報道が「夢の資源！」と盛り上がりすぎ、「南鳥島ですぐ大金持ち」という誤解も広まります。訂正の解説動画づくりを提案されました。', axes: A({ local: 1 }), flags: ['F_HYPE'] },
      odd: { text: '取材に来た記者が元素キャラの大ファンに。「推しはランタン」と大特集を組んでくれました。', axes: A({ local: 2 }) }
    },
    skip: { text: '学芸員さんが手作りの小さな展示で続けますとの便りが届きました。' }
  });

  E({
    id: 'E05', title: '国産磁石のモーター', icon: '🧲', kind: 'good', wait: 6,
    cond: (c) => c.magnet,
    news: [['', '国内メーカーのエンジニアから手紙が届きました。'],
      ['', '「南鳥島の泥から取り出した元素で磁石をつくり、モーターを回してみたいのです。材料から完成品まで国産で。夢みたいな話ですが、本気です」'],
      ['Tb', '日本の端っこの泥が、ぐるぐる回る力になるなんて…すごいですね']],
    opts: ['材料の提供', '試作モーターの製作費', '実証機（小型風力発電機やロボットの関節）まで'],
    mods: (F) => ({ great: hasF(F, 'F_EDU_SEED') ? 10 : 0 }),
    results: {
      great: { text: '国産磁石を使ったモーターが回りました。ニュース「材料から完成品まで国産、実証に成功」。風力発電の小型機とロボットの腕への採用が決まります。', axes: A({ academic: 2, intl: 1, local: 1 }), bonus: 'magnet_price+3%' },
      good: { text: '試作モーターが回転しました。「力は目標の9割。でも、回った！」エンジニアが写真を送ってくれます。', axes: A({ academic: 1, local: 1 }) },
      bitter: { text: '性能は出ましたがコストが高い。「量産にはあと3つの壁があります（材料の安定供給・コスト・検査）」。', axes: A({ academic: 1 }) },
      odd: { text: '試作の見学会に来た小学生が「ぼくも作りたい！」と目を輝かせました。', axes: A({ local: 2 }), flags: ['F_EDU_SEED'] }
    },
    skip: { text: '「また次の機会に。夢は逃げませんから」エンジニアは別の方法で進めるそうです。' }
  });

  E({
    id: 'E06', title: '島の職員への差し入れ', icon: '🏝️', kind: 'good', wait: 2,
    cond: (c) => c.okiMine >= 1,
    news: [['', '無線メール：「こちら南鳥島。補給船が少し遅れています。野菜がそろそろ底をつきそうです」']],
    tip: '南鳥島は日本の最東端の島。島の暮らしと観測を支える職員の方々が滞在しています。',
    opts: ['生鮮食品と調味料', '食品＋本・映画・通信費', 'ヘリ便の食材＋簡易温室（野菜が育つ）'],
    results: {
      great: { text: '島の夕焼けの写真と、全員の寄せ書きが届きました。「ここは日本の端っこで、世界への入口です」', axes: A({ local: 2, intl: 1 }), decor: 'obs_sunset' },
      good: { text: '「久しぶりにトマトを食べました」', axes: A({ local: 2 }) },
      bitter: { text: '船が着岸できず、荷物が3日遅れます。それでも「気持ちが何よりうれしいです」と電報が届きました。', axes: A({ local: 1 }) },
      odd: { text: '差し入れのお菓子が大人気に。お礼に、島で拾った貝殻の小箱が届きました。', axes: A({ local: 1 }), decor: 'obs_shell' }
    },
    skip: { text: '「補給船、まもなく着くそうです。ご心配なく」' }
  });

  E({
    id: 'E07', title: 'レアアース力あわせチーム（産学官の協力）', icon: '🤝', kind: 'good', wait: 6,
    cond: (c) => doneOK(c.F, 'E02') || doneOK(c.F, 'E05'),
    news: [['Tb', '大学と会社と役所が力を合わせる『レアアース力あわせチーム』ができました。難しい言葉では『産学官の協力』と言いますが、要するに、得意なことを持ち寄って、みんなで一つの仕事に取り組むチームのことです'],
      ['Tb', '文化祭を思い出してください。劇をやるなら、台本を書く人、衣装を作る人、場所を決めてくれる先生がいますよね。レアアースの仕事も同じです。大学は『調べるチーム』、会社は『作るチーム』、役所は『ルールを作って応援するチーム』。一人ではできないことも、チームなら早くできます！']],
    opts: ['みんなで集まる部屋の費用', 'チームの事務スタッフ', 'みんなで使える実験室'],
    results: {
      great: { text: 'チームの愛称が『みなみとりブルー』に決まりました！ 会社の人が『作り方』、大学の人が『調べ方』、役所の人が『お願いの出し方』を教え合って、半年かかるはずの仕事が3か月で終わりました！', axes: A({ academic: 2, intl: 1, local: 1 }) },
      good: { text: 'みんなの得意なことが分かりました。一人より、チームのほうが、ずっと楽しいです！', axes: A({ academic: 1, local: 1 }) },
      bitter: { text: '話し合いで、意見がぶつかりました。会社は『早く売りたい』、大学は『しっかり調べたい』、役所は『ルールを守ってください』。でも『目指すゴールは同じですよね』と確かめて、仲直りしました', axes: A({ academic: 1 }) },
      odd: { text: '見学に来た小学生が「泥をふるいにかけたらどう？」と言いました。やってみたら、本当に成功！', axes: A({ academic: 2, local: 1 }), flags: ['F_EDU_SEED'] }
    },
    closing: '違う得意を持つ人が集まると、一人ではできないことができるんですね',
    skip: { text: 'それぞれ、頑張ることにしました。また今度、声をかけましょう' }
  });

  E({
    id: 'E08', title: 'テルビウム＆ジスプロシウム 耐熱磁石の回', icon: '🔥', kind: 'good', wait: 6,
    cond: (c) => !!(c.seen.Tb && c.seen.Dy),
    news: [['Tb', 'こんにちは、テルビウムです。私とジスプロシウムは、いつも『あつい現場』の担当なんです'],
      ['Dy', 'ネオジム磁石は力持ちだけど、あつくなると力がぬけちゃうのが弱点でね'],
      ['Tb', 'そこで私たちの出番です。ちょっぴり混ぜると、あつい場所でも力が落ちにくくなります。電気自動車のモーターや、風力発電機でがんばっていますよ'],
      ['Dy', 'ただ、ボクたちは数が少なくて、とれる場所も限られてる。だから『使う量をへらす研究』が大事なんだ'],
      ['Tb', '南鳥島の泥には、私たちの仲間（重いレアアース）が多いかもしれないと期待されているんです']],
    opts: ['基礎実験', '試作ライン', '南鳥島の泥からTb・Dyを取り出す連続実験'],
    mods: (F) => ({ great: hasF(F, 'F_EDU_SEED') ? 10 : 0 }),
    results: {
      great: { text: '「結晶の粒のさかいめにだけ、ちょっと足す方法で、使う量は半分、耐熱性は同じ！」 Dy「ボクたち、そんなに少なくていいの!?」 Tb「でも、ゼロにはなりませんよ（笑）」', axes: A({ academic: 2, intl: 1 }), flags: ['F_HEAVY_SAVING'], bonus: 'TbDy_recipe-10%' },
      good: { text: '使用量が3割減りました。', axes: A({ academic: 1 }) },
      bitter: { text: '量は減らせましたが、完全にはゼロにできません。 Dy「やっぱりボクたちが必要なんだね」 Tb「ちょっと照れますね」', axes: A({ academic: 1 }) },
      odd: { text: '実験中、テルビウムが鮮やかな緑色に光りました。「そういえば緑に光る性質もあるんです」。新しい用途のヒントに。', axes: A({ academic: 2 }), flags: ['F_TB_GLOW'] }
    },
    skip: { text: 'Tb「またいつか、あつい現場で会いましょう」' }
  });

  E({
    id: 'E09', title: 'エルビウム 光通信の回', icon: '🌐', kind: 'good', wait: 5,
    cond: (c) => c.trade >= 1,
    news: [['Er', 'やあ、エルビウムだよ。Lv49までは、キミと世界中を飛び回ったよね。港、鉱山、空港…どの国でも、同じ話を聞いたんだ。『インターネットは、海の底を通ってくる』ってね'],
      ['', '豆知識：国と国をつなぐ通信の大部分は、海の底の光ファイバー（海底ケーブル）を通ります。光は長い距離を走るうちに弱くなるので、途中で元気にする装置が必要。ガラスにほんの少し混ぜて、弱った光を増やすのがエルビウムの役目です。'],
      ['Er', '出張で見た港には、どこにも海からケーブルが上がってくる小さな建物があったよね。あれが世界の入口なんだ。日本の端っこ、南鳥島も、海の向こうとつながる入口にしたいな']],
    opts: ['光アンプの基礎研究', '島と本土をつなぐ通信回線の強化（遠隔で実験を見守る）', 'ケーブル保守船との共同訓練＋研究'],
    results: {
      great: { text: '島の採掘試験を本土から遠隔で見守れるようになりました。 Er「ボクが見てきた世界が、島ともつながったね」', axes: A({ intl: 2, academic: 1 }), bonus: 'trend_preview' },
      good: { text: '島の通信が安定しました。', axes: A({ local: 1, intl: 1 }) },
      bitter: { text: '船のいかりでケーブルが傷つき、数日つながらなくなりました。でも復旧船が駆けつけます。 Er「世界はこうやって、誰かに守られながらつながってるんだ」', axes: A({ intl: 1 }) },
      odd: { text: '出張先で知り合った各国の友人から一斉に連絡が。「日本の財団のこと、聞いたよ！」（全パートナーの友好度が＋1）', axes: A({ intl: 2 }), affinityAll: 1 }
    },
    extra: (F, k) => ((k === 'great' || k === 'good') && F.done && F.done.E06 && (F.done.E06.result === 'great' || F.done.E06.result === 'good')) ? ' 島の職員が、家族とビデオ通話できたという話も届きました。' : '',
    skip: { text: 'Er「うん、また旅に出るときに話そう。絵はがき送るね」' }
  });

  E({
    id: 'E10', title: 'ユウロピウム 蛍光の回（時代で変わる出番）', icon: '✨', kind: 'good', wait: 4,
    cond: (c) => !!c.seen.Eu,
    news: [['Eu', 'ねえ、ボクの昔話、聞いてくれる？ 昔のテレビはブラウン管といって、あの鮮やかな赤い色を出していたのが、ボクだったんだ。テレビ屋さんの間では、スター選手だったんだよ'],
      ['Eu', 'でも液晶や有機ELの時代になって、ボクの出番は減ってしまった…。ボクの役目は、もう終わったのかな'],
      ['Tb', 'いいえ、それは違いますよ。時代によって『重宝される元素』は変わります。私たちレアアースは、使い道を変えながら生き残ってきたんです'],
      ['Eu', 'そういえば…今のボクは、照明の色をきれいに見せたり、お札のにせ札防止の仕組みや、病院の検査で小さな目印を光らせるのにも使われているんだって']],
    opts: ['ブラックライトで光る展示室', '蛍光材料の研究', 'にせ札防止・医療検査への応用研究'],
    mods: (F) => ({ great: hasF(F, 'F_TB_GLOW') ? 10 : 0 }),
    results: {
      great: { text: '展示室に行列ができました。「見て見て、光ってる！ ボク、まだ光れるんだ！」Euは大感激。', axes: A({ academic: 2, local: 2 }), bonus: 'blacklight+3/Eu_illust' },
      good: { text: '「ブラックライトの下で、ふだん見えない模様が浮かぶ」と評判に。', axes: A({ academic: 1, local: 1 }), bonus: 'blacklight+1' },
      bitter: { text: '新しい素材が登場し、用途の一部が置き換わりました。Eu「流行は変わるね」。でも別の用途を見つけて前向きに。 Tb「元素の出番は、時代といっしょに変わっていくんですね」', axes: A({ academic: 1 }) },
      odd: { text: '展示にブラウン管テレビを持ち込んだおじいさん。「このテレビの赤は、きみが光らせていたんだね」。世代を超えた交流が生まれました。', axes: A({ local: 2 }) }
    },
    skip: { text: 'Eu「いいんだ。ボクはミニゲームでも光ってるからね」' }
  });

  E({
    id: 'E11', title: 'イオン吸着型の採掘（負の側面）', icon: '💧', kind: 'bad', wait: 5,
    cond: (c) => !!((c.seen.Dy || c.seen.Tb) && c.trade >= 1),
    news: [['', 'ニュース：東南アジアの山あいの「ナム村」（架空）で、川がにごり、魚が減ったという声。上流では、あなたの輸入元の一つ「ナム村採掘組合」（架空）がイオン吸着型の採掘を行っています。'],
      ['Tb', 'イオン吸着型は、粘土にくっついたレアアースを、薬剤を含んだ液をしみ込ませて洗い出す方法です。大きな機械がいらず安く掘れるので、世界で広く使われてきました。ジスプロシウムや私（テルビウム）も、こうして採れることが多いんですよ'],
      ['Dy', '…ボクたちが必要とされる裏で、こんなことが起きていたなんて'],
      ['Dy', 'ボクたちの使う量が減ったぶん、村への負担も減らせるね', 'F_HEAVY_SAVING']],
    opts: ['第三者の水質検査', '薬剤の回収・浄化設備の支援', '村の水道整備＋手法の見直し＋南鳥島の泥の研究を加速して調達先を分散'],
    mods: (F) => ({ great: hasF(F, 'F_ENV_A') ? 10 : 0, bad: (hasF(F, 'F_ENV_SKIP') || hasF(F, 'F_ENV_HIDDEN')) ? 10 : 0 }),
    results: {
      great: { text: '川の透明度が戻り、子どもたちが水遊びを再開しました。薬剤をほぼ回収できる方式が導入されます。', axes: A({ env: 2, intl: 1, local: 1 }) },
      good: { text: '水質が基準内に。村の人から感謝の手紙が届きました。', axes: A({ env: 2 }) },
      bitter: { text: '設備は入りましたが、上流の古い採掘跡からの汚染が残っています。「元に戻すには、長い時間がかかります」という現実。', axes: A({ env: 1 }) },
      odd: { text: '近くの別の鉱山からも「うちにも導入したい」と依頼が来ました。', axes: A({ intl: 2, env: 1 }) }
    },
    skip: { text: '川の汚染が拡大したとニュースになりました。', axes: A({ env: -1, intl: -1 }), retry: 3 }
  });

  E({
    id: 'E12', title: '違法採掘品の混入（負の側面）', icon: '🔍', kind: 'bad', wait: 4,
    cond: (c) => c.trade >= 5,
    news: [['', '品質管理担当より。「受け入れたロットに、記録のない原料が混ざっています。取引先の『ブルーハーバー商会』（架空）経由のようです」'],
      ['', '調べると、許可なく掘られ、働く人の安全や環境への配慮が確認できない原料でした。'], ['Tb', '知らないうちに、そんな原料を使っていたなんて…'],
      ['', '豆知識：原料の出どころをたどれる仕組みを「トレーサビリティ」と呼びます。']],
    opts: ['全ロットの検査と記録を始める', '現地調査団を派遣', '取引先と新契約し、認証された原料へ切り替える（やや高価）'],
    skipLabel: '見送る（今回は気づかなかったことにする）',
    mods: (F) => ({ great: hasF(F, 'F_INDO_FRIEND') ? 10 : 0 }),
    results: {
      great: { text: '取引先が自ら改善し、出どころを全部記録する仕組みを導入しました。「ここのレアアースなら安心」と評判に。', axes: A({ intl: 2, local: 1 }), bonus: 'trade_price+3%' },
      good: { text: '混入ルートを特定し、是正しました。', axes: A({ intl: 1 }) },
      bitter: { text: '供給が一時的に不足し、納期が遅れます（元素の入荷が少し減る）。でも信頼は守れました。', axes: A({ intl: 1 }) },
      odd: { text: '取引先の従業員が内部の問題を知らせてくれました。別の取引先の問題も見つかり、業界団体に参加することに。', axes: A({ intl: 2, academic: 1 }) }
    },
    skip: { text: '数か月後、同じ原料が問題になったニュースで財団名が出てしまいました。', axes: A({ intl: -2 }), retry: 3 }
  });

  E({
    id: 'E13', title: '輸出規制で価格急騰（負の側面）', icon: '📈', kind: 'bad', wait: 5,
    cond: (c) => c.trade >= 10,
    news: [['', 'ニュース速報：「ある資源大国が、レアアースの輸出に新しい規制を発表。世界の相場が急騰しています」'],
      ['Tb', 'いまなら高く売れます…でも、国内のメーカーさんは部品の材料がなくて困っているようです'],
      ['', '豆知識：供給が1つの国に集中していると、その国の決定ひとつで世界の価格が大きく動きます。だから「いろいろな場所から手に入れる」ことが大切です。']],
    opts: ['情報収集・相場分析チーム（値動きのヒントが届く）', '国内メーカー向けの緊急備蓄基金', '備蓄基金＋新しい調達先の開拓＋使用量削減研究への助成'],
    skipLabel: '見送る（相場をそのまま活かして売る）',
    mods: (F) => ({ great: hasF(F, 'F_BRAIN_DRAIN') ? 10 : 0 }),
    results: {
      great: (F) => ({ text: '規制が緩和され相場が落ち着く頃、備蓄のおかげで国内メーカーは生産を止めずにすみました。感謝状「財団のおかげで、工場の火を消さずにすみました」。' + (hasF(F, 'F_BRAIN_DRAIN') ? ' 海外の人脈から、代わりの調達先も見つかりました。' : ''), axes: A(hasF(F, 'F_BRAIN_DRAIN') ? { local: 2, intl: 2 } : { local: 2, intl: 1 }) }),
      good: { text: '備蓄が役立ち、混乱は最小限に。', axes: A({ local: 1, intl: 1 }) },
      bitter: { text: '規制緩和で相場が急落し、備蓄の評価が目減りしました。でもメーカーから「備えがあってよかった」の一言。', axes: A({ local: 1 }) },
      odd: (F) => hasF(F, 'F_HYPE')
        ? { text: '値動きの報道が過熱し、一部で買い占めが起きます。財団の声明は届かず、混乱が広がってしまいました。', axes: A({ local: -1 }) }
        : { text: '値動きの報道が過熱し、一部で買い占めが起きます。財団が冷静な声明を出して、沈静化しました。', axes: A({ local: 1 }) }
    },
    skip: { text: '相場の高騰の恩恵はそのまま受けられます。ただ、国内メーカーから「もう少し考えてほしかった」という声が届きました。', axes: A({ local: -1 }), retry: 3 }
  });

  E({
    id: 'E14', title: '深海生態系への懸念（負の側面）', icon: '🐟', kind: 'bad', wait: 6,
    cond: (c) => c.okiMine >= 3,
    news: [['', '環境団体と漁業者の連名で、要望書が届きました。'],
      ['', '「南鳥島の海底の泥を吸い上げると、泥の煙（プルーム）が広がるかもしれません。水深5,000mを超える深海は、ゆっくり育つ生き物の世界で、まだ分かっていないことが多いのです」'],
      ['Tb', '夢の資源だからこそ、海のことを先に知っておきたいですね'],
      ['', '（過去の調査結果の扱いについても、問い合わせが届いています）', 'F_ENV_HIDDEN']],
    opts: ['公開説明会（漁業者・市民・研究者）', '海洋生物の事前調査（ベースライン調査）', '泥煙の広がりの実験＋第三者委員会（環境団体も参加）'],
    mods: (F) => ({ great: (hasF(F, 'F_ENV_A') || hasF(F, 'F_ENV_B') || hasF(F, 'F_ENV_C')) ? 10 : 0, bad: (hasF(F, 'F_ENV_HIDDEN') || hasF(F, 'F_ENV_SKIP')) ? 10 : 0 }),
    results: {
      great: { text: '調査で泥煙の広がりが想定より狭いと分かり、継続的な監視体制ができました。環境団体も委員会に参加。「夢の資源が、社会に認められた日」。', axes: A({ env: 3, intl: 1 }), bonus: 'oki_dig+1' },
      good: { text: '調査中に深海のめずらしい生き物を見つけ、記録が増えました。', axes: A({ env: 2, academic: 1 }) },
      bitter: { text: '調査で「影響が出る可能性が残る」と分かり、試験を縮小・延期しました。 Tb「夢の資源にも、ゆっくり進める勇気が必要なんですね」', axes: A({ env: 2 }) },
      odd: { text: '地元の漁師さんが調査船の乗組員として協力してくれました。「海のことは、俺たちが一番知ってる」。', axes: A({ local: 2, env: 1 }) }
    },
    skip: { text: '要望書が報道され、試験が一時凍結されました。', axes: A({ env: -2, local: -1 }), retry: 3 }
  });

  E({
    id: 'E15', title: '寄付金の不祥事（負の側面）', icon: '📰', kind: 'bad', wait: 4,
    cond: (c) => doneOK(c.F, 'E01') && spentIn(c.F, ['E01', 'E02', 'E04']),
    news: [['', 'ニュース：「財団が寄付金を届ける際に使った団体の一つ『みらいこどもネット』（架空）で、寄付金の一部が不適切に使われていた疑い」。財団にも問い合わせの電話が鳴りはじめました。'],
      ['Tb', 'みんなの気持ちを預かっています。ちゃんと向き合いましょう']],
    opts: ['声明を出し、団体に説明を求める', '第三者による監査（費用は財団負担）', '被害を受けた事業の肩代わり＋寄付先の審査制度づくり'],
    mods: (F) => ({ great: hasF(F, 'F_AID_DONE') ? 10 : 0 }),
    results: {
      great: { text: '監査で財団の寄付分は適正と確認されました。審査基準を公開し、「お金の流れが見える財団」と評判に。称号「透明な財団」を手に入れました。', axes: A({ local: 2, intl: 1, academic: 1 }), title: '透明な財団' },
      good: { text: '財団分に問題なし。団体は再発防止策を発表しました。', axes: A({ local: 1, intl: 1 }) },
      bitter: { text: '監査で、財団側の小さな管理ミス（領収書の保存漏れなど）が見つかりました。「悪意はないが、チェックが甘かった」。すぐ改善します。', axes: A({ local: 1 }) },
      odd: { text: '厳しい監査の様子を知った別の団体から「うちも見てほしい」と相談が来ました。新しい寄付先の候補が増えます。', axes: A({ local: 2 }) }
    },
    closing: 'お金を出すだけでなく、どう使われたかまで見届けるのが、本当の応援なんですね',
    skip: { text: '問い合わせが殺到し、財団の評判が落ちてしまいました。', axes: A({ local: -2, intl: -1 }), retry: 2 }
  });

  quake('E16', 'philippines', '義援金（フィリピン地震）', 6,
    'フィリピンで大きな地震。多くの家が壊れ、避難所に身を寄せる人が増えています。',
    '日本とフィリピンは、これまでも助け合ってきた国です。私たちにできること、探してみませんか？',
    ['まず飲み水と簡易ベッドを', '避難所の仮設トイレと給水設備を', '学校の再建まで見すえた長期支援'],
    ['現地の学校から、子どもたちの寄せ書きが届きました。「再建した校舎の壁に、日本の友だちの名前を書いたよ」。同封の手紙には、地元の漁協の人から「いつか一緒に何かできたらうれしい」という言葉が。',
     '避難所から感謝のビデオメッセージが届きました。「きれいな水で、子どもたちが顔を洗って笑っています」',
     '島どうしを結ぶ船が出せず、物資の一部が届くのが遅れました。支援は「届け方」も大切だと知ります。',
     '混乱で義援金の一部の行き先がわからなくなりましたが、地元のボランティアが一軒ずつ探して届けてくれました。お礼に、みんなでハロハロとパンシットをふるまってくれました。'],
    ['phil_rattan5', 'phil_parol', 'phil_tarsier', 'phil_table_set']);

  quake('E17', 'peru', '義援金（ペルー地震）', 12,
    'ペルーで大きな地震。山あいの村で家が壊れ、避難所に身を寄せる人が増えています。',
    'ペルーには、日本にルーツを持つ人もたくさん暮らしています。私たちにできること、探してみませんか？',
    ['まず水と毛布を（山の夜は冷えます）', '避難所の仮設トイレと井戸を', '学校の再建まで見すえた長期支援'],
    ['現地の学校から、子どもたちの寄せ書きが届きました。「再建した校舎の壁に、日本の友だちの名前を書いたよ」。同封の手紙には、日本にルーツを持つ地元の先生から「遠くから助けてくれて、ありがとう」という言葉が。',
     '避難所から感謝のビデオメッセージが届きました。「毛布のおかげで、寒い夜も家族みんなで眠れました」',
     '山道が崩れて、物資の一部が届くのが遅れました。支援は「届け方」も大切だと知ります。',
     '混乱で義援金の一部の行き先がわからなくなりましたが、村の人たちが山道を歩いて探し出し、届けてくれました。お礼に、みんなでセビーチェとじゃがいも料理をふるまってくれました。'],
    ['peru_andes5', 'peru_alpaca', 'peru_quena', 'peru_table_set']);

  // 標準の出す順番（前向きと負の側面を織り交ぜる。条件を満たさないものは飛ばして次を先に出す）
  const ORDER = ['E01', 'E02', 'E03', 'E15', 'E04', 'E05', 'E12', 'E16', 'E06', 'E08', 'E11', 'E07', 'E09', 'E13', 'E17', 'E14', 'E10'];
  const byId = (id) => EVENTS.find(e => e.id === id);

  // ───── 保存まわり ─────
  function persist(gs) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(gs)); } catch (e) { /* noop */ } }
  function loadGS() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function ensure(gs) {
    const F = gs.foundation || (gs.foundation = {});
    F.axes = F.axes || { local: 0, academic: 0, env: 0, intl: 0 };
    ['flags', 'done', 'spent', 'seen', 'bonuses'].forEach(k => { F[k] = F[k] || {}; });
    ['pending', 'reports', 'retries', 'titles', 'log'].forEach(k => { F[k] = F[k] || []; });
    if (F.open === undefined) F.open = null;
    if (F.lastAnswer === undefined) F.lastAnswer = -99;
    const O = gs.observatory || (gs.observatory = {});
    O.unread = O.unread || []; O.souvenirs = O.souvenirs || []; O.decor = O.decor || [];
    if (O.silhouettes === undefined) O.silhouettes = true;
    return F;
  }
  // ───── 行動の回数 ─────
  function tradeCount(gs) { const a = gs.affinity || {}; return Object.keys(a).reduce((s, k) => s + (a[k] || 0), 0); }
  function acts(gs) { const c = gs.actCount || {}; return (c.mine || 0) + (c.refine || 0) + tradeCount(gs); }
  function hasMagnet(gs) {
    const p = gs.products || {}, c = gs.crafted || {};
    return Object.keys(p).some(k => /magnet/i.test(k) && p[k] > 0) || Object.keys(c).some(k => /magnet/i.test(k) && c[k]);
  }
  function ctxOf(gs, F) {
    return { lv: gs.level || 1, acts: acts(gs), trade: tradeCount(gs), okiMine: ((gs.actCount || {}).mineBy || {}).okinotori || 0, seen: F.seen, magnet: hasMagnet(gs), F: F };
  }
  function updateSeen(gs, F) { const el = gs.elements || {}; Object.keys(el).forEach(k => { if (el[k] > 0) F.seen[k] = true; }); }

  // ───── 結果の抽選 ─────
  let rand = Math.random;
  function weights(ev, tier, F) {
    const w = TIER[tier].w.slice(), m = (ev.mods && ev.mods(F)) || {};
    if (m.great) { w[0] += m.great; w[1] -= m.great; }
    if (m.bad) { w[2] += m.bad; w[1] -= m.bad; }
    return w.map(x => Math.max(0, x));
  }
  function pickKey(w) {
    const sum = w.reduce((a, b) => a + b, 0); let r = rand() * sum;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return KEYS[i]; }
    return KEYS[1];
  }
  function optionsFor(ev, retry) {
    const base = ev.options ? ev.options : ['s', 'm', 'l'].map((t, i) => ({ id: t, tier: t, cost: TIER[t].cost, label: ev.opts[i] }));
    const list = base.map(o => Object.assign({}, o, { cost: retry ? Math.ceil(o.cost / 2) : o.cost }));
    list.push({ id: 'skip', tier: null, cost: 0, label: ev.skipLabel || '見送る' });
    return list;
  }
  function applyAxes(F, axes) { Object.keys(axes || {}).forEach(k => { F.axes[k] = (F.axes[k] || 0) + axes[k]; }); }
  function applyFlags(F, flags) { (flags || []).forEach(f => { if (f) F.flags[f] = true; }); }

  // ───── 知らせを出す・見送る・支出する ─────
  function nextOffer(gs, F) {
    if (F.open) return false;
    const a = acts(gs);
    if (a - F.lastAnswer < GAP_ACTIONS) return false;
    const due = F.retries.findIndex(r => r.at <= a);
    if (due >= 0) { const r = F.retries.splice(due, 1)[0]; F.open = { id: r.id, retry: true, since: a }; return true; }
    const c = ctxOf(gs, F);
    for (const id of ORDER) {
      if (F.done[id] || F.pending.some(p => p.id === id) || F.retries.some(r => r.id === id)) continue;
      if (byId(id).cond(c)) { F.open = { id: id, retry: false, since: a }; return true; }
    }
    return false;
  }
  function spend(gs, optId) {
    const F = ensure(gs), o = F.open; if (!o) return { ok: false, msg: 'いま届いている知らせはありません' };
    const ev = byId(o.id), opt = optionsFor(ev, o.retry).find(x => x.id === optId);
    if (!opt) return { ok: false, msg: '選択肢が見つかりません' };
    const a = acts(gs);
    if (opt.id === 'skip') {
      const s = ev.skip || {};
      applyAxes(F, s.axes); applyFlags(F, s.flags);
      if (s.retry && !o.retry) { F.retries.push({ id: ev.id, at: a + s.retry }); F.done[ev.id] = { skipped: true, retryPending: true }; }
      else F.done[ev.id] = { skipped: true };
      F.log.push({ id: ev.id, at: a, skipped: true }); F.open = null; F.lastAnswer = a;
      persist(gs); return { ok: true, skipped: true, text: s.text || '', tb: s.tb || '', axes: s.axes || {}, retry: !!(s.retry && !o.retry) };
    }
    if ((gs.money || 0) < opt.cost) return { ok: false, msg: '所持金が足りません' };
    gs.money -= opt.cost;
    F.spent[ev.id] = true;
    if (ev.onSpend) ev.onSpend(F, opt);
    F.pending.push({ id: ev.id, opt: opt.id, tier: opt.tier, cost: opt.cost, due: a + ev.wait, retry: !!o.retry, picks: opt.pick || null });
    F.open = null; F.lastAnswer = a;
    persist(gs); return { ok: true, wait: ev.wait };
  }
  function resolve(gs, F, p) {
    const ev = byId(p.id), key = pickKey(weights(ev, p.tier, F));
    let r = ev.results[key]; if (typeof r === 'function') r = r(F, p);
    let text = r.text + (ev.extra ? ev.extra(F, key) : '');
    F.ridSeq = (F.ridSeq || 0) + 1;
    const rep = { rid: 'r' + F.ridSeq + '_' + Date.now().toString(36), id: ev.id, title: ev.title, icon: ev.icon, tier: p.tier, result: key,
      text: text, axes: r.axes || {}, souvenir: r.souvenir || null, decor: r.decor || null, choice: r.choice || null, title2: r.title || null, closing: ev.closing || '', read: false, at: acts(gs) };
    if (!r.choice) { applyAxes(F, r.axes); applyFlags(F, r.flags); }
    if (r.title && !F.titles.includes(r.title)) F.titles.push(r.title);
    if (r.bonus) F.bonuses[r.bonus] = true;
    if (r.give) { gs.elements = gs.elements || {}; Object.keys(r.give).forEach(k => { gs.elements[k] = (gs.elements[k] || 0) + r.give[k]; }); }
    if (r.affinityAll) { gs.affinity = gs.affinity || {}; ['us', 'eu', 'asia'].forEach(k => { gs.affinity[k] = (gs.affinity[k] || 0) + r.affinityAll; }); }
    F.done[ev.id] = { result: key, tier: p.tier, opt: p.opt, retry: !!p.retry };
    F.reports.push(rep); gs.observatory.unread.push(rep.rid);
    F.log.push({ id: ev.id, at: acts(gs), result: key });
    return rep;
  }
  // 行動が進んだとき（各ページの読み込み時）に呼ぶ。新しい結果／知らせが届いたかを返す
  function tick(gs, opt) {
    opt = opt || {};
    if (!opt.force && (gs.level || 1) < FOUND_LEVEL) return {};
    const F = ensure(gs), before = F.reports.length;
    updateSeen(gs, F);
    const a = acts(gs), due = F.pending.filter(p => p.due <= a);
    due.forEach(p => resolve(gs, F, p));
    F.pending = F.pending.filter(p => p.due > a);
    const offer = nextOffer(gs, F);
    persist(gs);
    return { newResults: F.reports.length - before, newOffer: offer };
  }
  // 観測室で結果を受け取る（おみやげ／飾りを家具として持ち物に追加）
  function claim(gs, rid, choiceIdx) {
    const F = ensure(gs), O = gs.observatory, rep = F.reports.find(r => r.rid === rid);
    if (!rep || rep.read) return { ok: false };
    if (rep.choice) {
      if (choiceIdx == null) return { ok: false, needChoice: true };
      const c = rep.choice[choiceIdx]; applyAxes(F, c.axes); applyFlags(F, c.flags);
      rep.chosen = choiceIdx; rep.axes = Object.assign({}, rep.axes, c.axes || {}); rep.text += '\n' + c.text;
    }
    rep.read = true; O.unread = O.unread.filter(x => x !== rid);
    const got = [];
    [rep.souvenir, rep.decor].forEach(id => {
      if (!id) return;
      if (!O.souvenirs.includes(id)) O.souvenirs.push(id);
      gs.homeFurnishings = gs.homeFurnishings || [];
      if (!gs.homeFurnishings.includes(id)) { gs.homeFurnishings.push(id); gs.newFurn = Array.isArray(gs.newFurn) ? gs.newFurn : []; gs.newFurn.push(id); }
      got.push(id);
    });
    persist(gs); return { ok: true, items: got };
  }
  // おみやげ棚の表示用データ（国ごとに4枠。届かなかった枠はシルエット）
  function shelf(gs) {
    const F = ensure(gs), O = gs.observatory;
    return Object.keys(COUNTRIES).map(cid => {
      const c = COUNTRIES[cid], d = F.done[c.ev];
      const slots = KEYS.map(k => {
        const id = Object.keys(SOUVENIRS).find(s => SOUVENIRS[s].country === cid && SOUVENIRS[s].slot === k);
        return { slot: k, id: id, got: O.souvenirs.includes(id) };
      });
      return { cid: cid, name: c.name, flag: c.flag, state: !d ? 'wait' : d.skipped ? 'skipped' : 'done', slots: slots };
    });
  }

  // ───── 通知（どのページでも小さく出す。画面は止めない）─────
  function notify(kind) {
    try {
      if (document.getElementById('fd-toast')) return;
      const st = document.createElement('style');
      st.textContent = '#fd-toast{position:fixed;left:50%;bottom:calc(5.5rem + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9000;max-width:92vw;display:flex;align-items:center;gap:.5rem;' +
        'background:#14301c;color:#e9ffe9;border:2px solid #a8e6a1;border-radius:2rem;padding:.45rem .9rem;font-size:.78rem;font-weight:bold;box-shadow:0 0 14px rgba(168,230,161,.55);cursor:pointer;font-family:inherit;animation:fdPop .35s ease-out}' +
        '#fd-toast .dot{width:.6rem;height:.6rem;border-radius:50%;background:#a8e6a1;flex-shrink:0}#fd-toast button{background:#a8e6a1;color:#14301c;border:none;border-radius:1rem;padding:.2rem .6rem;font-weight:bold;font-size:.7rem;font-family:inherit;cursor:pointer}' +
        '@keyframes fdPop{0%{transform:translateX(-50%) scaleY(.5);opacity:0}60%{transform:translateX(-50%) scaleY(1.2)}100%{transform:translateX(-50%) scaleY(1);opacity:1}}';
      document.head.appendChild(st);
      const t = document.createElement('div'); t.id = 'fd-toast';
      t.innerHTML = '<span class="dot"></span><span>' + (kind === 'result' ? '観測室に新しい結果が届いています' : '財団に新しい知らせが届いています') + '</span><button>観測室へ</button>';
      t.onclick = () => { location.href = 'home.html#obs'; };
      document.body.appendChild(t);
      setTimeout(() => { if (t.parentNode) t.remove(); }, 7000);
    } catch (e) { /* noop */ }
  }

  global.FD = {
    EVENTS: EVENTS, ORDER: ORDER, AXES: AXES, TIER: TIER, KEYS: KEYS, RESULT_NAME: RESULT_NAME, TB_LINE: TB_LINE, WHO: WHO,
    SOUVENIRS: SOUVENIRS, DECOR: DECOR, COUNTRIES: COUNTRIES, FOUND_LEVEL: FOUND_LEVEL,
    byId: byId, itemInfo: itemInfo, ensure: ensure, acts: acts, tradeCount: tradeCount, optionsFor: optionsFor, weights: weights,
    tick: tick, spend: spend, claim: claim, shelf: shelf, notify: notify, persist: persist, loadGS: loadGS,
    _setRand: (f) => { rand = f || Math.random; }
  };
})(window);
