// node test/build-sample.js — 公開サンプル（架空データ・ログイン不要・ブラウザの中だけで動く）を docs/sample/ に作る
// 管理サイト: docs/sample/index.html（本物の gas-admin の画面＋Code.gs をブラウザの中の偽スプレッドシートで動かす）
// アンケート: docs/sample/form.html（送信しても本物には届かない）
// 画面や Code.gs を直したら、これを実行し直してから push
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..'), out = path.join(root, 'docs', 'sample');
fs.mkdirSync(out, { recursive: true });
var mock = fs.readFileSync(path.join(__dirname, 'gas-mock.js'), 'utf8');
var adminCode = fs.readFileSync(path.join(root, 'gas-admin', 'Code.gs'), 'utf8');
var apiCode = fs.readFileSync(path.join(root, 'gas-api', 'Code.gs'), 'utf8');
var esc = function (s) { return s.replace(/<\/script/gi, '<\\/script'); };

// 架空のデータ（店名・人名・内容はすべて架空）
var PEOPLE = [['sample@k-create.co.jp', '見本 花子'], ['tanaka@example.jp', '田中 一郎'], ['suzuki@example.jp', '鈴木 美咲'], ['sato@example.jp', '佐藤 健太']];
var ROWS = [
  ['〇〇整骨院', 5, '掲載後1か月で新規の予約が12件ありました。冊子を見たという方が多かったです。', 4, '費用対効果満足度が得られた', '次回も掲載したい', 1, ['クリニック', '2026-10', '一宮', '1/4P AD', 30000]],
  ['カフェ こもれび', 4, '来店が増えた。クーポン利用が8件。', 3, '反響はあったが費用的には少し高く感じた', 'エリアを広げていきたい', 2, ['グルメ', '2026-10', '江南', '1/8P FO', 15000]],
  ['ひまわり学習塾', 3, '問い合わせが2件', 2, '時期が合わなかった', '春の募集時期にもう一度相談したい', 1, ['スクール', '2026-09', '一宮', '1/6P FO', 20000]],
  ['ヘアサロン ルーム', 5, '20代の新規客が5人増えた', 5, '想像以上の反響だった', 'HPやAIについても相談したい', 0, ['ショップ', '2026-11', '岩倉', '1/4P FO', 25000]],
  ['ほっと訪問介護', 2, '反響はほとんどなかった', 2, '費用的に高く感じた', '', -1, null],
  ['和菓子 つきみ', 4, '贈答用の注文が増えた', 4, '', '年末号にも出したい', -1, null],
  ['みどり歯科クリニック', 5, '新規の患者さんが月10人ほど増えた。予約の電話で「くれよんを見た」と言われた。', 4, '費用対効果に満足', '次回は1/2ページで相談したい', 3, ['クリニック', '2026-09', '一宮', '1/2P AD', 80000]],
  ['ベーカリー 小麦の丘', 4, 'クーポン持参が15件', 4, 'ちょうどよい', '', 2, ['グルメ', '2026-11', '江南', '1/6P FO', 20000]],
  ['さくら司法書士事務所', 3, '相談が1件', 3, '', '相続特集があればまた出したい', 3, ['終活・士業', '2026-10', '清須', '1/4P FO', 25000]],
  ['フィットネス ボルト', 5, '体験申し込みが20件、そのうち8件入会', 5, '費用以上の効果があった', '毎月出したい', 1, ['トータルケア', '2026-11', '一宮', '1/2P FO', 60000]],
  ['リフォーム工房 あおい', 2, '問い合わせは0件だった', 1, '高く感じた', '内容を変えてもう一度考えたい', 0, ['暮らし', '2026-09', '津島', '1/4P AD', 35000]],
  ['ペットサロン わんこ堂', 4, '新規のトリミング予約が6件', 4, '', 'エリアを広げていきたい', 2, ['ショップ', '2026-10', '西北', '1/8P FO', 12000]]
];

