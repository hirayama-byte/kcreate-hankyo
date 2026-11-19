// PW=<playwright> node test/contextmenu.js — 一覧の表の右クリック「コピー」「ここに貼り付け」（公開サンプルで確認）
var pw = require(process.env.PW), path = require('path');
var root = path.join(__dirname, '..');
(async function () {
  var b = await pw.chromium.launch({ channel: 'chrome' }), errs = [], fail = 0;
  function check(c, m) { console.log((c ? 'OK ' : 'NG ') + m); if (!c) fail++; }
  var p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto('file:///' + path.join(root, 'docs/sample/index.html').replace(/\\/g, '/')); await p.waitForTimeout(1500);
  await p.click('#tabs button:has-text("一覧")'); await p.waitForTimeout(400);
  check(await p.isVisible('.cphint'), '表の上に使い方');
  var vals = function (k) { return p.$$eval('table.lt select.inl[data-k=' + k + ']', function (l) { return l.map(function (e) { return e.value; }); }); };
  var cells = function (k) { return p.$$('table.lt select.inl[data-k=' + k + ']'); };
  var g = await vals('genre'), src = g.findIndex(Boolean), emp = g.findIndex(function (v) { return !v; });
  var c = await cells('genre');
  await c[src].click({ button: 'right' }); await p.waitForSelector('#cm');
  await p.screenshot({ path: path.join(root, 'test', 'shots', 'cm-copy.png') });
  await p.click('#cm button[data-cm=copy]');
  check(!(await p.$('#cm')), 'メニューが閉じる');
  c = await cells('genre'); await c[emp].click({ button: 'right' }); await p.waitForSelector('#cm');
  check(/ここに貼り付け/.test(await p.textContent('#cm')), '貼り付けが出る');
  await p.click('#cm button[data-cm=paste]'); await p.waitForTimeout(1200);
  check((await vals('genre'))[emp] === g[src], '右クリックで貼れた: ' + g[src]);
  // Shift で3つ選んで右クリック → まとめて
  var mv = await vals('size'), ms = mv.findIndex(Boolean);
  c = await cells('size'); await c[ms].click({ button: 'right' }); await p.click('#cm button[data-cm=copy]');
  c = await cells('size'); await c[10].focus(); await c[12].click({ modifiers: ['Shift'] });
  c = await cells('size'); await c[11].click({ button: 'right' }); await p.waitForSelector('#cm');
  check(/選んだ 3 か所に貼り付け/.test(await p.textContent('#cm')), 'まとめて貼り付けが出る');
  await p.screenshot({ path: path.join(root, 'test', 'shots', 'cm-multi.png') });
  await p.click('#cm button[data-cm=paste]'); await p.waitForTimeout(2000);
  var mv2 = await vals('size'); check(mv2.slice(10, 13).every(function (v) { return v === mv[ms]; }), '3か所に貼れた: ' + mv2.slice(10, 13).join(','));
  // 左クリックはいつもどおり（メニューは出ない）
  c = await cells('genre'); await c[2].click(); await p.waitForTimeout(200); await p.keyboard.press('Escape');
  check(!(await p.$('#cm')), '左クリックではメニューが出ない');
  check(!errs.length, 'エラーなし ' + errs.join(' / '));
  await b.close(); console.log(fail ? 'NG ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
