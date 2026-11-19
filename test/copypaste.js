// PW=<playwright> node cp-test.js <hankyo-jirei dir>
var pw = require(process.env.PW), path = require('path');
var root = process.argv[2];
(async function () {
  var b = await pw.chromium.launch({ channel: 'chrome' }), errs = [], fail = 0;
  function check(c, m) { console.log((c ? 'OK ' : 'NG ') + m); if (!c) fail++; }
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  var p = await ctx.newPage(); p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto('file:///' + path.join(root, 'docs/sample/index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(1500);
  var tabs = await p.$$eval('#tabs button', function (l) { return l.map(function (b) { return b.textContent.trim(); }); }); console.log('tabs', tabs.join('|'));
  await p.click('#tabs button:has-text("一覧")'); await p.waitForTimeout(400);
  if (!(await p.$('table.lt'))) {
    var segs = await p.$$eval('.seg button, .seg2 button', function (l) { return l.map(function (b) { return b.textContent.trim() + ':' + JSON.stringify(b.dataset); }); }); console.log('segs', segs.join(' | '));
    var tb = await p.$('.seg2 button:has-text("表"), .seg button:has-text("表")'); if (tb) await tb.click(); await p.waitForTimeout(400);
  }
  var colVals = function (k) { return p.$$eval('table.lt select.inl[data-k=' + k + ']', function (l) { return l.map(function (e) { return e.value; }); }); };
  var cells = function (k) { return p.$$('table.lt select.inl[data-k=' + k + ']'); };
  var before = await colVals('genre'); console.log('genre cells', before.length, before.slice(0, 8).join(','));
  var src = before.findIndex(function (v) { return v; }), empt = before.map(function (v, i) { return v ? -1 : i; }).filter(function (i) { return i >= 0; });
  console.log('src', src, 'empties', empt.join(','));
  var g = await cells('genre');
  await g[src].focus(); await p.keyboard.press('Control+c');
  check(await g[src].evaluate(function (e) { return e.classList.contains('ccp'); }), 'コピー元に点線');
  if (empt.length) {
    var t1 = empt[0]; g = await cells('genre'); await g[t1].focus(); await p.keyboard.press('Control+v'); await p.waitForTimeout(1000);
    var after = await colVals('genre'); check(after[t1] === before[src], '1つに貼れた: ' + after[t1]);
  }
  // Shift で縦4つ → まとめて貼る（媒体）
  var mv = await colVals('media'), ms = mv.findIndex(function (v) { return v; }); console.log('media src', mv[ms]);
  var m = await cells('media'); await m[ms].focus(); await p.keyboard.press('Control+c');
  m = await cells('media'); await m[0].focus(); await m[3].click({ modifiers: ['Shift'] });
  check((await p.$$eval('select.inl.csel', function (l) { return l.length; })) === 4, 'Shift で4つ選べる');
  await p.screenshot({ path: path.join(root, 'test', 'shots', 'copypaste-select.png') });
  await p.keyboard.press('Control+v'); await p.waitForTimeout(2000);
  var mv2 = await colVals('media');
  check(mv2.slice(0, 4).every(function (v) { return v === mv[ms]; }), '4つまとめて貼れた: ' + mv2.slice(0, 4).join(','));
  // Excel の文字（縦に2行）
  await p.evaluate(function () { return navigator.clipboard.writeText('2026年10月号\r\n2026/9\r\n'); });
  var mo = await cells('month'); await mo[5].focus(); await p.keyboard.press('Control+v'); await p.waitForTimeout(2000);
  var mo2 = await colVals('month');
  check(mo2[5] === '2026-10' && mo2[6] === '2026-09', 'Excelの文字を下へ順に: ' + mo2[5] + ',' + mo2[6]);
  await p.evaluate(function () { return navigator.clipboard.writeText('ぜんぜん違う'); });
  var ge = await cells('genre'); await ge[1].focus(); await p.keyboard.press('Control+v'); await p.waitForTimeout(600);
  var tt = await p.$eval('body', function (bd) { return bd.innerText; }); check(/選択肢にない値/.test(tt), '選択肢にない値はお知らせ');
  await p.keyboard.press('Escape');
  check((await p.$$('select.inl.csel, select.inl.ccp')).length === 0, 'Esc で解除');
  await p.screenshot({ path: path.join(root, 'test', 'shots', 'copypaste-after.png') });
  check(!errs.length, 'エラーなし ' + errs.join(' / '));
  await b.close(); console.log(fail ? 'NG ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
