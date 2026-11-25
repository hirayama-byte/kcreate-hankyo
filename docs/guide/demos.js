// node docs/guide/demos.js — 使い方ガイドの「動きで見る」用: 写真（img/demo-*.png）を撮り、押す場所を実際の画面の部品から測って demos.json に書く
// 座標は手で打たない（画面を直したら、これを実行 → node docs/guide/build-demos.js で index.html に反映 → verify-demos.js で確認）
// PW=<npx の playwright の場所> node docs/guide/demos.js [demo-id ...]   … id を付けるとその分だけ撮り直す
// 写真は架空のデータ（店名・人名・メールはすべて架空）。本物の gas-admin / gas-api の Code.gs を、偽スプレッドシート（test/env.js）の上で
// このファイルの中の小さなサーバー（ポート 8831。test/serve.js の 8820 とぶつからない）で動かして撮る。ガイドは公開なので本物の名前は出さない
var pw = require(process.env.PW || 'playwright'), path = require('path'), fs = require('fs'), http = require('http');
var ROOT = path.join(__dirname, '../..'), OUT = path.join(__dirname, 'img'), JSON_OUT = path.join(__dirname, 'demos.json');
var PORT = 8831, BASE = 'http://localhost:' + PORT + '/';
var E = require(path.join(ROOT, 'test/env.js'));
var r1 = function (v) { return Math.round(v * 10) / 10; };
fs.mkdirSync(OUT, { recursive: true });

// ---------- 架空のデータ ----------
var PEOPLE = [['mihon@example.jp', '見本 花子'], ['tanaka@example.jp', '田中 一郎'], ['suzuki@example.jp', '鈴木 美咲'], ['sato@example.jp', '佐藤 健太']];
var ME = PEOPLE[0][0]; // 写真は「見本 花子」（メンバー）として撮る
// [掲載名, 反響, 具体的な反響, 費用感, 理由, 要望, 担当(PEOPLE の番号・-1=担当なし・'via'=田中さんの専用アンケートから), [ジャンル, 掲載号, 媒体, サイズ, 料金], 回答日時]
var ROWS = [
  ['和菓子 つきみ', 4, '贈答用の注文が増えた', 4, '', '年末号にも出したい', -1, null, '2026-11-21 10:12'],
  ['ほっと訪問介護', 2, '反響はほとんどなかった', 2, '費用的に高く感じた', '', -1, null, '2026-11-20 15:40'],
  ['ペットサロン わんこ堂', 4, '新規のトリミング予約が6件', 4, 'ちょうどよい価格', 'エリアを広げていきたい', -1, null, '2026-11-20 09:05'],
  ['焼肉 炎家', 5, '予約の電話が倍になった', 4, '価格以上の反響があった', '次回も掲載したい', 'via', ['グルメ', '2026-11', '一宮', '1/4P FO', 25000], '2026-11-19 19:48'],
  ['ベーカリー 小麦の丘', 4, 'クーポン持参が15件', 4, 'ちょうどよい', '', 0, ['', '', '', '', ''], '2026-11-19 17:22'],
  ['フィットネス ボルト', 5, '体験申し込みが20件、そのうち8件入会', 5, '費用以上の効果があった', '毎月出したい', 0, ['トータルケア', '2026-11', '一宮', '1/2P FO', 60000], '2026-11-19 11:30'],
  ['英会話 スマイル', 3, '問い合わせが2〜3件', 3, '', '春にもう一度出したい', 0, ['スクール', '2026-10', '', '', ''], '2026-11-18 14:02'],
  ['〇〇整骨院', 5, '掲載後1か月で新規の予約が12件ありました。冊子を見たという方が多かったです。', 4, '費用対効果満足度が得られた', '次回も掲載したい', 0, ['クリニック', '2026-10', '一宮', '1/4P AD', 30000], '2026-11-17 10:48'],
  ['カフェ こもれび', 4, '来店が増えた。クーポン利用が8件。', 3, '反響はあったが費用的には少し高く感じた', 'エリアを広げていきたい', 1, ['グルメ', '2026-10', '江南', '1/8P FO', 15000], '2026-11-16 13:25'],
  ['ひまわり学習塾', 3, '問い合わせが2件', 2, '時期が合わなかった', '春の募集時期にもう一度相談したい', 2, ['スクール', '2026-09', '一宮', '1/6P FO', 20000], '2026-11-14 16:10'],
  ['ヘアサロン ルーム', 5, '20代の新規客が5人増えた', 5, '想像以上の反響だった', 'HPやAIについても相談したい', 3, ['ショップ', '2026-11', '岩倉', '1/4P FO', 25000], '2026-11-13 11:02'],
  ['みどり歯科クリニック', 5, '新規の患者さんが月10人ほど増えた', 4, '費用対効果に満足', '次回は1/2ページで相談したい', 1, ['クリニック', '2026-09', '一宮', '1/2P AD', 80000], '2026-11-12 09:40'],
  ['さくら司法書士事務所', 3, '相談が1件', 3, '', '相続特集があればまた出したい', 2, ['終活・士業', '2026-10', '清須', '1/4P FO', 25000], '2026-11-10 15:55'],
  ['ラーメン 一心', 4, '新規のお客さまが8件増えた', 4, '価格以上の反響があった', '次回も掲載したい', 0, ['グルメ', '2026-09', '江南', '1/6P FO', 18000], '2026-11-08 12:30'],
  ['リフォーム工房 あおい', 2, '問い合わせは0件だった', 1, '高く感じた', '内容を変えてもう一度考えたい', 3, ['暮らし', '2026-09', '津島', '1/4P AD', 35000], '2026-11-06 10:05'],
  ['花屋 はなまる', 4, 'クーポン持参が20件以上あった', 3, 'もう少し安いと続けやすい', '季節ごとに出したい', 1, ['ショップ', '2026-08', '一宮', '1/8P FO', 12000], '2026-11-04 17:45'],
  ['デイサービス ひだまり', 3, '見学の問い合わせが3件', 3, '', '求人でも使いたい', 2, ['介護・福祉', '2026-08', '岩倉', '1/4P FO', 25000], '2026-11-02 14:20']
];
function makeWorld() {
  var t = E.make({ members: PEOPLE });
  t.as(ME).init(); // シートを用意
  var tf = t.as(PEOPLE[1][0]).createMyForm(); // 田中さんの専用アンケート（「専用」の印を見せる用）
  ROWS.forEach(function (x) { var r = t.submit({ keisai: x[0], sat_hankyo: x[1], hankyo: x[2], sat_cost: x[3], riyu: x[4], youbou: x[5], t: x[6] === 'via' ? tf.token : '' }); if (!r.ok) throw new Error('seed ' + JSON.stringify(r)); });
  var sh = t.sheet().getSheetByName('responses'), n = sh.getLastRow();
  for (var i = 2; i <= n; i++) { var k = String(sh.getRange(i, 3).getValue()), x = ROWS.filter(function (y) { return y[0] === k; })[0]; sh.getRange(i, 2).setValue(x[8]); }
  var rows = t.as(ME).listRows();
  ROWS.forEach(function (x) {
    var r = rows.filter(function (o) { return o.keisai === x[0]; })[0], s = x[7];
    if (x[6] === 'via') { t.as(PEOPLE[1][0]).saveSales(r.id, { genre: s[0], month: s[1], media: s[2], size: s[3], price: s[4] }); return; }
    if (x[6] < 0) return;
    var who = t.as(PEOPLE[x[6]][0]); who.claim(r.id);
    if (s) who.saveSales(r.id, { genre: s[0], month: s[1], media: s[2], size: s[3], price: s[4] });
  });
  return t;
}