// 追加の架空データ（決まった並びで作る＝毎回同じ）
(function () {
  var seed = 7; function rnd(n) { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); }
  var shops = [["グルメ", ["ラーメン 一心", "定食屋 まごころ", "焼肉 炎家", "パスタ食堂 ルーチェ", "居酒屋 ほろよい", "うどん処 さぬきや", "洋菓子 ミルフィーユ", "寿司 はま栄"]],
    ["クリニック", ["いちのみや内科", "こころ皮ふ科", "さくら眼科", "あおば整形外科"]], ["スクール", ["英会話 スマイル", "ピアノ教室 ドレミ", "そろばん塾 けいさん", "スイミング アクア"]],
    ["ショップ", ["花屋 はなまる", "メガネの光", "古着屋 ヴィンテ", "自転車 ペダル"]], ["暮らし", ["工務店 木のいえ", "外壁塗装 いろどり", "不動産 すまいる"]],
    ["トータルケア", ["整体 ほぐし庵", "ヨガ教室 しずく", "ネイル リリー"]], ["介護・福祉", ["デイサービス ひだまり", "訪問看護 えがお"]], ["終活・士業", ["行政書士 まるやま事務所", "葬儀 やすらぎ会館"]], ["企業", ["株式会社 ミライ製作所"]]];
  var good = ["新規のお客さまが8件増えた", "問い合わせが15件あった", "予約が月10件ほど増えた", "クーポン持参が20件以上あった", "「冊子を見た」と来店する方が多かった", "体験の申し込みが12件、うち5件入会", "求人の応募が6件あった", "電話の問い合わせが倍になった"];
  var mid = ["問い合わせが2〜3件", "少し来店が増えた気がする", "反響はぼちぼち", "常連さんから声をかけられた"];
  var bad = ["反響はほとんどなかった", "問い合わせは0件", "時期が合わなかったのか反応がなかった"];
  var why = ["費用対効果満足度が得られた", "価格以上の反響があった", "ちょうどよい価格", "反響はあったが費用的には少し高く感じた", "もう少し安いと続けやすい", "高く感じた"];
  var wants = ["次回も掲載したい", "エリアを広げていきたい", "HPやAIについても相談したい", "サイズを大きくしてみたい", "季節ごとに出したい", "求人でも使いたい", "", "", ""];
  var sizes = [["1/8P FO", 12000], ["1/6P FO", 18000], ["1/4P FO", 25000], ["1/4P AD", 30000], ["1/2P FO", 55000], ["1/2P AD", 70000], ["1P", 120000]];
  var media = ["一宮", "一宮", "一宮", "江南", "江南", "岩倉", "清須", "津島", "西北"];
  var months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
  for (var i = 0; i < 30; i++) {
    var g = shops[rnd(shops.length)], name = g[1][rnd(g[1].length)];
    var base = name, k = 0, sfx = ["本店", "駅前店", "北店", "南店", "東店", "西店"];
    while (ROWS.some(function (r) { return r[0] === name; })) name = base + " " + (sfx[k++] || k);
    var sz = sizes[rnd(sizes.length)], bias = sz[1] >= 55000 ? 1 : 0, sh = Math.min(5, Math.max(1, 2 + rnd(4) + bias)), sc = Math.min(5, Math.max(1, sh - 1 + rnd(3) - (sz[1] >= 70000 ? 1 : 0)));
    var hk = sh >= 4 ? good[rnd(good.length)] : sh === 3 ? mid[rnd(mid.length)] : bad[rnd(bad.length)];
    var ry = sc >= 4 ? why[rnd(3)] : why[3 + rnd(3)];
    ROWS.push([name, sh, hk, sc, rnd(3) ? ry : "", wants[rnd(wants.length)], i % 9 === 8 ? -1 : rnd(4), [g[0], months[rnd(months.length)], media[rnd(media.length)], sz[0], sz[1]]]);
  }
})();
var boot = '\n<script>\n' + esc(mock) + '\n</script>\n<script>\n(function () {\n'
  + 'var store = {}, SHEET_ID = "1w-4FIkRfEjiCEo6LwKKb8CoXMOvT7_c6ASFpVkrO3ks", QR = "1riYm2WOMEeZBq0Te6BsqBumQFvPji9oYuZa8c6_So0o";\n'
  + 'store[SHEET_ID] = new GasMock.Spreadsheet(SHEET_ID, "反響事例管理データ（サンプル）");\n'
  + 'var q = store[QR] = new GasMock.Spreadsheet(QR, "QR"), mem = q.insertSheet("members"); mem.appendRow(["email","name","prefix"]);\n'
  + 'var PEOPLE = ' + JSON.stringify(PEOPLE) + ', ROWS = ' + JSON.stringify(ROWS) + ';\n'
  + 'PEOPLE.forEach(function (p) { mem.appendRow([p[0], p[1], ""]); });\n'
  + 'function load(code, user, names) { var env = GasMock.makeEnv(store, { owner: "sample@k-create.co.jp", user: user }); env.SpreadsheetApp.getActiveSpreadsheet = function () { return store[SHEET_ID]; };\n'
  + '  env.HtmlService = {}; var keys = Object.keys(env).filter(function (k) { return /^[A-Za-z]/.test(k); });\n'
  + '  return new Function(keys.join(","), code + "\\n;return {" + names.map(function (n) { return n + ":" + n; }).join(",") + "};").apply(null, keys.map(function (k) { return env[k]; })); }\n'
  + 'var API = ' + JSON.stringify(apiCode) + ', ADMIN = ' + JSON.stringify(adminCode) + ';\n'
  + 'var FNS = ["init","listRows","claim","release","assign","saveField","saveSales","removeRow","restoreRow","saveMaster","createMyForm","saveMyForm"];\n'
  + 'var api = load(API, "", ["doPost"]), me = load(ADMIN, PEOPLE[0][0], FNS); me.init();\n'
  + 'var ss = store[SHEET_ID]; ss.getSheetByName("admins").appendRow(["sample@k-create.co.jp"]);\n'
  + 'ss.getSheetByName("settings").appendRow(["form_url", "form.html"]);\n'
  + 'var day = 0; ROWS.forEach(function (x) { api.doPost({ postData: { contents: JSON.stringify({ action: "submit", data: { keisai: x[0], sat_hankyo: x[1], hankyo: x[2], sat_cost: x[3], riyu: x[4], youbou: x[5] } }) } }); });\n'
  + 'var sh = ss.getSheetByName("responses");\n'
  + 'for (var i = 2; i <= sh.getLastRow(); i++) { var d = new Date(2026, 10, 18 - (sh.getLastRow() - i) * 2, 10 + i % 7, (i * 13) % 60); var p = function (n) { return ("0" + n).slice(-2); }; sh.getRange(i, 2).setValue(d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes())); }\n'
  + 'var rows = me.listRows(); ROWS.forEach(function (x) { if (x[6] < 0) return; var r = rows.filter(function (o) { return o.keisai === x[0]; })[0], who = load(ADMIN, PEOPLE[x[6]][0], FNS); who.claim(r.id); who.saveSales(r.id, { genre: x[7][0], month: x[7][1], media: x[7][2], size: x[7][3], price: x[7][4] }); });\n'
  + 'function mk(ok, ng) { return new Proxy({}, { get: function (_, fn) {\n'
  + '  if (fn === "withSuccessHandler") return function (f) { return mk(f, ng); }; if (fn === "withFailureHandler") return function (f) { return mk(ok, f); };\n'
  + '  return function () { var a = [].slice.call(arguments); setTimeout(function () { try { var r = JSON.parse(JSON.stringify(me[fn].apply(null, a))); ok && ok(r); } catch (e) { ng && ng(e); } }, 150); }; } }); }\n'
  + 'window.google = { script: { run: mk() } };\n'
  + '})();\n</script>\n';

