// 反響事例管理 — 管理サイト（社内のみ）
// デプロイ: ウェブアプリ / 実行ユーザー=自分 / アクセス=ドメイン内のユーザー
// 全員が全部見られる。担当の情報（ジャンル・掲載号・媒体・サイズ・料金）を入れる／直す／消すのは担当本人と管理者

var TZ = 'Asia/Tokyo';
var SHEET_ID = '1w-4FIkRfEjiCEo6LwKKb8CoXMOvT7_c6ASFpVkrO3ks'; // 反響事例管理データ（フォームの受け口 gas-api の親）
var QR_SHEET_ID = '1riYm2WOMEeZBq0Te6BsqBumQFvPji9oYuZa8c6_So0o'; // 名前はQR管理の members（社内スタッフ名簿から流し込み済み）を借りる
var ADMIN_EMAIL = 'hirayama@k-create.co.jp';
// responses シートの列（gas-api と同じ並び）
var RESP_HEAD = ['id', 'at', 'keisai', 'sat_hankyo', 'hankyo', 'sat_cost', 'riyu', 'youbou',
  'owner_email', 'owner_name', 'claimed_at', 'genre', 'month', 'media', 'size', 'price', 'memo', 'updated', 'deleted', 'deleted_by', 'via'];
// via（21列目・2026-11-19〜）= 担当者専用フォームから来た回答の印（gas-api と同じ）
// 担当者専用フォーム（2026-11-19〜）: 1人1つ。URL は FORM_URL?t=<token>。参考文（②④⑤のグレーの例文）を人ごとに変えられる
var FORMS_HEAD = ['token', 'email', 'name', 'ph_hankyo', 'ph_riyu', 'ph_youbou', 'created', 'updated'];
var DEFAULT_PH = { hankyo: '10件の応募があった・5件の新規獲得ができた・売上が上がった・来店が増えたなど', riyu: '費用対効果満足度が得られた・反響はあったが費用的には高く感じたなど', youbou: '次回も掲載したい・エリアを広げていきたい・HPやAIについても相談したいなど' };
var TOKEN_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
var MASTERS = {
  genres: ['グルメ', 'スクール', 'ショップ', '暮らし', 'トータルケア', 'クリニック', '介護・福祉', '終活・士業', '企業', 'その他'],
  media: ['一宮', '江南', '岩倉', '清須', '津島', '西北'],
  sizes: ['表4', '表2・表3', '表2・3対向', '2P', '1P', '1/2P AD', '1/2P FO', '1/4P AD', '1/4P FO', '1/3P FO', '1/6P FO', '1/8P FO', '1P 求人', '1/2P 求人', '3/5P', '2/5P', '1/5P', '2/15P', '1/15P', 'その他企画枠'] // オーナー指定の並び（2026-11-18・その他企画枠は 2026-11-19 追加）
};
var FORM_URL = 'https://hirayama-byte.github.io/kcreate-hankyo/'; // settings の form_url で上書き可

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('反響事例管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- シート ----------
var memo_ = {};
function ss_() { return memo_.ss || (memo_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function ensureSheet_(name, head) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); }
  return sh;
}
function respSheet_() {
  var sh = ss_().getSheetByName('responses');
  if (!sh) {
    sh = ensureSheet_('responses', RESP_HEAD);
    sh.getRange('A:C').setNumberFormat('@'); sh.getRange('E:E').setNumberFormat('@'); sh.getRange('G:U').setNumberFormat('@');
  }
  if (String(sh.getRange(1, RESP_HEAD.length).getValue()) !== 'via') sh.getRange(1, RESP_HEAD.length).setValue('via'); // 後から足した列の見出し
  return sh;
}
function setup_() {
  respSheet_();
  Object.keys(MASTERS).forEach(function (k) {
    var sh = ensureSheet_(k, [k]);
    if (sh.getLastRow() < 2) sh.getRange(2, 1, MASTERS[k].length, 1).setValues(MASTERS[k].map(function (v) { return [v]; }));
    sh.getRange('A:A').setNumberFormat('@');
  });
  var ad = ensureSheet_('admins', ['email']); if (ad.getLastRow() < 2) ad.appendRow([ADMIN_EMAIL]);
  ensureSheet_('settings', ['key', 'value']);
  var def = ss_().getSheetByName('シート1') || ss_().getSheetByName('Sheet1'); if (def && ss_().getSheets().length > 1) ss_().deleteSheet(def);
}
function col_(name) { var sh = ss_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String); }
function setting_(key) { var sh = ss_().getSheetByName('settings'); if (!sh || sh.getLastRow() < 2) return ''; var v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues(); for (var i = 0; i < v.length; i++) if (String(v[i][0]) === key) return String(v[i][1]); return ''; }