// ---------- 撮影用のサーバー（test/serve.js と同じつなぎ方） ----------
var world = makeWorld();
var SHIM = '<script>window.google={script:{run:(function mk(ok,ng){return new Proxy({},{get:function(_,fn){'
  + 'if(fn==="withSuccessHandler")return function(f){return mk(f,ng);};if(fn==="withFailureHandler")return function(f){return mk(ok,f);};'
  + 'return function(){var a=[].slice.call(arguments);fetch("/rpc/"+fn+location.search,{method:"POST",body:JSON.stringify(a)}).then(function(r){return r.json();}).then(function(j){if(j.error){ng&&ng(new Error(j.error));}else{ok&&ok(j.result);}});};}});})()}};</script>';
var server = http.createServer(function (req, res) {
  var u = new URL(req.url, 'http://x'), body = '';
  req.on('data', function (c) { body += c; });
  req.on('end', function () {
    try {
      if (u.pathname === '/api' && req.method === 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(world.post(JSON.parse(body)))); }
      if (u.pathname.indexOf('/rpc/') === 0) {
        var fn = u.pathname.slice(5), ctx = world.as(u.searchParams.get('as') || ME), out;
        try { out = { result: JSON.parse(JSON.stringify(ctx[fn].apply(null, JSON.parse(body || '[]')))) }; } catch (e) { out = { error: e.message }; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out));
      }
      if (u.pathname === '/admin/') {
        var h = fs.readFileSync(path.join(ROOT, 'gas-admin/index.html'), 'utf8').replace('<script src="https://cdnjs', SHIM + '<script src="https://cdnjs');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(h);
      }
      if (u.pathname === '/form/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end("window.API_URL='/api';"); }
      if (u.pathname === '/form/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, 'docs/index.html'))); }
      res.writeHead(404); res.end('not found');
    } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
  });
});

