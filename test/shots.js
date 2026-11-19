// PW=<playwright> node test/shots.js — フォームと管理サイトの画面を撮る（test/shots/）＋簡単な動作確認
var pw = require(process.env.PW), path = require('path'), fs = require('fs');
var U = process.argv[2] || 'http://localhost:8820', out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
(async function () {
  var b = await pw.chromium.launch({ channel: 'chrome' }), fail = 0, errs = [];
  function check(c, m) { console.log((c ? 'OK ' : 'NG ') + m); if (!c) fail++; }
  // フォーム（スマホ）
  var p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto(U + '/form/'); await p.screenshot({ path: path.join(out, 'form-top.png'), fullPage: true });
  var ph = await p.$eval('#hankyo', function (e) { return e.placeholder; });
  check(/10件の応募/.test(ph), '参考文がグレーで出る（placeholder）');
  await p.click('#send'); await p.waitForTimeout(300);
  check(await p.$$eval('.q.bad', function (l) { return l.length; }) === 3, '未入力の必須3つに印');
  await p.fill('#keisai', 'テスト整骨院'); await p.click('.scale[data-name=sat_hankyo] label:nth-child(1)'); await p.click('.scale[data-name=sat_cost] label:nth-child(2)');
  await p.fill('#hankyo', '問い合わせが3件'); await p.screenshot({ path: path.join(out, 'form-filled.png'), fullPage: true });
  await p.click('#send'); await p.waitForSelector('#done', { state: 'visible' });
  await p.screenshot({ path: path.join(out, 'form-done.png') });
  check(true, '送信できる');
  // 管理サイト（PC）
  var ac = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ac.addInitScript(function () { try { localStorage.setItem('hankyo-view2', 'card'); } catch (x) {} }); // ここの確認はカード表示で（表は test/inline.js）
  var a = await ac.newPage(); a.on('pageerror', function (e) { errs.push(e.message); });
  await a.goto(U + '/admin/?as=seko@k-create.co.jp'); await a.waitForSelector('.rc');
  check(/未割り当て/.test(await a.textContent('#tabs button.on')), '未割り当てがあれば最初に出る');
  await a.screenshot({ path: path.join(out, 'admin-todo.png'), fullPage: true });
  var n0 = await a.$$eval('.rc', function (l) { return l.length; });
  await a.click('.rc:has-text("テスト整骨院") button[data-a=claim]'); await a.waitForSelector('dialog[open]');
  await a.selectOption('#dGenre', 'クリニック'); await a.selectOption('#dMonth', '2026-11'); await a.selectOption('#dMedia', '一宮'); await a.selectOption('#dSize', '1/4P AD'); await a.fill('#dPrice', '30000');
  await a.screenshot({ path: path.join(out, 'admin-edit.png') });
  await a.click('#dSave'); await a.waitForSelector('dialog[open]', { state: 'detached' }).catch(function () {}); await a.waitForTimeout(400);
  check(!(await a.$('dialog[open]')), '担当の情報を保存');
  await a.click('#tabs button[data-t=list]'); await a.waitForTimeout(200);
  await a.screenshot({ path: path.join(out, 'admin-list.png'), fullPage: true });
  check((await a.textContent('.rc:has-text("テスト整骨院")')).indexOf('瀬古') >= 0, '一覧に担当が出る');
  // 回答の詳細（カードを押すと全文・戻る）
  var long = await a.$('.rc:has-text("テスト整骨院")'); await long.click({ position: { x: 20, y: 60 } }); await a.waitForSelector('.dt');
  check((await a.textContent('#pageTitle')) === '回答の詳細' && /掲載号/.test(await a.textContent('.dt')), 'カードを押すと詳細');
  await a.screenshot({ path: path.join(out, 'admin-detail.png'), fullPage: true });
  await a.click('#dtBack'); await a.waitForSelector('.rc');
  check(!(await a.$('.dt')), '戻ると一覧');
  var btnCount = await a.locator('.rc:has-text("テスト整骨院")').first().locator('button').count();
  check(btnCount <= 4, 'ボタンが重複していない（' + btnCount + '）');
  await a.click('#tabs button[data-t=stats]'); await a.waitForTimeout(200);
  await a.screenshot({ path: path.join(out, 'admin-stats.png'), fullPage: true });
  check(await a.$$eval('table.st tr', function (l) { return l.length; }) > 2, '分析の表');
  await a.click('button[data-by=media]'); await a.waitForTimeout(150);
  await a.click('#tabs button[data-t=cases]'); await a.waitForTimeout(200);
  await a.screenshot({ path: path.join(out, 'admin-cases.png'), fullPage: true });
  await a.click('#tabs button[data-t=settings]'); await a.waitForTimeout(800);
  await a.screenshot({ path: path.join(out, 'admin-settings.png'), fullPage: true });
  var mc = await b.newContext({ viewport: { width: 390, height: 844 } }); await mc.addInitScript(function () { try { localStorage.setItem('hankyo-view2', 'card'); } catch (x) {} });
  var mp = await mc.newPage(); mp.on('pageerror', function (e) { errs.push(e.message); });
  await mp.goto(U + '/admin/?as=suda@k-create.co.jp'); await mp.waitForSelector('.rc'); await mp.screenshot({ path: path.join(out, 'admin-phone.png') });
  check(errs.length === 0, '画面のエラーなし ' + errs.join(' | '));
  await b.close(); console.log(fail ? 'FAIL' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