// ---------- 人 ----------
function myEmail_() { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAdmin_(email) { return col_('admins').some(function (e) { return e.toLowerCase() === email; }); }
function names_() {
  if (memo_.names) return memo_.names;
  var m = {};
  try {
    var sh = SpreadsheetApp.openById(QR_SHEET_ID).getSheetByName('members');
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0] && r[1]) m[String(r[0]).toLowerCase()] = String(r[1]); });
  } catch (x) { console.error('名前を読めません: ' + x); }
  return (memo_.names = m);
}
function nameOf_(email) { return names_()[email] || String(email).split('@')[0]; }

// ---------- 回答 ----------
function str_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v == null ? '' : v); }
function month_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM') : String(v == null ? '' : v); }
function rowObj_(r) {
  var o = {}; RESP_HEAD.forEach(function (k, i) { o[k] = r[i]; });
  return {
    id: str_(o.id), at: str_(o.at), keisai: str_(o.keisai).replace(/^'/, ''), satHankyo: Number(o.sat_hankyo) || 0, hankyo: str_(o.hankyo).replace(/^'/, ''),
    satCost: Number(o.sat_cost) || 0, riyu: str_(o.riyu).replace(/^'/, ''), youbou: str_(o.youbou).replace(/^'/, ''),
    ownerEmail: str_(o.owner_email).toLowerCase(), ownerName: str_(o.owner_name), claimedAt: str_(o.claimed_at),
    genre: str_(o.genre), month: month_(o.month), media: str_(o.media), size: str_(o.size),
    price: o.price === '' || o.price == null ? '' : Number(String(o.price).replace(/[^\d.]/g, '')) || 0, memo: str_(o.memo),
    updated: str_(o.updated), deleted: str_(o.deleted), deletedBy: str_(o.deleted_by), via: str_(o.via)
  };
}
function allRows_() {
  var sh = respSheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, RESP_HEAD.length).getValues().map(rowObj_).filter(function (o) { return o.id; });
}
function findRow_(id) {
  id = String(id || '');
  if (!/^R\d{12,}$/.test(id)) throw new Error('回答のIDが正しくありません');
  var sh = respSheet_(), hit = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  if (!hit || hit.getRow() < 2) throw new Error('この回答は見つかりません（ほかの人が消したかもしれません）');
  return { sh: sh, row: hit.getRow(), obj: rowObj_(sh.getRange(hit.getRow(), 1, 1, RESP_HEAD.length).getValues()[0]) };
}
function setCols_(f, kv) {
  Object.keys(kv).forEach(function (k) { var c = RESP_HEAD.indexOf(k); if (c >= 0) f.sh.getRange(f.row, c + 1).setValue(kv[k]); });
}
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function withLock_(fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function canEdit_(o, me) { return o.ownerEmail === me || isAdmin_(me); }

// ---------- 画面から呼ぶ ----------
function init() {
  var me = myEmail_();
  if (!me) throw new Error('会社のGoogleアカウントで開いてください');
  if (!ss_().getSheetByName('admins')) setup_();
  if (ss_().getSpreadsheetTimeZone() !== TZ) ss_().setSpreadsheetTimeZone(TZ); // 作ったときの初期値が日本時間でないことがある（2026-11-18 9時間ずれ）
  var admin = isAdmin_(me);
  var rows = allRows_().filter(function (o) { return admin || !o.deleted; });
  return {
    me: { email: me, name: nameOf_(me), isAdmin: admin },
    masters: { genres: col_('genres'), media: col_('media'), sizes: col_('sizes') },
    formUrl: setting_('form_url') || FORM_URL,
    myForm: myForm_(me),
    defaultPh: DEFAULT_PH,
    people: people_(),
    sheetUrl: admin ? ss_().getUrl() : '',
    rows: rows
  };
}
function listRows() { var me = myEmail_(), admin = isAdmin_(me); return allRows_().filter(function (o) { return admin || !o.deleted; }); }

// 自分の担当にする（まだ担当がいない回答だけ。管理者は付け替えもできる）
function claim(id, toEmail) {
  var me = myEmail_();
  return withLock_(function () {
    var f = findRow_(id);
    if (f.obj.deleted) throw new Error('削除された回答です');
    var who = me;
    if (toEmail && isAdmin_(me)) who = String(toEmail).toLowerCase();
    else if (f.obj.ownerEmail && f.obj.ownerEmail !== me) throw new Error('すでに ' + f.obj.ownerName + ' さんの担当です');
    setCols_(f, { owner_email: who, owner_name: nameOf_(who), claimed_at: now_(), updated: now_() });
    return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]);
  });
}
// 担当を付け替える（QR管理と同じ・担当本人と管理者）。相手は社内の名簿にいる人だけ
function assign(id, toEmail) {
  var me = myEmail_(), to = String(toEmail || '').trim().toLowerCase();
  if (!to || !names_()[to]) throw new Error('担当にする人を選んでください（社内の名簿にいる人だけ）');
  return withLock_(function () {
    var f = findRow_(id);
    if (f.obj.deleted) throw new Error('削除された回答です');
    if (f.obj.ownerEmail && !canEdit_(f.obj, me)) throw new Error('担当の ' + f.obj.ownerName + ' さんか管理者だけが付け替えられます');
    if (!f.obj.ownerEmail && to !== me && !isAdmin_(me)) throw new Error('担当がいない回答をほかの人に付けられるのは管理者だけです');
    setCols_(f, { owner_email: to, owner_name: nameOf_(to), claimed_at: now_(), updated: now_() });
    return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]);
  });
}
// 名簿（担当の付け替えで選ぶ人）
function people_() { var m = names_(); return Object.keys(m).map(function (e) { return { email: e, name: m[e] }; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }); }
// ---------- 担当者専用フォーム ----------
function formsSheet_() { var sh = ensureSheet_('forms', FORMS_HEAD); return sh; }
function myForm_(email) {
  var sh = formsSheet_(), n = sh.getLastRow(), v = n > 1 ? sh.getRange(2, 1, n - 1, FORMS_HEAD.length).getValues() : [];
  for (var i = 0; i < v.length; i++) if (String(v[i][1]).toLowerCase() === email) return { token: String(v[i][0]), url: (setting_('form_url') || FORM_URL) + '?t=' + v[i][0], ph: { hankyo: String(v[i][3] || ''), riyu: String(v[i][4] || ''), youbou: String(v[i][5] || '') } };
  return null;
}
// 自分専用フォームを作る（まだなければ）
function createMyForm() {
  var me = myEmail_(); if (!me) throw new Error('会社のGoogleアカウントで開いてください');
  return withLock_(function () {
    var cur = myForm_(me); if (cur) return cur;
    var sh = formsSheet_(), used = {}; if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { used[String(r[0])] = 1; });
    var t; do { t = ''; for (var i = 0; i < 8; i++) t += TOKEN_CHARS.charAt(Math.floor(Math.random() * TOKEN_CHARS.length)); } while (used[t]);
    var r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, FORMS_HEAD.length).setNumberFormat('@').setValues([[t, me, nameOf_(me), '', '', '', now_(), now_()]]);
    return myForm_(me);
  });
}
// 自分専用フォームの参考文を変える（空にすると共通の参考文）
function saveMyForm(ph) {
  var me = myEmail_(); ph = ph || {};
  var c = function (v) { var x = String(v == null ? '' : v).replace(/\r?\n/g, ' ').trim().slice(0, 200); return /^[=+\-@]/.test(x) ? "'" + x : x; };
  return withLock_(function () {
    if (!myForm_(me)) throw new Error('先に自分専用フォームを作ってください');
    var sh = formsSheet_(), v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][1]).toLowerCase() === me) { sh.getRange(i + 2, 3, 1, 4).setValues([[nameOf_(me), c(ph.hankyo), c(ph.riyu), c(ph.youbou)]]); sh.getRange(i + 2, 8).setValue(now_()); break; }
    return myForm_(me);
  });
}
// 担当をはずす（本人か管理者）
function release(id) {
  var me = myEmail_();
  return withLock_(function () {
    var f = findRow_(id);
    if (!canEdit_(f.obj, me)) throw new Error('担当の人か管理者だけができます');
    setCols_(f, { owner_email: '', owner_name: '', claimed_at: '', updated: now_() });
    return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]);
  });
}
// 担当の情報を入れる／直す。担当がいなければ入れた人が担当になる
function saveSales(id, d) {
  var me = myEmail_();
  d = d || {};
  var clean = function (v, n) { var s = String(v == null ? '' : v).trim().slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  var month = String(d.month || '').trim();
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('掲載号の形が正しくありません');
  var price = String(d.price == null ? '' : d.price).replace(/[,，円\s]/g, '');
  if (price && !/^\d{1,9}$/.test(price)) throw new Error('掲載料金は数字で入れてください（税抜・円）');
  return withLock_(function () {
    var f = findRow_(id);
    if (f.obj.deleted) throw new Error('削除された回答です');
    var kv = { genre: clean(d.genre, 40), month: month, media: clean(d.media, 40), size: clean(d.size, 40), price: price, memo: clean(d.memo, 1000), updated: now_() };
    if (!f.obj.ownerEmail) { kv.owner_email = me; kv.owner_name = nameOf_(me); kv.claimed_at = now_(); }
    else if (!canEdit_(f.obj, me)) throw new Error('担当の ' + f.obj.ownerName + ' さんか管理者だけが直せます');
    setCols_(f, kv);
    return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]);
  });
}
// 一覧の表・詳細ページで1項目だけ直す（その場で保存・2026-11-19）。ほかの項目は触らないので、続けて直しても上書きし合わない
// 担当がいなければ直した人が担当になる（saveSales と同じ）
function saveField(id, key, value) {
  var me = myEmail_(), lim = { genre: 40, media: 40, size: 40, memo: 1000, month: 0, price: 0 };
  if (!(key in lim)) throw new Error('直せない項目です');
  var v = String(value == null ? '' : value).trim();
  if (key === 'month' && v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new Error('掲載号の形が正しくありません');
  if (key === 'price') { v = v.replace(/[,，円\s]/g, ''); if (v && !/^\d{1,9}$/.test(v)) throw new Error('掲載料金は数字で入れてください（税抜・円）'); }
  if (lim[key]) { v = v.slice(0, lim[key]); if (/^[=+\-@]/.test(v)) v = "'" + v; }
  return withLock_(function () {
    var f = findRow_(id);
    if (f.obj.deleted) throw new Error('削除された回答です');
    var kv = { updated: now_() }; kv[key] = v;
    if (!f.obj.ownerEmail) { kv.owner_email = me; kv.owner_name = nameOf_(me); kv.claimed_at = now_(); }
    else if (!canEdit_(f.obj, me)) throw new Error('担当の ' + f.obj.ownerName + ' さんか管理者だけが直せます');
    setCols_(f, kv);
    return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]);
  });
}
// 削除（ゴミ箱。管理者が戻せる）／戻す（管理者）
function removeRow(id) {
  var me = myEmail_();
  return withLock_(function () {
    var f = findRow_(id);
    if (!canEdit_(f.obj, me)) throw new Error('担当の人か管理者だけが削除できます');
    setCols_(f, { deleted: now_(), deleted_by: me });
    return { ok: true };
  });
}
function restoreRow(id) {
  var me = myEmail_(); if (!isAdmin_(me)) throw new Error('管理者だけができます');
  return withLock_(function () { var f = findRow_(id); setCols_(f, { deleted: '', deleted_by: '', updated: now_() }); return rowObj_(f.sh.getRange(f.row, 1, 1, RESP_HEAD.length).getValues()[0]); });
}
// 候補（ジャンル・媒体・サイズ）を直す（管理者）
function saveMaster(kind, list) {
  var me = myEmail_(); if (!isAdmin_(me)) throw new Error('管理者だけができます');
  if (!MASTERS[kind]) throw new Error('不明な候補です');
  var vals = (list || []).map(function (s) { return String(s).trim().slice(0, 40); }).filter(String);
  var seen = {}; vals = vals.filter(function (v) { if (seen[v]) return false; seen[v] = 1; return true; });
  if (!vals.length) throw new Error('1つ以上入れてください');
  return withLock_(function () {
    var sh = ensureSheet_(kind, [kind]);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).clearContent();
    sh.getRange(2, 1, vals.length, 1).setNumberFormat('@').setValues(vals.map(function (v) { return [v]; }));
    return vals;
  });
}