// ---------- 共通 ----------
var errors = [];
async function openAdmin(b, o) {
  o = o || {};
  var ctx = await b.newContext({ viewport: { width: o.w || 1280, height: o.h || 820 }, deviceScaleFactor: 1 });
  var view = o.view || 'table';
  await ctx.addInitScript(function (v) { try { localStorage.setItem('hankyo-view2', v); } catch (x) {} }, view);
  var p = await ctx.newPage();
  p.on('pageerror', function (e) { errors.push(String(e)); console.error('pageerror', e); });
  p.on('dialog', function (d) { d.dismiss(); });
  await p.goto(BASE + 'admin/?as=' + encodeURIComponent(o.as || ME));
  await p.waitForSelector('#main .tw, #main .cards, #main .fcard, #main .empty');
  await p.evaluate(function () { return document.fonts && document.fonts.ready; });
  if (o.css) await p.addStyleTag({ content: o.css });
  await p.waitForTimeout(500);
  return p;
}
async function openForm(b) {
  var ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  var p = await ctx.newPage();
  p.on('pageerror', function (e) { errors.push(String(e)); console.error('pageerror', e); });
  await p.goto(BASE + 'form/'); await p.waitForSelector('.scale label'); await p.evaluate(function () { return document.fonts && document.fonts.ready; }); await p.waitForTimeout(500);
  return p;
}
async function tab(p, t) { await p.click('#tabs button[data-t=' + t + ']'); await p.waitForTimeout(500); }
async function settle(p, ms) { await p.waitForTimeout(ms || 700); await hideToast(p); }
async function hideToast(p) { await p.evaluate(function () { var t = document.getElementById('toast'); if (t) t.style.display = 'none'; }); }
async function box(p, sel) { var l = typeof sel === 'string' ? p.locator(sel).first() : sel; var bb = await l.boundingBox(); if (!bb) throw new Error('見つからない: ' + sel); var sy = await p.evaluate(function () { return scrollY; }); return { x: bb.x, y: bb.y + sy, width: bb.width, height: bb.height }; }
// 複数の部品を囲む切り抜き（ページ全体の座標）。o.x2 = 右の端をこの部品の右に合わせる など
async function clipOf(p, sels, pad, o) {
  pad = pad == null ? 12 : pad; o = o || {}; var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  var W = await p.evaluate(function () { return document.documentElement.clientWidth; });
  for (var s of sels) { var bb = await box(p, s); x1 = Math.min(x1, bb.x); y1 = Math.min(y1, bb.y); x2 = Math.max(x2, bb.x + bb.width); y2 = Math.max(y2, bb.y + bb.height); }
  if (o.maxH) y2 = Math.min(y2, y1 + o.maxH);
  var c = { x: Math.max(0, Math.floor(x1 - pad)), y: Math.max(0, Math.floor(y1 - pad)) };
  c.width = Math.min(W, Math.ceil(x2 + pad)) - c.x; c.height = Math.ceil(y2 + pad) - c.y;
  return c;
}
async function snap(p, demo, name, clip, dw, alt) {
  var file = 'demo-' + name + '.png';
  await hideToast(p);
  await p.screenshot({ path: path.join(OUT, file), clip: clip, fullPage: true });
  var dsf = await p.evaluate(function () { return devicePixelRatio; });
  demo.images.push({ src: 'img/' + file, w: Math.round(clip.width * dsf), h: Math.round(clip.height * dsf), dw: dw || Math.round(clip.width), alt: alt || '' });
  return { k: demo.images.length - 1, clip: clip };
}
function pct(shot, bb, dx, dy) {
  var c = shot.clip;
  return {
    x: r1(((bb.x + (dx == null ? bb.width / 2 : dx)) - c.x) / c.width * 100), y: r1(((bb.y + (dy == null ? bb.height / 2 : dy)) - c.y) / c.height * 100),
    box: { x: r1((bb.x - c.x) / c.width * 100), y: r1((bb.y - c.y) / c.height * 100), w: r1(bb.width / c.width * 100), h: r1(bb.height / c.height * 100) }
  };
}
// opt: { dx, dy, look, lookPad, type, more:[sel..], span:[sel..] }  span = 枠（と指す場所）を、これらの部品まで広げる
async function step(p, shot, sel, t, opt) {
  opt = opt || {};
  var bb = await box(p, sel);
  for (var sp of (opt.span || [])) { var o2 = await box(p, sp), x2 = Math.max(bb.x + bb.width, o2.x + o2.width), y2 = Math.max(bb.y + bb.height, o2.y + o2.height); bb.x = Math.min(bb.x, o2.x); bb.y = Math.min(bb.y, o2.y); bb.width = x2 - bb.x; bb.height = y2 - bb.y; }
  var q = pct(shot, bb, opt.dx, opt.dy);
  if (q.x < 0 || q.x > 100 || q.y < 0 || q.y > 100) throw new Error('写真の外を指している: ' + sel + ' (' + q.x + ',' + q.y + ')');
  var s = { img: shot.k, x: q.x, y: q.y, t: t, box: q.box };
  if (opt.look) { var pad = opt.lookPad == null ? 4 : opt.lookPad, c = shot.clip; s.look = { x: r1((bb.x - pad - c.x) / c.width * 100), y: r1((bb.y - pad - c.y) / c.height * 100), w: r1((bb.width + pad * 2) / c.width * 100), h: r1((bb.height + pad * 2) / c.height * 100) }; }
  if (opt.type) s.type = opt.type;
  if (opt.more) { s.more = []; for (var m of opt.more) { var mb = await box(p, m); var mq = pct(shot, mb); s.more.push({ x: mq.x, y: mq.y }); } }
  return s;
}
var ROW = function (name) { return 'table.lt tr.r:has(td.nm2:text-is("' + name + '"))'; };
var CELL = function (name, k) { return ROW(name) + ' .inl[data-k=' + k + ']'; };
var CARD = function (name) { return '.cards .rc:has(.nm:text-is("' + name + '"))'; };
// 表は横に長いので、写真では「具体的な反響」の欄だけ少し狭くする（長い文は元から「…」で切れる欄）
var NARROW = 'table.lt td.tx{max-width:170px}';
var SIDE = ['.brand', '#tabs'];

