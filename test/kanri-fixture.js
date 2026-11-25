// 架空の管理表（情報読込のテスト・画面確認・公開サンプル用）。店名・金額はすべて架空。Node でもブラウザでも動く
// spec = { '一宮版': { '26.11月号': [[担当者, ジャンル, 掲載場所, 客先, サイズ, フリー/定型, 制作料, 掲載料], …], … }, … }
// 本物と同じく1行目が見出し。号のタブのほかに「状況」「営業一覧」のタブもある（読まないことの確認用）
// できたスプレッドシートは読み取り専用（書こうとするとエラー）
(function (root) {
  var HEAD = ['担当者 70', '掲載ジャンル 90', '掲載場所 90', '客先（掲載店） 220', 'サイズ 70', 'フリー定型', '制作料 90', '掲載料 90', '外注制作先 90', '年契消化 80'];
  var ORDER = ['一宮版', '江南版', '岩倉版', '清須版', '津島版', '西北版', '北区版'];
  function build(store, Spreadsheet, folderId, spec, year) {
    year = year || 2026;
    var ids = [];
    Object.keys(spec).forEach(function (ed) {
      var no = ORDER.indexOf(ed) + 1 || 9, id = 'kanri-' + ed + '-' + year;
      var ss = store[id] = new Spreadsheet(id, no + ',管理表_' + ed + '_' + year + '年度');
      ss.sheets[0].setName('状況'); ss.sheets[0].appendRow(['状況', '（読まないタブ）']);
      ss.insertSheet('営業一覧').appendRow(['担当者', '客先']);
      Object.keys(spec[ed]).forEach(function (tab) {
        var sh = ss.insertSheet(tab); sh.appendRow(HEAD);
        spec[ed][tab].forEach(function (r) { sh.appendRow(r.concat(['', ''])); });
      });
      ss.freeze(); ids.push(id);
    });
    store._folders = store._folders || {};
    store._folders[folderId] = (store._folders[folderId] || []).concat(ids);
    return ids;
  }
  root.KanriFixture = { build: build, FOLDER: '1P0O2GILxD9TaSEEDehaXK5zwRu8H_KUs' };
  if (typeof module !== 'undefined') module.exports = root.KanriFixture;
})(typeof window !== 'undefined' ? window : globalThis);
