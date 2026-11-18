# 反響事例管理（フォーム＋管理サイト）
- docs/ … クライアント用アンケート（GitHub Pages に置く予定）。送信先は docs/config.js の API_URL
- gas-api/ … 受け口（スプレッドシート「反響事例管理データ」に付属・誰でも呼べる）
- gas-admin/ … 社内の管理サイト（ドメイン内のみ・平山さんの権限で動く）
- テスト: node test/run.js ／ node test/serve.js 8820 --seed → PW=<playwright> node test/shots.js
- 設計: .company/engineering/projects/hankyo-jirei.md