// ---------- 各章 ----------
var DEMOS = {};

DEMOS.tour = { section: 'start', title: '画面の見かた', head: 'ここを見ます', run: async function (b, d) {
  var p = await openAdmin(b, { h: 920, css: NARROW });
  var shot = await snap(p, d, 'tour', { x: 0, y: 0, width: 1280, height: 920 }, 0, '管理サイトの画面');
  d.steps.push(await step(p, shot, '#tabs button[data-t=todo]', '「未割り当て」… まだ担当が決まっていない回答。赤い数字は件数です', { look: true }));
  d.steps.push(await step(p, shot, '#tabs button[data-t=list]', '「一覧」… 全社の回答を全部見られます', { look: true }));
  d.steps.push(await step(p, shot, '#tabs button[data-t=stats]', '「分析」… 満足度の平均や内訳を、ジャンル別・媒体別などでくらべます', { look: true }));
  d.steps.push(await step(p, shot, '#tabs button[data-t=cases]', '「事例」… 反響がよかった回答だけを集めたページです', { look: true }));
  d.steps.push(await step(p, shot, '#tabs button[data-t=settings]', '「フォーム・設定」… お客様に渡すアンケートのURLとQRコード', { look: true }));
  d.steps.push(await step(p, shot, '#folders', '自分の案件・担当者ごと・担当なし で分けて見られます（数字は件数）', { look: true }));
  d.steps.push(await step(p, shot, '.tools', 'ほかの社内ツールへ移れます（新しいタブで開きます）', { look: true }));
  d.steps.push(await step(p, shot, '#guideBtn', 'このガイドを開きます', { look: true }));
  d.steps.push(await step(p, shot, '.me', 'いま使っている人の名前です', { look: true }));
} };

DEMOS.myform = { section: 'send', title: '自分専用のアンケートを作って、URL・QRコードを渡す', run: async function (b, d) {
  var p = await openAdmin(b);
  var side = await snap(p, d, 'myform-side', await clipOf(p, SIDE, 0), 0, '左のメニュー');
  d.steps.push(await step(p, side, '#tabs button[data-t=settings]', '左のメニューの「フォーム・設定」を押します'));
  await tab(p, 'settings');
  var mk = await snap(p, d, 'myform-make', await clipOf(p, ['main .fcard'], 10), 0, 'あなた専用のアンケート（作る前）');
  d.steps.push(await step(p, mk, '#mkForm', '「自分専用のアンケートを作る」を押します（最初の1回だけ）'));
  await p.click('#mkForm'); await p.waitForSelector('#qrMine img[src^="data:"]', { state: 'attached' }); await settle(p, 900);
  var f = await snap(p, d, 'myform-card', await clipOf(p, ['main .fcard'], 10), 0, 'あなた専用のアンケート');
  d.steps.push(await step(p, f, '#qrMine', 'あなた専用のQRコードができました', { look: true }));
  d.steps.push(await step(p, f, 'main .fcard .url', 'あなた専用のURLです（最後に「?t=」と英数字が付きます）', { look: true }));
  d.steps.push(await step(p, f, 'main .fcard [data-copy]', '「URLをコピー」を押して、メールやLINEに貼って送ります'));
  d.steps.push(await step(p, f, 'main .fcard [data-dl]', '「QRを画像で保存」で、資料やチラシに貼れる画像を保存します'));
  d.steps.push(await step(p, f, '#ph_hankyo', 'グレーの参考文を、自分のお客様向けに変えることもできます（空のままなら共通の文）', { dx: 90, dy: 18, type: '問い合わせや予約が何件あったかなど' }));
  d.steps.push(await step(p, f, '#phSave', '変えたら「参考文を保存」を押します'));
  d.steps.push(await step(p, f, 'main .fcard a.btn', '「お客様の画面を見る」で、お客様に見える画面を確かめられます'));
} };

