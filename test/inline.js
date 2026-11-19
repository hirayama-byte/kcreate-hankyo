// PW=<playwright> OUT=<フォルダ> node test/inline.js — 一覧の表・詳細ページのその場編集の確認（2026-11-19）。serve.js 8820 --seed を立ち上げてから
var pw = require(process.env.PW), OUT = (process.env.OUT || require("path").join(__dirname, "shots"));
(async function () {
  var b = await pw.chromium.launch({ channel: 'chrome' }), p = await b.newPage({ viewport: { width: 1400, height: 900 } }), U = 'http://localhost:8820', errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto(U + '/admin/?as=seko@k-create.co.jp'); await p.waitForSelector('#main .tw, #main .cards');
  await p.click('#tabs button[data-t="list"]'); await p.waitForTimeout(500);
  console.log('最初は表', !!(await p.$('table.lt')));
  console.log('表のプルダウン数', (await p.$$('table.lt select.inl')).length);
  await p.screenshot({ path: OUT + '/inl-list.png' });
  // 自分の担当の行のジャンルを変える
  var sel = await p.$('table.lt tr.r select.inl[data-k="genre"]');
  var id = await sel.getAttribute('data-id');
  var opts = await sel.$$eval('option', function (o) { return o.map(function (x) { return x.value; }).filter(String); });
  await sel.selectOption(opts[1]); await p.waitForTimeout(800);
  console.log('ジャンルを変えた', await p.$eval('select.inl[data-k="genre"][data-id="' + id + '"]', function (e) { return e.value; }) === opts[1], 'トースト:', await p.$eval('#toast', function (e) { return e.textContent; }));
  console.log('詳細は開いていない', await p.$eval('#pageTitle', function (e) { return e.textContent; }));
  // 掲載号
  var ms = await p.$('select.inl[data-k="month"][data-id="' + id + '"]'); var mo = await ms.$$eval('option', function (o) { return o.map(function (x) { return x.value; }).filter(String); });
  await ms.selectOption(mo[3]); await p.waitForTimeout(800);
  console.log('掲載号', await p.$eval('select.inl[data-k="month"][data-id="' + id + '"]', function (e) { return e.value; }), 'ジャンルは残る', await p.$eval('select.inl[data-k="genre"][data-id="' + id + '"]', function (e) { return e.value; }) === opts[1]);
  // カードに切り替え
  await p.click('#viewSeg button[data-view="card"]'); await p.waitForTimeout(300);
  console.log('カードに切替', (await p.$$('.cards .rc')).length > 0);
  await p.click('#viewSeg button[data-view="table"]'); await p.waitForTimeout(300);
  // 行を押すと詳細
  await p.click('tr.r[data-open="' + id + '"] td.nm2'); await p.waitForTimeout(400);
  console.log('詳細', await p.$eval('#pageTitle', function (e) { return e.textContent; }));
  var btns = await p.$$eval('.dt .acts button', function (b) { return b.map(function (x) { return x.textContent; }); });
  console.log('詳細のボタン', btns);
  await p.fill('.dt input.inl[data-k="price"]', '45000'); await p.press('.dt input.inl[data-k="price"]', 'Tab'); await p.waitForTimeout(800);
  console.log('料金', await p.$eval('.dt input.inl[data-k="price"]', function (e) { return e.value; }));
  await p.fill('.dt textarea.inl', 'テストのメモ'); await p.click('.dt h2'); await p.waitForTimeout(800);
  console.log('メモ', await p.$eval('.dt textarea.inl', function (e) { return e.value; }));
  await p.selectOption('.dt select.inl[data-k="size"]', { index: 2 }); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/inl-detail.png', fullPage: true });
  // ほかの人の担当は文字だけ
  await p.click('#dtBack'); await p.waitForTimeout(300);
  var other = await p.$$eval('table.lt tr.r', function (rs) { return rs.filter(function (r) { return !r.querySelector('select.inl[data-k="owner"]'); }).length; });
  console.log('直せない行（文字だけ）', other);
  // 担当なしの回答を自分に
  await p.click('#tabs button[data-t="todo"]'); await p.waitForTimeout(400);
  var o = await p.$('select.inl[data-k="owner"]');
  if (o) { var oid = await o.getAttribute('data-id'); await o.selectOption('seko@k-create.co.jp'); await p.waitForTimeout(800); console.log('担当なし→自分', await p.$eval('#toast', function (e) { return e.textContent; })); }
  await p.screenshot({ path: OUT + '/inl-todo.png' });
  console.log('エラー', errs.length ? errs : 'なし');
  await b.close();
})().catch(function (e) { console.error('NG', e.message); process.exit(1); });