// ---------- 情報読込（管理表から担当の情報を入れる・2026-11-25） ----------
// 「情報読込」ボタンを押したときだけ動く。会社の管理表（Google ドライブ）を読むだけで、管理表には一切書き込まない。
// 対象: 削除されていない回答のうち、ジャンル・掲載号・媒体・サイズ・料金が「全部」空のものだけ（1つでも入っていれば触らない）。
// 比べ方: 回答の掲載名と、管理表の客先（掲載店）の全体、または「_」で区切った部分が同じなら当たり（部分一致はしない）。
// 号: 回答日の月と同じか、それより前で、いちばん新しい号（回答日より後の号は使わない）。
// 担当は空のときだけ、管理表の担当者（苗字）から名簿の人を探して入れる（1人に決まらなければ空のまま）。
//
// ■ 来年度の管理表を足すには
//   管理表のフォルダ（例: ケイ・クリエイト管理表 / 41期管理表）を開き、URL の最後の英数字（フォルダID）を
//   下の KANRI_FOLDERS に1行足して反映する。
//   （または反響事例管理データの settings シートに key=kanri_folders、value=フォルダID（複数はカンマ区切り）を入れると、そちらが優先されます）
//   フォルダの中の「管理表_〇〇版_2026年度」の形の名前のスプレッドシートを自動で探し、号のタブ（26.11月号 など）も自動で見つけます。
var KANRI_FOLDERS = [
  '1P0O2GILxD9TaSEEDehaXK5zwRu8H_KUs' // 40期管理表（2026年度）
];
var KANRI_FILE_RE = /管理表_(.+?版)_(\d{4})年度/;
var KANRI_TAB_RE = /^\s*(\d{2})\s*[.．]\s*(\d{1,2})\s*月号\s*$/;
var KANRI_LOOKBACK = 18; // 回答日の月から何か月前の号まで探すか（その月を含む）
var KANRI_TIME_LIMIT = 270000; // 管理表を読むのに4分半を超えたら、何も入れずに止める（Apps Script は6分で止まるため）

