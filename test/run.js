// node test/run.js — フォームの受け口と管理サイトのサーバー側を偽スプレッドシートで確かめる
var E = require('./env.js');
var fail = 0, n = 0;
function ok(c, m) { n++; if (!c) { fail++; console.log('NG ' + m); } else console.log('OK ' + m); }
function throws(fn, re, m) { try { fn(); ok(false, m + '（エラーにならない）'); } catch (e) { ok(re.test(e.message), m + ': ' + e.message); } }

var t = E.make();
// ---- フォーム ----
ok(t.submit({ keisai: '', sat_hankyo: 5, sat_cost: 4 }).error === '掲載名を入力してください', '掲載名なしは受け付けない');
ok(/満足度/.test(t.submit({ keisai: 'A', sat_hankyo: 0, sat_cost: 4 }).error), '満足度なしは受け付けない');
ok(/満足度/.test(t.submit({ keisai: 'A', sat_hankyo: 6, sat_cost: 4 }).error), '満足度は1〜5だけ');
ok(t.submit({ keisai: 'ロボ', sat_hankyo: 5, sat_cost: 5, website: 'http://spam' }).ok === true, 'わなに入った送信は「成功」と返す');
ok(!t.sheet().getSheetByName('responses'), 'わなに入った送信はためない');
var r1 = t.submit({ keisai: '〇〇整骨院', sat_hankyo: 5, hankyo: '10件の問い合わせがありました', sat_cost: 4, riyu: '費用対効果満足度が得られた', youbou: '次回も掲載したい' });
ok(r1.ok, 'ふつうの送信: ' + JSON.stringify(r1));
t.submit({ keisai: '=HYPERLINK("x")', sat_hankyo: 2, hankyo: '+怪しい', sat_cost: 1 });
t.submit({ keisai: 'カフェ ノクト', sat_hankyo: 4, hankyo: '来店が増えた', sat_cost: 3 });
var sh = t.sheet().getSheetByName('responses');
ok(sh && sh.getLastRow() === 4, 'responses に3件（見出し＋3行）');
ok(String(sh.data[2][2]).charAt(0) === "'", '式に見える掲載名は文字として入れる');
ok(t.sheet().getSheetByName('シート1') == null, '最初の空シートは消える');
ok(/^R\d{15}$/.test(String(sh.data[1][0])), 'IDの形: ' + sh.data[1][0]);

// ---- 管理サイト ----
var hira = t.as('hirayama@k-create.co.jp'), suda = t.as('suda@k-create.co.jp'), seko = t.as('seko@k-create.co.jp');
var d = suda.init();
ok(d.me.name === '須田 諒治' && d.me.isAdmin === false, '名前はQR管理の名簿から・管理者でない');
ok(d.rows.length === 3, '全員が全部見られる（3件）');
ok(d.masters.genres.length === 10 && d.masters.media.indexOf('一宮') >= 0 && d.masters.sizes.indexOf('1/4P AD') >= 0, '候補の初期値');
ok(d.sheetUrl === '', '管理者でない人にはシートのURLを出さない');
var dh = hira.init();
ok(dh.me.isAdmin === true && dh.sheetUrl, '平山さんは管理者');
var row = d.rows.filter(function (r) { return r.keisai === '〇〇整骨院'; })[0];
ok(row.keisai === '〇〇整骨院' && row.satHankyo === 5 && row.hankyo.indexOf('10件') === 0 && row.ownerEmail === '', '回答の中身');
var bad = d.rows.filter(function (r) { return /HYPERLINK/.test(r.keisai); })[0];
ok(bad.keisai === '=HYPERLINK("x")', '画面には元の文字で出す');
var c = suda.claim(row.id);
ok(c.ownerEmail === 'suda@k-create.co.jp' && c.ownerName === '須田 諒治' && c.claimedAt, '自分の担当にする');
throws(function () { seko.claim(row.id); }, /須田/, 'ほかの人の担当は取れない');
throws(function () { seko.saveSales(row.id, { genre: 'グルメ' }); }, /須田/, 'ほかの人の担当の情報は直せない');
var s = suda.saveSales(row.id, { genre: 'クリニック', month: '2026-11', media: '一宮', size: '1/4P AD', price: '30,000', memo: '次回2回で提案' });
ok(s.genre === 'クリニック' && s.month === '2026-11' && s.media === '一宮' && s.size === '1/4P AD' && s.price === 30000 && s.memo === '次回2回で提案', '担当の情報を入れる: ' + JSON.stringify([s.month, s.price]));
throws(function () { suda.saveSales(row.id, { month: '2026/11' }); }, /掲載月/, '掲載月の形');
throws(function () { suda.saveSales(row.id, { price: '三万' }); }, /数字/, '料金は数字');
var other = d.rows.filter(function (r) { return r.keisai === 'カフェ ノクト'; })[0];
var s2 = seko.saveSales(other.id, { genre: 'グルメ', month: '2026-10', media: '江南' });
ok(s2.ownerEmail === 'seko@k-create.co.jp', '担当なしで情報を入れた人が担当になる');
ok(hira.saveSales(other.id, { genre: 'グルメ', month: '2026-10', media: '江南', size: '1/8P FO' }).size === '1/8P FO', '管理者はほかの人の担当も直せる');
throws(function () { suda.release(other.id); }, /担当の人か管理者/, 'ほかの人の担当ははずせない');
ok(seko.release(other.id).ownerEmail === '', '本人は担当をはずせる');
throws(function () { suda.removeRow(bad.id); }, /担当の人か管理者/, '担当なしの回答は管理者だけが削除');
ok(hira.removeRow(bad.id).ok, '管理者は削除できる');
ok(suda.listRows().length === 2 && hira.listRows().length === 3, '削除したものは管理者にだけ見える');
throws(function () { suda.restoreRow(bad.id); }, /管理者/, '戻すのは管理者だけ');
ok(hira.restoreRow(bad.id).deleted === '', '管理者は戻せる');
throws(function () { suda.saveMaster('media', ['一宮']); }, /管理者/, '候補を直すのは管理者だけ');
ok(hira.saveMaster('media', ['一宮', '江南', '一宮', '稲沢', ' ']).join() === '一宮,江南,稲沢', '候補を直す（重複・空は除く）');
ok(suda.init().masters.media.join() === '一宮,江南,稲沢', '直した候補がみんなに出る');
throws(function () { suda.claim('xxx'); }, /ID/, 'おかしなIDは断る');

console.log((fail ? 'FAIL ' : 'ALL OK ') + (n - fail) + '/' + n);
process.exit(fail ? 1 : 0);
