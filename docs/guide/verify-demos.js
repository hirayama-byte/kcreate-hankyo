// PW=<playwright> node docs/guide/verify-demos.js <出力フォルダ> [幅=1280] [demo-id ...] — 「動きで見る」を全手順止めて撮り、デモごとに1枚の一覧（contact sheet）にする
// ポインターの先が押す場所に乗っているかを目で確かめる用。あわせてエラー・横はみ出し・画像の読み込み・写真の外を指していないかを確かめる
// 問題があれば最後に NG を出して終了コード 1
var pw = require(process.env.PW || 'playwright'), path = require('path'), url = require('url'), fs = require('fs');
(async function () {
  var outDir = process.argv[2], w = Number(process.argv[3] || 1280), only = process.argv.slice(4);
  if (!outDir) throw new Error('出力フォルダを指定してください');
  fs.mkdirSync(outDir, { recursive: true });
  var b = await pw.chromium.launch({ channel: 'chrome' });
  var p = await b.newPage({ viewport: { width: w, height: 900 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); }); p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', function (r) { errs.push('failed ' + r.url()); });
  await p.goto(url.pathToFileURL(path.join(__dirname, 'index.html')).href);
  await p.waitForTimeout(500);
  // 画像を全部読み込ませる（lazy を外す）。切り替えで出る写真も全部読めるか確かめる
  await p.evaluate(function () { document.querySelectorAll('img[loading=lazy]').forEach(function (i) { i.loading = 'eager'; }); });
  await p.waitForTimeout(1500);
  var bad = await p.evaluate(function () { return [].filter.call(document.images, function (i) { return !i.complete || !i.naturalWidth; }).map(function (i) { return i.src; }); });
  var srcs = await p.evaluate(function () { var s = {}; document.querySelectorAll('.demo script[type="application/json"]').forEach(function (j) { JSON.parse(j.textContent).images.forEach(function (m) { s[m.src] = 1; }); }); return Object.keys(s); });
  srcs.forEach(function (s) { if (!fs.existsSync(path.join(__dirname, s))) bad.push(s); });
  var ids = await p.evaluate(function () { return window.__demoIds; });
  var report = { width: w, demos: ids.length, images: srcs.length, badImages: bad, overflow: await p.evaluate(function () { return document.documentElement.scrollWidth - innerWidth; }), outside: [], played: 0, steps: 0 };
  for (var id of ids) {
    if (only.length && only.indexOf(id) < 0) continue;
    var data = await p.evaluate(function (id) { return JSON.parse(document.querySelector('.demo[data-demo="' + id + '"] script[type="application/json"]').textContent); }, id);
    data.steps.forEach(function (s, k) { [[s.x, s.y]].concat((s.more || []).map(function (m) { return [m.x, m.y]; })).forEach(function (xy) { if (!(xy[0] >= 0 && xy[0] <= 100 && xy[1] >= 0 && xy[1] <= 100)) report.outside.push(id + ' ' + (k + 1)); }); });
    var n = data.steps.length, shots = [];
    await p.locator('.demo[data-demo="' + id + '"]').scrollIntoViewIfNeeded();
    for (var k = 0; k < n; k++) {
      var info = await p.evaluate(function (a) { return window.__demoGo(a[0], a[1]); }, [id, k]);
      if (!info) { errs.push('再生できない ' + id + ' ' + (k + 1)); continue; }
      await p.waitForTimeout(120);
      var buf = await p.locator('.demo[data-demo="' + id + '"] .stage').screenshot();
      var t = await p.evaluate(function (a) { return document.querySelectorAll('.demo[data-demo="' + a[0] + '"] ol.steps li')[a[1]].textContent; }, [id, k]);
      shots.push({ k: k + 1, t: t, b64: buf.toString('base64') });
      report.steps++;
    }
    if (shots.length === n) report.played++;
    if (!shots.length) continue;
    // 1枚にまとめる
    var sheet = await b.newPage({ viewport: { width: 1600, height: 900 } });
    await sheet.setContent('<body style="margin:0;font:13px sans-serif;background:#fff"><div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px">' + shots.map(function (s) { return '<div style="max-width:' + (w < 600 ? 360 : 780) + 'px"><div style="font-weight:700;margin-bottom:4px">' + s.k + '. ' + s.t + '</div><img style="max-width:100%;border:1px solid #ccc" src="data:image/png;base64,' + s.b64 + '"></div>'; }).join('') + '</div></body>');
    await sheet.waitForTimeout(200);
    await sheet.screenshot({ path: path.join(outDir, 'sheet-' + w + '-' + id + '.png'), fullPage: true });
    await sheet.close();
  }
  report.overflow = Math.max(report.overflow, await p.evaluate(function () { return document.documentElement.scrollWidth - innerWidth; }));
  report.errors = errs;
  console.log(JSON.stringify(report));
  var ok = !bad.length && report.overflow <= 0 && !report.outside.length && !errs.length && report.played === (only.length ? only.length : ids.length);
  console.log(ok ? 'OK ' + report.played + '/' + ids.length + ' デモ・' + report.steps + ' 手順' : 'NG');
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
