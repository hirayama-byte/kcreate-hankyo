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