DEMOS.form = { section: 'form', title: 'お客様がスマホで答える流れ', run: async function (b, d) {
  var p = await openForm(b);
  var top = await snap(p, d, 'form-top', await clipOf(p, ['header', '.q:has(#hankyo)'], 8), 300, 'アンケート（上）');
  d.steps.push(await step(p, top, '#keisai', 'URLかQRコードから開くと、この画面です。掲載名を入れます（必須）', { dx: 70, type: '〇〇整骨院' }));
  d.steps.push(await step(p, top, '.scale[data-name=sat_hankyo] label:nth-child(1)', '① 反響の満足度を、5つから1つ選びます（必須）'));
  d.steps.push(await step(p, top, '#hankyo', '② 具体的な反響（書かなくても送れます）。グレーの文は参考の例で、書き始めると消えます', { dx: 70, dy: 22, type: '新規の予約が10件ありました' }));
  var bot = await snap(p, d, 'form-bottom', await clipOf(p, ['.q[data-k=sat_cost]', '#send'], 8), 300, 'アンケート（下）');
  d.steps.push(await step(p, bot, '.scale[data-name=sat_cost] label:nth-child(2)', '③ 費用感の満足度を選びます（必須）'));
  d.steps.push(await step(p, bot, '#riyu', '④ その理由（任意）', { dx: 70, dy: 22, type: '反響のわりに手ごろだった' }));
  d.steps.push(await step(p, bot, '#youbou', '⑤ ご要望（任意）', { dx: 70, dy: 22, type: '次回も掲載したい' }));
  d.steps.push(await step(p, bot, '#send', '「送信する」を押します'));
  await p.fill('#keisai', '〇〇整骨院'); await p.click('.scale[data-name=sat_hankyo] label:nth-child(1)'); await p.click('.scale[data-name=sat_cost] label:nth-child(2)');
  await p.click('#send'); await p.waitForSelector('#done', { state: 'visible' }); await p.waitForTimeout(300);
  var dn = await snap(p, d, 'form-done', await clipOf(p, ['header .co', '#done'], 8), 300, '送信できた画面');
  d.steps.push(await step(p, dn, '#done h2', '「ご協力ありがとうございました」と出たら完了です', { look: true, lookPad: 10 }));
} };

DEMOS.list = { section: 'list', title: '回答を探す・絞り込む', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  var side = await snap(p, d, 'list-side', await clipOf(p, ['.brand', '#folders'], 0), 0, '左のメニュー');
  d.steps.push(await step(p, side, '#tabs button[data-t=list]', '左のメニューの「一覧」を押します'));
  d.steps.push(await step(p, side, '#folders button[data-folder=mine]', '自分の担当だけ見たいときは「自分の案件」。担当者ごとや「担当なし」でも分けられます'));
  await tab(p, 'list');
  var bar = await snap(p, d, 'list-bar', await clipOf(p, ['main .bar'], 6), 0, '探す・絞り込む');
  d.steps.push(await step(p, bar, '#fQ', '掲載名や、反響・要望に書かれた言葉で探せます', { dx: 60, type: 'クーポン' }));
  d.steps.push(await step(p, bar, '#fGenre', 'ジャンルで絞り込み'));
  d.steps.push(await step(p, bar, '#fMedia', '媒体（何版か）で絞り込み'));
  d.steps.push(await step(p, bar, '#fMonth', '掲載号で絞り込み'));
  d.steps.push(await step(p, bar, '#fSat', '反響の満足度・費用感の満足度でも絞り込めます', { more: ['#fCost'] }));
  d.steps.push(await step(p, bar, '#viewSeg', '「カード」と「表」で見た目を切り替えられます', { look: true }));
  d.steps.push(await step(p, bar, 'main .bar > .hint:last-child', '条件に合う件数です', { look: true }));
  var tb = await snap(p, d, 'list-table', await clipOf(p, ['main .tw'], 6, { maxH: 330 }), 0, '回答の一覧（表）');
  d.steps.push(await step(p, tb, ROW('フィットネス ボルト') + ' .pill >> nth=0', '反響と費用感の満足度が色で分かります（緑ほど満足）', { look: true }));
  d.steps.push(await step(p, tb, ROW('焼肉 炎家') + ' .via', '「専用」の印は、担当者専用のアンケートから届いた回答です', { look: true, lookPad: 3 }));
  d.steps.push(await step(p, tb, ROW('フィットネス ボルト') + ' td.nm2', '行（掲載名のあたり）を押すと、回答の全文が見られます'));
} };

DEMOS.detail = { section: 'list', after: 'list', title: '回答の全文を見る・その場で直す', run: async function (b, d) {
  var p = await openAdmin(b);
  await tab(p, 'list');
  await p.click(ROW('フィットネス ボルト') + ' td.nm2'); await p.waitForSelector('.dt'); await settle(p, 500);
  var dt = await snap(p, d, 'detail', await clipOf(p, ['#dtBack', '.dt'], 10), 640, '回答の詳しい画面');
  d.steps.push(await step(p, dt, '.dt .sat', '① 反響と ③ 費用感の満足度', { look: true }));
  d.steps.push(await step(p, dt, '.dt .sec >> nth=0', '② 具体的な反響・④ 理由・⑤ ご要望が、切れずに全部読めます', { look: true, span: ['.dt .sec >> nth=2'] }));
  d.steps.push(await step(p, dt, '.dt table.ed', '担当の情報。自分の担当の回答なら、ここで直せます（変えるとすぐ保存）', { look: true }));
  d.steps.push(await step(p, dt, '.dt textarea.memo', '社内メモ（お客様には見えません）。書いて欄の外を押すと保存されます', { dx: 60, dy: 20, type: '次回は春号で1/2ページを提案' }));
  d.steps.push(await step(p, dt, '.dt .acts .btn.red', 'まちがい・テストの回答は「削除」（2回押します）'));
  d.steps.push(await step(p, dt, '#dtBack', '「← 回答一覧に戻る」で一覧に戻ります'));
} };

