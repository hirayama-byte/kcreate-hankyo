// 2つの GAS（gas-api / gas-admin）を同じ偽スプレッドシートの上で動かす（テスト用）
var fs = require('fs'), path = require('path'), vm = require('vm'), GasMock = require('./gas-mock.js');
var root = path.join(__dirname, '..');
var SHEET_ID = '1w-4FIkRfEjiCEo6LwKKb8CoXMOvT7_c6ASFpVkrO3ks', QR_SHEET_ID = '1riYm2WOMEeZBq0Te6BsqBumQFvPji9oYuZa8c6_So0o';

function make(opts) {
  opts = opts || {};
  var store = {};
  store[SHEET_ID] = new GasMock.Spreadsheet(SHEET_ID, '反響事例管理データ');
  var qr = store[QR_SHEET_ID] = new GasMock.Spreadsheet(QR_SHEET_ID, 'QR');
  var mem = qr.insertSheet('members');
  mem.appendRow(['email', 'name', 'prefix']);
  (opts.members || [['hirayama@k-create.co.jp', '平山 竜也'], ['suda@k-create.co.jp', '須田 諒治'], ['seko@k-create.co.jp', '瀬古 典子']]).forEach(function (m) { mem.appendRow([m[0], m[1], '']); });
  function load(dir, user) {
    var env = GasMock.makeEnv(store, { owner: 'hirayama@k-create.co.jp', user: user });
    env.SpreadsheetApp.getActiveSpreadsheet = function () { return store[SHEET_ID]; };
    env.HtmlService = { createTemplateFromFile: function () { return { evaluate: function () { var o = { setTitle: function () { return o; }, addMetaTag: function () { return o; } }; return o; } }; } };
    env.console = console; env.JSON = JSON; env.Math = Math; env.Date = Date; env.String = String; env.Number = Number; env.Object = Object; env.Array = Array; env.Error = Error;
    var ctx = vm.createContext(env);
    vm.runInContext(fs.readFileSync(path.join(root, dir, 'Code.gs'), 'utf8'), ctx, { filename: dir + '/Code.gs' });
    return ctx;
  }
  var api = load('gas-api', '');
  var admins = {};
  return {
    store: store,
    sheet: function () { return store[SHEET_ID]; },
    post: function (req) { return JSON.parse(api.doPost({ postData: { contents: JSON.stringify(req) } }).body); },
    submit: function (data) { var r = api.doPost({ postData: { contents: JSON.stringify({ action: 'submit', data: data }) } }); return JSON.parse(r.body); },
    as: function (email) { return admins[email] || (admins[email] = load('gas-admin', email)); }
  };
}
module.exports = { make: make };
