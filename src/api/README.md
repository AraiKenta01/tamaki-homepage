# src/api/

各API機能（来客カウンター、掲示板 等）のハンドラをここに置く。
1機能 = 1ファイルを目安にし、`src/index.ts`のルーティングからインポートして呼び出す。

- `counter.ts` — 来客カウンター（Phase 5）
- `bbs.ts` — 掲示板（Phase 6）

（訂正: 当初`/functions`をCloudflare Pages Functions用として用意していたが、
本プロジェクトの実体はPagesではなくWorkers Static Assetsであるとわかったため、
単一のWorkerエントリポイント[`src/index.ts`]でルーティングする方式に変更した。
`/functions`は廃止。）