DEMOS.claim = { section: 'claim', title: '表で「自分の担当」にする', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  var side = await snap(p, d, 'claim-side', await clipOf(p, SIDE, 0), 0, '左のメニュー');
  d.steps.push(await step(p, side, '#tabs button[data-t=todo]', '左のメニューの「未割り当て」を押します（赤い数字が件数）'));
  var c0 = await clipOf(p, ['main .bar', 'main .tw'], 6); c0.height += 40; var t0 = await snap(p, d, 'claim-todo', c0, 0, '未割り当て');
  d.steps.push(await step(p, t0, 'main .tw tbody', 'まだ担当が決まっていない回答が並びます', { look: true }));
  d.steps.push(await step(p, t0, CELL('ペットサロン わんこ堂', 'owner'), '自分のお客様の回答なら、「担当」の欄を押して自分の名前を選びます'));
  await p.selectOption(CELL('ペットサロン わんこ堂', 'owner'), ME); await settle(p, 900);
  var t1 = await snap(p, d, 'claim-after', await clipOf(p, ['main .bar', 'main h2.sec', 'main .tw >> nth=1'], 6), 0, '自分の担当になった');
  d.steps.push(await step(p, t1, 'main h2.sec', '自分の担当になると、下の「担当の情報がまだの回答」に移ります', { look: true }));
  d.steps.push(await step(p, t1, CELL('ペットサロン わんこ堂', 'genre'), '続けて、ジャンルや掲載号などを選びます（6章）'));
} };

DEMOS.claimcard = { section: 'claim', after: 'claim', title: 'カードの「自分の担当にする」ボタンで', run: async function (b, d) {
  var p = await openAdmin(b, { view: 'card' });
  var c0 = await snap(p, d, 'card-todo', await clipOf(p, ['main .bar', '.cards .rc:nth-child(1)', '.cards .rc:nth-child(2)'], 6), 0, '未割り当て（カード）');
  d.steps.push(await step(p, c0, '#viewSeg', 'カードの見た目にしているときは…', { look: true }));
  d.steps.push(await step(p, c0, CARD('ほっと訪問介護') + ' button[data-a=claim]', '「自分の担当にする」を押します'));
  await p.click(CARD('ほっと訪問介護') + ' button[data-a=claim]'); await p.waitForSelector('dialog[open]'); await settle(p, 600);
  await p.selectOption('#dGenre', '介護・福祉'); await p.selectOption('#dMonth', '2026-11'); await p.selectOption('#dMedia', '一宮'); await p.selectOption('#dSize', '1/6P FO');
  var dl = await snap(p, d, 'card-dialog', await clipOf(p, ['#dlg'], 0), 520, '担当の情報');
  d.steps.push(await step(p, dl, '#dOwner', '担当は自分になっています（あとから付け替えられます）', { look: true }));
  d.steps.push(await step(p, dl, '#dGenre', 'ジャンルを選びます'));
  d.steps.push(await step(p, dl, '#dMonth', '掲載号を選びます'));
  d.steps.push(await step(p, dl, '#dMedia', '媒体（何版か）を選びます'));
  d.steps.push(await step(p, dl, '#dSize', '掲載サイズ・枠を選びます'));
  d.steps.push(await step(p, dl, '#dPrice', '掲載料金（税抜・円）を数字で入れます', { dx: 60, type: '18000' }));
  d.steps.push(await step(p, dl, '#dMemo', '社内メモ（任意）', { dx: 60, dy: 18, type: '次回は求人でも提案' }));
  d.steps.push(await step(p, dl, '#dSave', '「保存する」を押して完了です'));
} };

DEMOS.reassign = { section: 'claim', after: 'claimcard', title: '担当を付け替える・はずす', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  await tab(p, 'list');
  await p.click('#folders button[data-folder=mine]'); await settle(p, 500);
  var a = await snap(p, d, 'reassign-before', await clipOf(p, ['main .tw'], 6), 0, '自分の案件');
  d.steps.push(await step(p, a, CELL('英会話 スマイル', 'owner'), '付け替えたい回答の「担当」の欄を押して、相手の名前を選びます'));
  d.steps.push(await step(p, a, CELL('ラーメン 一心', 'owner'), '担当をはずすときは「担当なし」を選びます'));
  await p.click('#folders button[data-folder=all]'); await settle(p, 400);
  await p.selectOption(CELL('英会話 スマイル', 'owner'), PEOPLE[1][0]); await settle(p, 900);
  var c = await snap(p, d, 'reassign-after', await clipOf(p, [ROW('ベーカリー 小麦の丘'), ROW('〇〇整骨院')], 4), 0, '付け替えたあと');
  d.steps.push(await step(p, c, ROW('英会話 スマイル') + ' td.own', '田中さんの担当になりました。ほかの人の担当は文字だけになり、自分では直せません', { look: true }));
} };

