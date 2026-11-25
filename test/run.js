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

// ---- 情報読込（管理表から担当の情報を入れる・2026-11-25） ----
(function () {
  var GasMock = require('./gas-mock.js'), K = require('./kanri-fixture.js');
  var k = E.make({ members: [['hirayama@k-create.co.jp', '平山 竜也'], ['suda@k-create.co.jp', '須田 諒治'], ['seko@k-create.co.jp', '瀬古 典子'], ['yamada1@k-create.co.jp', '山田 太郎'], ['yamada2@k-create.co.jp', '山田 花子']] });
  K.build(k.store, GasMock.Spreadsheet, K.FOLDER, {
    '一宮版': {
      '26.9月号': [['瀬古', 'トータルケア', 'ご褒美ケア', 'アノン_わんだーらんど', '1/8', '定型', '', '20,000']],
      '26.10月号': [['瀬古', 'グルメ', '忘年会', '甲羅本店_サカエ商事', '1/8', '定型', '', '99,999']],
      '26.11月号': [
        ['瀬古', 'グルメ', '忘年会', '甲羅本店_サカエ商事', '1/4', '定型', '', '75,000'],
        ['瀬古', 'スクール', 'スクール', '明海学院_スクールメイカー', '1', 'フリー', '', '225,000'],
        ['瀬古', 'トータルケア', 'ご褒美ケア', 'しんそう一宮新生', '1/4', 'フリー', '', '72,728'],
        ['瀬古', '暮らし', '暮らし', '北斗_不動産', '1', 'フリー', '', '220,000'],
        ['瀬古', '暮らし', '暮らし', '北斗_外構', '1', 'フリー', '', '220,000'],
        ['瀬古', '暮らし', '住もうね', 'モリ塗装', '1/2', 'フリー', '', '140,400'],
        ['瀬古', '求人', '求人', 'Q&S', '1/3', 'フリー', '30,000', '248,000'],
        ['瀬古', 'ショップ', 'ショップ', '仲根工業', '1', 'フリー', '', '225,000'],
        ['山田', 'トータルケア', 'ご褒美ケア', 'はやき_ジンハウス', '1/8', '定型', '', '20,000'],
        ['', '', '', '', '', '', '', ''],
        ['瀬古', 'グルメ', '', '', '1/4', '定型', '', '50,000']
      ],
      '26.12月号': [['瀬古', 'グルメ', '忘年会', '甲羅本店_サカエ商事', '1', 'フリー', '', '300,000'], ['瀬古', 'グルメ', '忘年会', '弥助寿司', '1/6', '定型', '', '57,000']],
      '24.1月号': [['瀬古', 'グルメ', '', '古い号の店', '1/8', '定型', '', '1']]
    },
    '江南版': { '26.11月号': [['須田', 'グルメ', '忘年会', '甲羅本店_サカエ商事', '1/2', 'フリー', '', '100,000']] },
    '北区版': { '26.11月号': [['瀬古', 'トータルケア', '', 'アノン_わんだーらんど', '1/4', '定型', '', '30,000']] }
  });
  var kanriSnap = function () { return JSON.stringify(Object.keys(k.store).filter(function (id) { return /^kanri-/.test(id); }).map(function (id) { return k.store[id].sheets.map(function (s) { return [s.name, s.data]; }); })); };
  var snap = kanriSnap();
  var at = { '甲羅本店': '2026-11-20 10:00', '（株）スクール・メイカー': '2026-11-21 09:00', '甲羅': '2026-11-20 11:00', 'しんそう一宮新生': '2026-11-20 12:00', 'モリ塗装': '2026-11-22 12:00',
    'わんだーらんど': '2026-10-15 12:00', '弥助寿司': '2026-11-10 12:00', 'Ｑ＆Ｓ': '2026-11-23 12:00', '北斗': '2026-11-24 12:00', '仲根工業': '2026-11-24 13:00', 'はやき': '2026-11-24 14:00' };
  Object.keys(at).forEach(function (nm) { k.submit({ keisai: nm, sat_hankyo: 4, sat_cost: 4 }); });
  var rs = k.sheet().getSheetByName('responses');
  for (var i = 1; i < rs.data.length; i++) rs.data[i][1] = at[String(rs.data[i][2])];
  var kh = k.as('hirayama@k-create.co.jp'), ks = k.as('suda@k-create.co.jp');
  var byName = function (who) { var m = {}; who.listRows().forEach(function (r) { m[r.keisai] = r; }); return m; };
  kh.init(); var b0 = byName(kh);
  ks.saveField(b0['しんそう一宮新生'].id, 'genre', 'クリニック'); // 1つでも入っていれば触らない
  ks.claim(b0['モリ塗装'].id);                                     // 担当だけ先に決まっている
  kh.removeRow(b0['仲根工業'].id);                                  // 削除した回答は対象外
  throws(function () { k.store['kanri-一宮版-2026'].getSheetByName('26.11月号').getRange(2, 1).setValue('x'); }, /読み取り専用/, '偽の管理表は書き込めない（書いたらテストが落ちる）');

  var res = ks.loadFromKanri(); // 管理者でなくても押せる
  var b = byName(kh);
  var koura = b['甲羅本店'];
  ok(koura.month === '2026-11' && koura.media === '一宮・江南' && koura.price === 175000 && koura.genre === 'グルメ' && koura.size === '1/4P FO・1/2P AD', '複数の版: 媒体は「・」でつなぎ料金は合計・サイズも違えばつなぐ: ' + JSON.stringify([koura.month, koura.media, koura.price, koura.size]));
  ok(koura.ownerEmail === 'seko@k-create.co.jp' && koura.ownerName === '瀬古 典子' && koura.claimedAt && koura.updated, '担当が空なら管理表の担当者（苗字）から名簿の人を入れる');
  ok(koura.price !== 99999 && koura.price !== 300000, '前の号（10月）・回答日より後の号（12月）は使わない');
  var sm = b['（株）スクール・メイカー'];
  ok(sm.genre === 'スクール' && sm.size === '1P' && sm.price === 225000 && sm.media === '一宮', '「_」で区切った部分と一致・（株）や記号をそろえて比べる・1 → 1P: ' + JSON.stringify([sm.genre, sm.size, sm.price]));
  ok(!b['甲羅'].month && !b['甲羅'].media && res.notFound.some(function (x) { return x.keisai === '甲羅'; }), '店名の一部だけ（甲羅）では当てない');
  var sh2 = b['しんそう一宮新生'];
  ok(sh2.genre === 'クリニック' && !sh2.month && !sh2.size && sh2.price === '' && sh2.ownerEmail === 'suda@k-create.co.jp', '1つでも入っている回答は上書きしない');
  var mori = b['モリ塗装'];
  ok(mori.ownerEmail === 'suda@k-create.co.jp' && mori.size === '1/2P AD' && mori.price === 140400, '担当が入っている回答は担当を変えない（ほかの項目は入る）');
  ok(!res.partial.some(function (x) { return x.keisai === 'モリ塗装'; }), '担当が入っている回答には担当の注意を出さない');
  var wd = b['わんだーらんど'];
  ok(wd.month === '2026-09' && wd.size === '1/8P FO' && wd.price === 20000 && wd.media === '一宮', '回答日の月かそれより前で、いちばん新しい号を使う（後の26.11月号は使わない）: ' + wd.month);
  ok(!b['弥助寿司'].month && res.notFound.some(function (x) { return x.keisai === '弥助寿司'; }), '回答日より後の号にしかない店は「見つからなかった」');
  var qs = b['Ｑ＆Ｓ'], qp = res.partial.filter(function (x) { return x.keisai === 'Ｑ＆Ｓ'; })[0];
  ok(qs.genre === '' && qs.size === '' && qs.month === '2026-11' && qs.price === 248000 && qp && qp.reasons.some(function (w) { return /求人/.test(w); }) && qp.reasons.some(function (w) { return /1\/3/.test(w); }), '候補にないジャンル・サイズは空のまま・理由を返す（料金は掲載料の列だけ）: ' + JSON.stringify(qp && qp.reasons));
  var hk = b['北斗'];
  ok(hk.price === 440000 && hk.size === '1P', '同じ版・同じ号に同じ店が2行 → 料金は合計: ' + hk.price);
  ok(!b['仲根工業'].month && b['仲根工業'].price === '' && !res.filled.concat(res.partial, res.notFound).some(function (x) { return x.keisai === '仲根工業'; }), '削除した回答は対象外');
  var hy = b['はやき'], hp = res.partial.filter(function (x) { return x.keisai === 'はやき'; })[0];
  ok(hy.ownerEmail === '' && hy.size === '1/8P FO' && hp && /複数/.test(hp.reasons.join()), '担当者の苗字が名簿で1人に決まらなければ担当は空のまま');
  ok(res.filled.length === 7 && res.notFound.length === 2 && res.targets === 9, '件数: 入れた' + res.filled.length + '・見つからない' + res.notFound.length + '・対象' + res.targets);
  ok(res.filled.filter(function (x) { return x.keisai === '甲羅本店'; })[0].set.owner === '瀬古 典子', '結果に入れた中身（担当も）が出る');
  ok(kanriSnap() === snap, '管理表は1文字も変わっていない');
  var ich = k.store['kanri-一宮版-2026'];
  ok(ich.getSheetByName('26.11月号').reads === 1 && !ich.getSheetByName('26.12月号').reads && !ich.getSheetByName('24.1月号').reads && !ich.getSheetByName('状況').reads && !ich.getSheetByName('営業一覧').reads, '号のタブは1回だけ読む・回答日より後の号・古すぎる号・ほかのタブは読まない');
  ok(res.read.editions.join() === '一宮版,江南版,北区版' && res.read.tabs === 5, '読んだ版・タブ: ' + res.read.editions.join() + ' ' + res.read.tabs);
  var res2 = ks.loadFromKanri();
  ok(res2.filled.length === 0 && res2.targets === 2, '2回目は入れたものを触らない（対象' + res2.targets + '件）');
  // 北区版（媒体の候補にない）だけにある店
  var k2 = E.make();
  K.build(k2.store, GasMock.Spreadsheet, K.FOLDER, { '一宮版': { '26.11月号': [] }, '北区版': { '26.11月号': [['瀬古', 'グルメ', '', 'きたく食堂', '1/4', 'フリー', '', '50,000']] } });
  k2.submit({ keisai: 'きたく食堂', sat_hankyo: 4, sat_cost: 4 });
  k2.sheet().getSheetByName('responses').data[1][1] = '2026-11-25 10:00';
  var r2 = k2.as('seko@k-create.co.jp').loadFromKanri(), x2 = k2.as('seko@k-create.co.jp').listRows()[0];
  ok(x2.media === '' && x2.month === '2026-11' && x2.genre === 'グルメ' && x2.price === 50000 && x2.size === '1/4P AD' && /北区版/.test(r2.partial[0].reasons.join()), '媒体の候補にない版（北区版）は媒体を空のまま・理由を返す');
  // settings の kanri_folders が優先される・フォルダが開けなければ知らせる
  var k3 = E.make(); k3.submit({ keisai: 'どこかの店', sat_hankyo: 4, sat_cost: 4 }); k3.as('hirayama@k-create.co.jp').init();
  k3.sheet().getSheetByName('settings').appendRow(['kanri_folders', 'nosuchfolder']);
  var r3 = k3.as('hirayama@k-create.co.jp').loadFromKanri();
  ok(r3.filled.length === 0 && /フォルダを開けません/.test(r3.warn.join()) && /見つかりません/.test(r3.warn.join()), '管理表が見つからないときは知らせる: ' + r3.warn.join(' / '));
})();

console.log((fail ? 'FAIL ' : 'ALL OK ') + (n - fail) + '/' + n);
process.exit(fail ? 1 : 0);