// 名前の比べ方: 全角半角・大文字小文字をそろえ、空白・記号・会社の種類（株式会社など）を取る
function kanriNorm_(s) {
  var t = String(s == null ? '' : s).normalize('NFKC').toLowerCase();
  t = t.replace(/株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|社会福祉法人|医療法人社団|医療法人|\(株\)|\(有\)|\(同\)/g, '');
  return t.replace(/[\s・ー‐\-－―─~〜「」『』()（）\[\]【】〈〉《》<>、。,.，．'"’”&＆!！?？\/／:：;；+＋*＊#＃]/g, '');
}
// 客先（掲載店）の名前の候補: 全体と「_」で区切った各部分（例: 甲羅本店_サカエ商事 → 甲羅本店／サカエ商事）
function kanriKeys_(customer) {
  var raw = String(customer || '').normalize('NFKC'), out = [];
  var add = function (x) { var k = kanriNorm_(x); if (k && out.indexOf(k) < 0) out.push(k); };
  add(raw); raw.split('_').forEach(add);
  return out;
}
// タブ名 26.11月号 → 2026-11（アプリの掲載号の形。画面では 2026年11月号 と出る）
function kanriTabMonth_(name) {
  var m = KANRI_TAB_RE.exec(String(name || '').normalize('NFKC'));
  if (!m || +m[2] < 1 || +m[2] > 12) return '';
  return '20' + m[1] + '-' + ('0' + m[2]).slice(-2);
}
function kanriAddMonths_(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
// サイズ＋フリー/定型 → アプリのサイズ（1/2＋フリー → 1/2P AD、1/4＋定型 → 1/4P FO、1 → 1P）。候補になければ ''
function kanriSize_(size, type, sizes) {
  var s = String(size || '').normalize('NFKC').replace(/\s/g, '').replace(/(p|ページ)$/i, '');
  if (!s) return '';
  var base = s + 'P', t = String(type || '').normalize('NFKC'), sfx = /フリー/.test(t) ? 'AD' : /定型/.test(t) ? 'FO' : '';
  if (sfx && sizes.indexOf(base + ' ' + sfx) >= 0) return base + ' ' + sfx;
  if (sizes.indexOf(base) >= 0) return base; // 1P・2P・3/5P など、AD/FO の区別がないもの
  return '';
}
// 見出しの行から列を探す（見つからなければ決まった位置: A担当者 B掲載ジャンル D客先 E サイズ F フリー/定型 H 掲載料）
// 実物の見出し（2026-11-25 確認）: 担当者 / 掲載ジャンル / 掲載場所 / 客先（掲載店） / サイズ / フリー定型 / 制作料 / 掲載料 …
function kanriCols_(head) {
  var h = head.map(function (v) { return String(v || '').normalize('NFKC').replace(/\s/g, ''); });
  var find = function (re, def) { for (var i = 0; i < h.length; i++) if (re.test(h[i])) return i; return def; };
  return { owner: find(/担当/, 0), genre: find(/ジャンル/, 1), customer: find(/客先|掲載店/, 3), size: find(/サイズ/, 4), type: find(/フリー|定型/, 5), price: find(/掲載料|金額/, 7) };
}
// 1つのタブを読む（表示どおりの文字で読む＝1/2 が日付に化けない）
function kanriReadTab_(sh) {
  var v = sh.getDataRange().getDisplayValues(), hr = -1;
  for (var i = 0; i < Math.min(v.length, 5); i++) if (v[i].some(function (x) { return /客先|掲載店/.test(String(x)); })) { hr = i; break; }
  if (hr < 0) hr = 0; // 見出しが見つからなくても1行目は見出しとみなす
  var c = kanriCols_(v[hr] || []), out = [];
  for (var r = hr + 1; r < v.length; r++) {
    var row = v[r], cust = String(row[c.customer] || '').trim();
    if (!cust) continue;
    var p = String(row[c.price] || '').normalize('NFKC').replace(/[^\d.]/g, '');
    out.push({ owner: String(row[c.owner] || '').trim(), genre: String(row[c.genre] || '').normalize('NFKC').trim(), customer: cust, keys: kanriKeys_(cust),
      size: String(row[c.size] || '').trim(), type: String(row[c.type] || '').trim(), price: p === '' || isNaN(Number(p)) ? null : Math.round(Number(p)) });
  }
  return out;
}
// 管理表のファイル一覧（版の名前・ID）。来年度分はフォルダIDを足すだけ
function kanriFiles_() {
  var ids = (setting_('kanri_folders') || '').split(/[,\s]+/).filter(String);
  if (!ids.length) ids = KANRI_FOLDERS;
  var files = [], warn = [];
  ids.forEach(function (fid) {
    try {
      var it = DriveApp.getFolderById(fid).getFiles();
      while (it.hasNext()) {
        var f = it.next(), m = KANRI_FILE_RE.exec(String(f.getName()).normalize('NFKC'));
        if (m && f.getMimeType() === 'application/vnd.google-apps.spreadsheet') // Excel などの写しは読まない
          files.push({ id: f.getId(), name: f.getName(), edition: m[1], year: +m[2] });
      }
    } catch (x) { warn.push('管理表のフォルダを開けませんでした（' + fid + '）'); }
  });
  files.sort(function (a, b) { return b.year - a.year; }); // 同じ版・同じ号が2つのファイルにあるときは新しい年度のほうを使う
  return { files: files, warn: warn };
}

// 画面の「情報読込」ボタンから呼ぶ。ログインしている人ならだれでも押せる（空の項目を埋めるだけなので）
function loadFromKanri() {
  var me = myEmail_(); if (!me) throw new Error('会社のGoogleアカウントで開いてください');
  if (!ss_().getSheetByName('admins')) setup_(); // 候補（ジャンル・媒体・サイズ）のシートがまだないとき
  var t0 = Date.now();
  var masters = { genres: col_('genres'), media: col_('media'), sizes: col_('sizes') };
  var empty = function (o) { return !o.genre && !o.month && !o.media && !o.size && (o.price === '' || o.price == null); };
  var targets = allRows_().filter(function (o) { return !o.deleted && empty(o); });
  var res = { targets: targets.length, filled: [], partial: [], notFound: [], warn: [], read: { editions: [], tabs: 0 }, stopped: false };
  if (!targets.length) return res;

  // 読む号の範囲: いちばん古い回答の月の KANRI_LOOKBACK か月前 〜 いちばん新しい回答の月
  var ams = targets.map(function (o) { return o.at.slice(0, 7); }).filter(function (m) { return /^\d{4}-\d{2}$/.test(m); }).sort();
  if (!ams.length) { targets.forEach(function (o) { res.notFound.push({ id: o.id, keisai: o.keisai }); }); return res; }
  var hi = ams[ams.length - 1], lo = kanriAddMonths_(ams[0], -(KANRI_LOOKBACK - 1));
  // 版ごと・号ごとの行（1回の実行で1タブ1回だけ読む）
  var fl = kanriFiles_(); res.warn = res.warn.concat(fl.warn);
  if (!fl.files.length) { res.warn.push('管理表のファイルが見つかりませんでした'); return res; }
  var data = {}, months = {}, eds = [];
  fl.files.forEach(function (f) {
    if (res.stopped) return;
    try {
      var ss = SpreadsheetApp.openById(f.id);
      ss.getSheets().forEach(function (sh) {
        if (res.stopped) return;
        var ym = kanriTabMonth_(sh.getName());
        if (!ym || ym < lo || ym > hi) return;
        var key = f.edition + '|' + ym; if (data[key]) return;
        if (Date.now() - t0 > KANRI_TIME_LIMIT) { res.stopped = true; return; }
        data[key] = kanriReadTab_(sh); months[ym] = 1; res.read.tabs++;
        if (eds.indexOf(f.edition) < 0) eds.push(f.edition);
      });
    } catch (x) { res.warn.push('「' + f.name + '」を開けませんでした'); }
  });
  // 途中までしか読めていないと、違う号を選んでしまうことがあるので、何も入れずに止める
  if (res.stopped) { res.warn.push('管理表の読み込みに時間がかかりすぎたため、何も入れずに止めました。少し時間をおいてもう一度押してください'); return res; }
  // 版の並び: アプリの媒体の候補の順（一宮版 → 一宮）。候補にない版はうしろ
  var medOf = function (ed) { return String(ed).replace(/版$/, ''); };
  var rank = function (ed) { var i = masters.media.indexOf(medOf(ed)); return i < 0 ? 999 : i; };
  eds.sort(function (a, b) { return rank(a) - rank(b); });
  res.read.editions = eds;
  var mlist = Object.keys(months).sort().reverse();
  var people = people_();

  var plans = [];
  targets.forEach(function (o) {
    var key = kanriNorm_(o.keisai), am = o.at.slice(0, 7);
    if (!key || !/^\d{4}-\d{2}$/.test(am)) { res.notFound.push({ id: o.id, keisai: o.keisai }); return; }
    var from = kanriAddMonths_(am, -(KANRI_LOOKBACK - 1)), hit = null;
    for (var i = 0; i < mlist.length && !hit; i++) {
      var ym = mlist[i]; if (ym > am || ym < from) continue;
      var per = [];
      eds.forEach(function (ed) {
        var rows = (data[ed + '|' + ym] || []).filter(function (r) { return r.keys.indexOf(key) >= 0; });
        if (rows.length) per.push({ ed: ed, rows: rows });
      });
      if (per.length) hit = { ym: ym, per: per };
    }
    if (!hit) { res.notFound.push({ id: o.id, keisai: o.keisai }); return; }
    var first = hit.per[0].rows[0], kv = { month: hit.ym }, why = [];
    // 媒体（版が複数なら「・」でつなぐ。媒体の候補にない版は入れない）
    var meds = [];
    hit.per.forEach(function (p) { var m = medOf(p.ed); if (masters.media.indexOf(m) >= 0) meds.push(m); else why.push('媒体「' + p.ed + '」が媒体の候補にないため、媒体に入れていません'); });
    if (meds.length) kv.media = meds.join('・');
    // ジャンル（最初の版の行から）
    if (masters.genres.indexOf(first.genre) >= 0) kv.genre = first.genre;
    else why.push(first.genre ? 'ジャンル「' + first.genre + '」がジャンルの候補にないため、ジャンルは空のままです' : '管理表にジャンルが書かれていないため、ジャンルは空のままです');
    // サイズ（版ごとに違えば「・」でつなぐ）
    var szs = [], badSz = [];
    hit.per.forEach(function (p) {
      var r = p.rows[0], s = kanriSize_(r.size, r.type, masters.sizes), label = r.size + (r.type ? '（' + r.type + '）' : '');
      if (s) { if (szs.indexOf(s) < 0) szs.push(s); } else if (badSz.indexOf(label) < 0) badSz.push(label);
    });
    if (badSz.length) why.push('サイズ「' + badSz.join('・') + '」に合うサイズの候補がないため、サイズは空のままです');
    else if (szs.length) kv.size = szs.join('・');
    // 料金（全部の版・全部の行の合計）
    var sum = 0, noPrice = false;
    hit.per.forEach(function (p) { p.rows.forEach(function (r) { if (r.price == null) noPrice = true; else sum += r.price; }); });
    if (noPrice) why.push('管理表に金額が入っていない行があるため、料金は空のままです');
    else if (sum > 999999999) why.push('料金が大きすぎるため、料金は空のままです');
    else kv.price = String(sum);
    // 担当（空のときだけ。苗字で名簿から1人に決まるときだけ）
    var sur = kanriNorm_(first.owner), owner = null;
    if (!o.ownerEmail) {
      var cand = sur ? people.filter(function (p) { return kanriNorm_(String(p.name).split(/[\s　]/)[0]) === sur; }) : [];
      if (cand.length === 1) owner = cand[0];
      else why.push(!sur ? '管理表に担当者が書かれていないため、担当は空のままです' : '担当者「' + first.owner + '」' + (cand.length ? 'に当てはまる人が名簿に複数いる' : 'が名簿に見つからない') + 'ため、担当は空のままです');
    }
    plans.push({ o: o, kv: kv, owner: owner, why: why, customer: first.customer, editions: hit.per.map(function (p) { return p.ed; }) });
  });

  // 書き込み（ほかの人の保存とぶつからないようにロック。直前にもう一度「全部空か」を確かめる）
  // 書くのは saveField と同じ responses の列（updated も更新）。担当を入れるときは claim と同じ owner_email・owner_name・claimed_at
  withLock_(function () {
    plans.forEach(function (pl) {
      var f; try { f = findRow_(pl.o.id); } catch (x) { return; }
      if (f.obj.deleted || !empty(f.obj)) return; // 読んでいる間にだれかが入れた → 触らない
      var kv = {}, set = {};
      ['genre', 'month', 'media', 'size', 'price'].forEach(function (k) { if (pl.kv[k] != null && pl.kv[k] !== '') { kv[k] = pl.kv[k]; set[k] = pl.kv[k]; } });
      if (pl.owner && !f.obj.ownerEmail) { kv.owner_email = pl.owner.email; kv.owner_name = pl.owner.name; kv.claimed_at = now_(); set.owner = pl.owner.name; }
      if (f.obj.ownerEmail) pl.why = pl.why.filter(function (w) { return !/^(担当者|管理表に担当者)/.test(w); });
      if (Object.keys(set).length) { kv.updated = now_(); setCols_(f, kv); res.filled.push({ id: pl.o.id, keisai: pl.o.keisai, customer: pl.customer, editions: pl.editions, set: set }); }
      if (pl.why.length) res.partial.push({ id: pl.o.id, keisai: pl.o.keisai, customer: pl.customer, reasons: pl.why });
    });
  });
  return res;
}