var banner = '<div style="background:#fef3c7;color:#92400e;font-size:12.5px;padding:7px 16px;text-align:center;border-bottom:1px solid #fde68a">これはサンプルです（店名・人名・内容はすべて架空）。ログインは不要で、ここで操作しても本物のデータは変わりません。ページを開き直すと元に戻ります。　<a href="form.html" target="_blank" style="color:#92400e;font-weight:bold">アンケートのサンプルを見る</a></div>';
var html = fs.readFileSync(path.join(root, 'gas-admin', 'index.html'), 'utf8')
  .replace('<base target="_top">', '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>反響事例管理（サンプル）</title>')
  .replace('<body>', '<body>' + banner)
  .replace('<script src="https://cdnjs', boot + '<script src="https://cdnjs')
  .replace('.side{background:var(--side);color:var(--side-text);display:flex;flex-direction:column;position:sticky;top:0;height:100vh}', '.side{background:var(--side);color:var(--side-text);display:flex;flex-direction:column;position:sticky;top:0;height:calc(100vh - 35px)}');
fs.writeFileSync(path.join(out, 'index.html'), html);

var form = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8')
  .replace('<title>お客様アンケート｜ケイ・クリエイト</title>', '<title>お客様アンケート（サンプル）</title>')
  .replace('<body>', '<body><div style="background:#fef3c7;color:#92400e;font-size:12.5px;padding:7px 16px;text-align:center;border-bottom:1px solid #fde68a">これはサンプルです。送信しても、どこにも届きません。</div>')
  .replace('<script src="config.js"></script>', '<script>window.API_URL = "sample";</script>')
  .replace("fetch(window.API_URL, { method: 'POST', body: JSON.stringify({ action: 'submit', data: data }) })\n      .then(function (r) { return r.json(); })", "new Promise(function (ok) { setTimeout(function () { ok({ ok: true }); }, 500); })");
if (form.indexOf('new Promise(function (ok)') < 0) throw new Error('フォームの送信部分が見つかりません');
fs.writeFileSync(path.join(out, 'form.html'), form);
console.log('docs/sample/index.html と form.html を作りました');