DEMOS.inline = { section: 'input', title: '表で、その場で項目を入れる', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  await tab(p, 'list');
  var side = await snap(p, d, 'inline-side', await clipOf(p, ['.brand', '#folders'], 0), 0, '左のメニュー');
  d.steps.push(await step(p, side, '#folders button[data-folder=mine]', '「自分の案件」を押すと、自分の担当の回答だけになります'));
  await p.click('#folders button[data-folder=mine]'); await settle(p, 500);
  var tb = await snap(p, d, 'inline-table', await clipOf(p, ['main .tw'], 6), 0, '自分の案件（表）');
  d.steps.push(await step(p, tb, CELL('ベーカリー 小麦の丘', 'genre'), '「（選ぶ）」の欄はまだ空です。押すと選択肢が出るので、選びます'));
  d.steps.push(await step(p, tb, CELL('ベーカリー 小麦の丘', 'month'), '掲載号'));
  d.steps.push(await step(p, tb, CELL('ベーカリー 小麦の丘', 'media'), '媒体'));
  d.steps.push(await step(p, tb, CELL('ベーカリー 小麦の丘', 'size'), 'サイズ'));
  d.steps.push(await step(p, tb, CELL('ベーカリー 小麦の丘', 'price'), '料金は数字を入れて Enter（税抜・円）', { dx: 20, type: '20000' }));
  for (var kv of [['genre', 'グルメ'], ['month', '2026-11'], ['media', '江南'], ['size', '1/6P FO']]) { await p.selectOption(CELL('ベーカリー 小麦の丘', kv[0]), kv[1]); await p.waitForTimeout(500); }
  await p.fill(CELL('ベーカリー 小麦の丘', 'price'), '20000'); await p.press(CELL('ベーカリー 小麦の丘', 'price'), 'Enter'); await settle(p, 900);
  await p.evaluate(function () { document.activeElement && document.activeElement.blur(); });
  var af = await snap(p, d, 'inline-after', await clipOf(p, ['main .tw'], 6), 0, '入れたあと');
  d.steps.push(await step(p, af, ROW('ベーカリー 小麦の丘'), '選ぶとすぐ保存されます（保存ボタンはありません）', { look: true, lookPad: 0 }));
} };

DEMOS.copypaste = { section: 'input', after: 'inline', title: '右クリックでコピー・貼り付け', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  await tab(p, 'list'); await p.click('#folders button[data-folder=mine]'); await settle(p, 500);
  var clip = await clipOf(p, ['main .tw'], 6, {}); clip.height += 70; // 右クリックのメニューが入るように下を少し広く
  await p.click(CELL('フィットネス ボルト', 'genre'), { button: 'right' }); await p.waitForSelector('#cm');
  var m1 = await snap(p, d, 'cp-copy', clip, 0, 'コピー');
  d.steps.push(await step(p, m1, CELL('フィットネス ボルト', 'genre'), '値が入っている欄の上で、右クリックします'));
  d.steps.push(await step(p, m1, '#cm button[data-cm=copy]', '「コピー」を押します'));
  await p.click('#cm button[data-cm=copy]'); await settle(p, 300);
  await p.click(CELL('ベーカリー 小麦の丘', 'genre'), { button: 'right' }); await p.waitForSelector('#cm');
  var m2 = await snap(p, d, 'cp-paste', clip, 0, '貼り付け');
  d.steps.push(await step(p, m2, CELL('フィットネス ボルト', 'genre'), 'コピーした欄は点線で囲まれます', { look: true, lookPad: 3 }));
  d.steps.push(await step(p, m2, CELL('ベーカリー 小麦の丘', 'genre'), '貼りたい欄の上で、右クリックします'));
  d.steps.push(await step(p, m2, '#cm button[data-cm=paste]', '「ここに貼り付け」を押します'));
  await p.click('#cm button[data-cm=paste]'); await settle(p, 1000);
  var m3 = await snap(p, d, 'cp-done', clip, 0, '貼り付けたあと');
  d.steps.push(await step(p, m3, CELL('ベーカリー 小麦の丘', 'genre'), '同じ値が入って、すぐ保存されます', { look: true, lookPad: 3 }));
} };

