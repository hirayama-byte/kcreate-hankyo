// 反響事例管理 — フォームの受け口（公開）。スプレッドシート「反響事例管理データ」に付属
// デプロイ: ウェブアプリ / 実行ユーザー=自分 / アクセス=全員（フォームは社外のクライアントが使う）
// ここでできるのは「回答を1件ためる」だけ。読み出し・変更は社内の管理サイト（gas-admin）から

var TZ = 'Asia/Tokyo';
var VERSION = '1';
// responses シートの列（gas-admin と同じ並び。変えるときは両方）
var RESP_HEAD = ['id', 'at', 'keisai', 'sat_hankyo', 'hankyo', 'sat_cost', 'riyu', 'youbou',
  'owner_email', 'owner_name', 'claimed_at', 'genre', 'month', 'media', 'size', 'price', 'memo', 'updated', 'deleted', 'deleted_by'];
var MAX = { keisai: 100, hankyo: 1000, riyu: 1000, youbou: 1000 };

function doGet() { return json_({ ok: true, version: VERSION }); }
function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ error: '送信の形が正しくありません' }); }
  try {
    if (String(req.action || '') === 'submit') return json_(submit_(req.data || {}));
    return json_({ error: '不明な操作です' });
  } catch (x) { console.error(x); return json_({ error: String(x && x.message || x) }); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function clean_(v, n) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n); }
// 先頭が = + - @ だとシートが式として読むので、文字として入れる
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }
function sat_(v) { var n = Number(v); if (!(n >= 1 && n <= 5 && Math.floor(n) === n)) throw new Error('満足度を選んでください'); return n; }

function submit_(d) {
  if (clean_(d.website, 100)) return { ok: true }; // ロボット用のわな（人には見えない欄）。入っていたら黙って捨てる
  var keisai = clean_(d.keisai, MAX.keisai);
  if (!keisai) throw new Error('掲載名を入力してください');
  var row = {
    keisai: keisai, sat_hankyo: sat_(d.sat_hankyo), hankyo: clean_(d.hankyo, MAX.hankyo),
    sat_cost: sat_(d.sat_cost), riyu: clean_(d.riyu, MAX.riyu), youbou: clean_(d.youbou, MAX.youbou)
  };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('混み合っています。少し待ってからもう一度送ってください');
  try {
    var sh = sheet_();
    var now = new Date(), id = 'R' + Utilities.formatDate(now, TZ, 'yyMMddHHmmss') + ('00' + now.getMilliseconds()).slice(-3) + Math.floor(Math.random() * 900000 + 100000); // 同じ秒に重なっても別のIDになるよう、ミリ秒＋乱数（2026-11-19）
    var at = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    var vals = RESP_HEAD.map(function (k) {
      if (k === 'id') return id; if (k === 'at') return at;
      return row[k] == null ? '' : (typeof row[k] === 'string' ? safe_(row[k]) : row[k]);
    });
    // 日時や数字を勝手に変換させない（シートのタイムゾーンに左右されないよう、文字の書式を先に付けてから書く）
    var r = sh.getLastRow() + 1, rg = sh.getRange(r, 1, 1, vals.length);
    rg.setNumberFormat('@'); sh.getRange(r, 4).setNumberFormat('0'); sh.getRange(r, 6).setNumberFormat('0');
    rg.setValues([vals]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('responses');
  if (ss.getSpreadsheetTimeZone && ss.getSpreadsheetTimeZone() !== TZ) ss.setSpreadsheetTimeZone(TZ);
  if (!sh) {
    sh = ss.insertSheet('responses');
    sh.getRange(1, 1, 1, RESP_HEAD.length).setValues([RESP_HEAD]);
    sh.getRange('A:C').setNumberFormat('@'); sh.getRange('E:E').setNumberFormat('@'); sh.getRange('G:T').setNumberFormat('@');
    sh.setFrozenRows(1);
    var def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  return sh;
}
