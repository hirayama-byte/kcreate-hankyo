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
ok(/^R\d{21}$/.test(String(sh.data[1][0])), 'IDの形: ' + sh.data[1][0]);

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
throws(function () { suda.saveSales(row.id, { month: '2026/11' }); }, /掲載号/, '掲載号の形');
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

// ---- 担当者専用フォーム・担当の付け替え（2026-11-19） ----
var d0 = suda.init();
ok(d0.myForm === null && d0.people.length === 3 && d0.defaultPh.hankyo.indexOf('10件の応募') === 0, '最初は専用フォームなし・名簿と既定の参考文');
var mf = suda.createMyForm();
ok(/^[a-z0-9]{8}$/.test(mf.token) && mf.url.indexOf('?t=' + mf.token) > 0, '専用フォームを作る: ' + mf.url);
ok(suda.createMyForm().token === mf.token, '2回押しても同じフォーム');
ok(seko.createMyForm().token !== mf.token, '人ごとに別のフォーム');
var cfg = t.post({ action: 'form', t: mf.token });
ok(cfg.ok && cfg.ph.hankyo === '' && !cfg.email && JSON.stringify(cfg).indexOf('suda') < 0, 'フォームの設定（参考文）を返す・担当者のメールは出さない');
ok(t.post({ action: 'form', t: 'nosuchtk' }).ok === false, 'ない印は ok:false');
var sv = suda.saveMyForm({ hankyo: '問い合わせ件数・予約数など', riyu: '', youbou: '=式' });
ok(sv.ph.hankyo === '問い合わせ件数・予約数など' && t.post({ action: 'form', t: mf.token }).ph.hankyo === '問い合わせ件数・予約数など', '参考文を変えるとフォームに出る');
var n0 = t.sheet().getSheetByName('responses').getLastRow();
ok(t.submit({ keisai: '専用フォームの店', sat_hankyo: 4, sat_cost: 4, t: mf.token }).ok, '専用フォームから送信');
ok(t.submit({ keisai: '印がおかしい店', sat_hankyo: 3, sat_cost: 3, t: 'zzzzzzzz' }).ok, '印がおかしくても送れる');
var rows2 = suda.listRows(), via = rows2.filter(function (r) { return r.keisai === '専用フォームの店'; })[0], bad2 = rows2.filter(function (r) { return r.keisai === '印がおかしい店'; })[0];
ok(via.ownerEmail === 'suda@k-create.co.jp' && via.ownerName === '須田 諒治' && via.claimedAt && via.via === mf.token, '専用フォームの回答は最初から担当つき');
ok(bad2.ownerEmail === '' && bad2.via === '', '印がおかしい回答は担当なし（共通フォームと同じ）');
ok(String(t.sheet().getSheetByName('responses').data[0][20]) === 'via', 'via の列の見出し');
var asg = suda.assign(via.id, 'seko@k-create.co.jp');
ok(asg.ownerEmail === 'seko@k-create.co.jp' && asg.ownerName === '瀬古 典子', '担当本人がほかの人に付け替え');
throws(function () { suda.assign(via.id, 'suda@k-create.co.jp'); }, /瀬古/, 'もう担当でない人は付け替えられない');
throws(function () { seko.assign(via.id, 'nobody@k-create.co.jp'); }, /名簿/, '名簿にいない人には付けられない');
ok(hira.assign(via.id, 'suda@k-create.co.jp').ownerEmail === 'suda@k-create.co.jp', '管理者は誰の担当でも付け替えられる');
throws(function () { seko.assign(bad2.id, 'suda@k-create.co.jp'); }, /管理者だけ/, '担当なしの回答をほかの人に付けるのは管理者だけ');
ok(seko.assign(bad2.id, 'seko@k-create.co.jp').ownerEmail === 'seko@k-create.co.jp', '担当なしは自分になら付けられる');

// ---- その場で1項目だけ直す saveField（2026-11-19） ----
var sf = suda.saveField(via.id, 'genre', 'グルメ');
ok(sf.genre === 'グルメ' && sf.ownerEmail === 'suda@k-create.co.jp', '担当本人がジャンルを直す');
var sf2 = suda.saveField(via.id, 'size', '1/4P FO');
ok(sf2.size === '1/4P FO' && sf2.genre === 'グルメ', 'ほかの項目は消えない');
ok(suda.saveField(via.id, 'month', '2026-12').month === '2026-12', '掲載号');
ok(suda.saveField(via.id, 'price', '30,000円').price == 30000, '料金（カンマ・円は取る）');
ok(suda.saveField(via.id, 'memo', '=社内').memo === "'=社内", 'メモの式は無効化');
ok(suda.saveField(via.id, 'genre', '').genre === '', '空にもできる');
throws(function () { suda.saveField(via.id, 'month', '2026-13'); }, /掲載号/, 'おかしな掲載号は断る');
throws(function () { suda.saveField(via.id, 'price', 'abc'); }, /数字/, 'おかしな料金は断る');
throws(function () { suda.saveField(via.id, 'owner_email', 'x'); }, /直せない/, '直せない項目は断る');
throws(function () { seko.saveField(via.id, 'genre', 'グルメ'); }, /須田/, 'ほかの人の担当は直せない');
ok(hira.saveField(via.id, 'media', '江南').media === '江南', '管理者は直せる');
ok(t.submit({ keisai: '担当なしの店', sat_hankyo: 4, sat_cost: 4 }).ok, '共通フォームから送信');
var un = suda.listRows().filter(function (r) { return r.keisai === '担当なしの店'; })[0];
var un2 = seko.saveField(un.id, 'genre', 'グルメ');
ok(un2.ownerEmail === 'seko@k-create.co.jp' && un2.genre === 'グルメ', '担当なしの回答を直すと直した人の担当に');

console.log((fail ? 'FAIL ' : 'ALL OK ') + (n - fail) + '/' + n);
process.exit(fail ? 1 : 0);