DEMOS.copymulti = { section: 'input', after: 'copypaste', title: 'いくつかの欄にまとめて貼り付け', run: async function (b, d) {
  var p = await openAdmin(b, { w: 1600, css: NARROW });
  await tab(p, 'list'); await p.click('#folders button[data-folder=mine]'); await settle(p, 500);
  var clip = await clipOf(p, ['main .tw'], 6, {}); clip.height += 90;
  await p.click(CELL('フィットネス ボルト', 'size'), { button: 'right' }); await p.waitForSelector('#cm');
  await p.click('#cm button[data-cm=copy]'); await settle(p, 300);
  await p.focus(CELL('ベーカリー 小麦の丘', 'size')); await p.dispatchEvent(CELL('ベーカリー 小麦の丘', 'size'), 'mousedown', { button: 0 });
  await p.dispatchEvent(CELL('英会話 スマイル', 'size'), 'mousedown', { button: 0, shiftKey: true }); await p.waitForTimeout(200);
  await p.click(CELL('英会話 スマイル', 'size'), { button: 'right' }); await p.waitForSelector('#cm');
  var txt = await p.textContent('#cm'); if (!/選んだ 3 か所/.test(txt)) throw new Error('まとめて貼り付けが出ない: ' + txt);
  var m = await snap(p, d, 'multi', clip, 0, 'まとめて貼り付け');
  d.steps.push(await step(p, m, CELL('フィットネス ボルト', 'size'), '先に、元の欄を右クリック →「コピー」しておきます（点線で囲まれます）', { look: true, lookPad: 3 }));
  d.steps.push(await step(p, m, CELL('ベーカリー 小麦の丘', 'size'), '貼りたい欄の、いちばん上を押します'));
  d.steps.push(await step(p, m, CELL('英会話 スマイル', 'size'), 'Shift キーを押しながら、いちばん下を押すと、縦にまとめて選べます（色が付きます）'));
  d.steps.push(await step(p, m, '#cm button[data-cm=paste]', '選んだ欄の上で右クリック →「選んだ 3 か所に貼り付け」'));
  await p.click('#cm button[data-cm=paste]'); await settle(p, 1500);
  var af = await snap(p, d, 'multi-done', clip, 0, 'まとめて貼り付けたあと');
  d.steps.push(await step(p, af, CELL('ベーカリー 小麦の丘', 'size'), '選んだ欄に、まとめて入りました', { look: true, lookPad: 3, span: [CELL('英会話 スマイル', 'size')] }));
} };

DEMOS.stats = { section: 'stats', title: '分析と事例を見る', run: async function (b, d) {
  var p = await openAdmin(b);
  var side = await snap(p, d, 'stats-side', await clipOf(p, SIDE, 0), 0, '左のメニュー');
  d.steps.push(await step(p, side, '#tabs button[data-t=stats]', '左のメニューの「分析」を押します'));
  await tab(p, 'stats');
  await p.click('button[data-by=media]'); await p.waitForTimeout(300);
  var st = await snap(p, d, 'stats', await clipOf(p, ['main .bar', 'main .tblw'], 6), 0, '分析');
  d.steps.push(await step(p, st, '#sFrom', '掲載号の範囲を決めて、その間の回答だけで集計できます', { more: ['#sTo'] }));
  d.steps.push(await step(p, st, 'main .kpis', '回答数と、満足度の平均（5点満点）。「満足・やや満足」の割合も出ます', { look: true }));
  d.steps.push(await step(p, st, 'button[data-by=media]', 'くらべる切り口を選びます（ジャンル別・媒体別・サイズ別・担当別・掲載号別・料金別）'));
  d.steps.push(await step(p, st, 'main table.st', '切り口ごとの件数・平均・内訳。色の帯は 緑＝満足 〜 赤＝不満 の割合です', { look: true }));
  d.steps.push(await step(p, side, '#tabs button[data-t=cases]', '「事例」を押すと…'));
  await tab(p, 'cases');
  var cs = await snap(p, d, 'cases', await clipOf(p, ['main .bar', 'main .tw'], 6, { maxH: 360 }), 0, '事例');
  d.steps.push(await step(p, cs, 'main .bar .hint', '反響が「満足」「やや満足」で、具体的な反響が書かれている回答だけが並びます', { look: true }));
  d.steps.push(await step(p, cs, '#cGenre', 'ジャンル・媒体で絞り込めます。営業の話のネタや提案資料にどうぞ', { more: ['#cMedia'] }));
} };

// ---------- 実行 ----------
(async function () {
  var only = process.argv.slice(2);
  await new Promise(function (ok) { server.listen(PORT, '127.0.0.1', ok); });
  try {
    var old = fs.existsSync(JSON_OUT) ? JSON.parse(fs.readFileSync(JSON_OUT, 'utf8')).demos : [];
    var b = await pw.chromium.launch({ channel: 'chrome' });
    var out = [];
    for (var id of Object.keys(DEMOS)) {
      if (only.length && only.indexOf(id) < 0) { var keep = old.filter(function (x) { return x.id === id; })[0]; if (keep) out.push(keep); continue; }
      world = makeWorld(); // デモごとに最初の状態から
      var D = DEMOS[id], demo = { id: id, section: D.section, after: D.after, title: D.title, head: D.head, images: [], steps: [] };
      await D.run(b, demo);
      out.push(demo); console.log(id, demo.images.length + '枚', demo.steps.length + '手順');
    }
    await b.close();
    fs.writeFileSync(JSON_OUT, JSON.stringify({ demos: out }, null, 1));
    if (errors.length) { console.error('画面のエラー:', errors); process.exitCode = 1; }
  } finally { server.close(); }
})().catch(function (e) { console.error(e); process.exit(1); });
