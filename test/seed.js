// 画面確認用の架空データ（店名・内容はすべて架空）
module.exports = function (t) {
  var list = [
    ['〇〇整骨院', 5, '掲載後1か月で新規の予約が12件ありました。冊子を見たという方が多かったです。', 4, '費用対効果満足度が得られた', '次回も掲載したい', 'suda', ['クリニック', '2026-10', '一宮', '1/4P AD', 30000]],
    ['カフェ こもれび', 4, '来店が増えた。クーポン利用が8件。', 3, '反響はあったが費用的には少し高く感じた', 'エリアを広げていきたい', 'seko', ['グルメ', '2026-10', '江南', '1/8P FO', 15000]],
    ['ひまわり学習塾', 3, '問い合わせが2件', 2, '時期が合わなかった', '春の募集時期にもう一度相談したい', 'suda', ['スクール', '2026-09', '一宮', '1/6P FO', 20000]],
    ['ヘアサロン ルーム', 5, '20代の新規客が5人増えた', 5, '想像以上の反響だった', 'HPやAIについても相談したい', 'hirayama', ['ショップ', '2026-11', '岩倉', '1/4P FO', 25000]],
    ['ほっと訪問介護', 2, '反響はほとんどなかった', 2, '費用的に高く感じた', '', '', null],
    ['和菓子 つきみ', 4, '贈答用の注文が増えた', 4, '', '年末号にも出したい', '', null]
  ];
  list.forEach(function (x) { t.submit({ keisai: x[0], sat_hankyo: x[1], hankyo: x[2], sat_cost: x[3], riyu: x[4], youbou: x[5] }); });
  var rows = t.as('hirayama@k-create.co.jp').listRows();
  list.forEach(function (x) {
    if (!x[6]) return;
    var r = rows.filter(function (o) { return o.keisai === x[0]; })[0], who = t.as(x[6] + '@k-create.co.jp');
    who.claim(r.id); who.saveSales(r.id, { genre: x[7][0], month: x[7][1], media: x[7][2], size: x[7][3], price: x[7][4] });
  });
};
