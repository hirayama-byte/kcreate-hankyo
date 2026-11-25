// PW=<playwright> node test/kanri-ui.js [URL] — 「情報読込」ボタンと結果の画面を確かめる（node test/serve.js 8831 --seed を先に起動）
var pw = require(process.env.PW), path = require('path'), fs = require('fs');
var U = process.argv[2] || 'http://localhost:8831', out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
(async function () {
  var b = await pw.chromium.launch({ channel: 'chrome' }), fail = 0, errs = [];
  function check(c, m) { console.log((c ? 'OK ' : 'NG ') + m); if (!c) fail++; }
  var ac = await b.newContext({ viewport: { width: 1280, height: 860 } });
  var a = await ac.newPage(); a.on('pageerror', function (e) { errs.push(e.message); });
  await a.goto(U + '/admin/?as=suda@k-create.co.jp'); await a.waitForSelector('#kanriBtn');
  check(/情報読込/.test(await a.textContent('#kanriBtn')), '未割り当ての画面に「情報読込」ボタン');
  await a.screenshot({ path: path.join(out, 'kanri-button.png') });
  await a.click('#kanriBtn'); await a.waitForSelector('#kdlg[open]');
  var txt = await a.textContent('#kdlg');
  check(/件の回答に、担当の情報を入れました/.test(txt), '結果の画面が出る');
  check(/ほっと訪問介護/.test(txt) && /一宮・江南版/.test(txt) && /50,000円/.test(txt) && /瀬古 典子/.test(txt), '入れた中身が出る（媒体・料金・担当）');
  check(/一部の項目が入らなかった/.test(txt) && /1\/3/.test(txt), '入らなかった項目と理由が出る');
  await a.screenshot({ path: path.join(out, 'kanri-result.png') });
  await a.click('#kClose');
  await a.click('#tabs button[data-t=list]'); await a.waitForSelector('#kanriBtn');
  check(/一宮・江南版/.test(await a.textContent('main')), '閉じると一覧に反映されている');
  check(errs.length === 0, '画面のエラーなし ' + errs.join(' | '));
  await b.close(); console.log(fail ? 'FAIL' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
