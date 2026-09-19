# 文書統計のステータスバー表示：先行実装調査

調査日: 2026-09-19。公開Web検索、GitHubのIssue/PR検索API、PR差分・コメント、公式実験リポジトリを確認した。公開フォークすべてのブランチを網羅した調査ではない。

## 今回の要件

- 保存前のアクティブ文書全体を常時計測する。画面外の本文も含む。
- 行表示は「現在カーソル行 / 文書の総行数」。選択範囲の行数ではない。折り返しではなく本文の改行に基づく。
- 段落とブロックは同義。2個以上連続する改行で本文を区切る。単一改行では分割せず、空ブロックは数えず、末尾の本文も数える。
- 文字数などの表示項目、ラベル、区切り、順序を設定できるようにする。
- 本家にも適用できる本体機能とし、zed-i18nでは再現可能なパッチとして先行導入する。翻訳固有の変更は分離する。

## 候補と判断

### PR #60113: Add an optional word count to the status bar

- https://github.com/zed-industries/zed/pull/60113
- closed / 未マージ。2026-08-08のコメントでは、3週間以上更新されていないドラフトの整理が閉鎖理由。機能そのものを却下したとは読めない。
- 閉鎖コメント: https://github.com/zed-industries/zed/pull/60113#issuecomment-5226559929
- `status_bar.word_count_button`（既定false）を追加。選択がなければ全文の単語数を既存のCursorPositionに表示する。
- 編集イベント、エディター切り替え、設定変更に対応。編集の再集計は250msデバウンス。バッファのスナップショットを読み、保存済みファイルには依存しない。
- 差分を確認済み。`count_words` は空白で区切る方式で、日本語の単語分割にそのまま使うべきではない。全文走査はeditorのupdateクロージャ内にあり、デバウンスだけでバックグラウンド計算にはなっていない。
- 総行数・全文文字数・ブロック数・任意ラベルは未対応。選択時は選択統計へ表示が切り替わる。
- **今回の最も近い参照実装。完成品としてそのまま採用せず、イベント購読、更新の間引き、設定配線を参考にする。** v1.20.2への適用・ビルドは未検証。

### PR #27109、および先行する #22601 / #21263

- https://github.com/zed-industries/zed/pull/27109
- https://github.com/zed-industries/zed/pull/22601
- https://github.com/zed-industries/zed/pull/21263
- いずれも未マージ。同一作者によるMarkdown / Plain Textの単語数表示の系列。
- #27109ではテスト、Zed自身の単語判定の利用、設定による無効化がレビューで話題になった。最終コメントは非活動を理由とする閉鎖で、再提出時の修正案もある。
- https://github.com/zed-industries/zed/pull/27109#issuecomment-2851228828
- 古い実装を直接移植するより、単語の定義とテスト設計に関する参考資料として扱う。

### 公式実験 embedded_gpui と PR #60574

- https://github.com/zed-industries/embedded_gpui
- https://github.com/zed-industries/embedded_gpui/blob/main/TODO.md
- Wasm内のGPUIをホストへ描画するUI拡張の実験。READMEはサポート済みAPIではないと明示。
- 調査時点のTODOでは、Zedのパネル・ステータスバー等への取り付けと拡張レジストリによる配布は未完了。
- 基礎となる `run_embedded` / `ApplicationHandle` のPR https://github.com/zed-industries/zed/pull/60574 はAPI上でマージ済みと確認。TODOにはまだPR待ちの記載が残っているため、TODOの全項目を最新状態とみなさない。
- **将来の追跡対象。今回の字数表示のために取り込むには範囲が大きく、現時点の即時採用候補ではない。**

### UI拡張APIの提案

- https://github.com/zed-industries/zed/discussions/53403 : Visual Extension APIのRFC。ステータスバーも対象。議論と公式実験へのリンクがあるが、配布済みAPIではない。
- https://github.com/zed-industries/zed/issues/61673 : ステータスバーアクション登録APIの要望。確認できたページはclosedで、実装PRの紐付けはない。閉鎖を実装完了とは扱わない。
- https://github.com/zed-industries/zed/discussions/43217 : 単語数表示の要望。#60113が関連付けている。

### その他

- https://github.com/zed-industries/zed/pull/38268 : ファイルサイズのステータスバー表示。closed / 未マージ。別項目追加の関連例だが、今回の文字数・ブロック数を実現するものではない。
- https://github.com/capogreco/zed_wordcount : 名前は該当するが、GitHub APIではsize 0、contents取得も失敗。流用可能な公開コードは確認できなかった。
- 検索した範囲では、今回の要件を満たして継続配布されているフォークや、そのまま導入できるステータスバー拡張APIは確認できなかった。

## 着手方針

ゼロから仕組みを探索し直す必要はない。#60113とZed既存のStatusItemViewを参照し、文書統計の本体機能として実装する。汎用UI拡張APIを新設することは今回の前提にしない。

集計と表示を分離し、カーソル移動だけで全文を再走査しない。長文集計のバックグラウンド化、古い集計結果の破棄、タブ切り替え、Undo/Redo、設定切り替えを検証する。空白のみの行の扱い、文字の計数単位、複数バッファ表示時の対象は実装時に明示する。

まずzed-i18nの固定する本家ソースに対して差分を作り、翻訳パッチとの適用順序を検証する。生成済みキャッシュだけの編集では完了としない。本家向けの差分とzed-i18n用の適用処理を分ける。
