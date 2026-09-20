# 未保存文書・永続メモの調査

調査日: 2026-09-20。公式ドキュメント、上流 main のコード、公開 PR・Discussion・拡張登録簿を確認。
利用者の Zed のバージョン・OS は未確認。実機検証・導入・実装は行っていない。
以下の「設計案」は既存の機能ではなく、このプロジェクトでの提案。

## 結論

希望する動作は Zed 本体の変更で実現可能と判断するが、現在の通常の Wasm 拡張 API だけでは
実現できない。校正拡張とは別の責務として管理するのがよいものの、配布形態は通常の拡張ではなく、
本体へのパッチ・フォーク、または機能を限定したタスク＋外部ツールになる。
要件を完全に満たす導入可能な Zed 拡張・フォークは、今回の公開検索では見つからなかった。
非公開・未登録の実装まで存在しないと断定するものではない。

## 現在の仕様

- 自動判定は `"language_detection": false` で無効化できる。手動で選んだ言語は自動判定で変更しない仕様。
  [公式設定](https://zed.dev/docs/reference/all-settings#language-detection)と
  [PR #61412](https://github.com/zed-industries/zed/pull/61412)参照。PR は 2026-08-28 マージ。
  [安定版リリース情報](https://zed.dev/releases/stable)の 1.19.2 に掲載されている。
- 未保存タブのタイトルは、ファイル名がない場合に本文から生成する。
  [MultiBuffer::title / buffer_content_title](https://github.com/zed-industries/zed/blob/main/crates/multi_buffer/src/multi_buffer.rs)
  は先頭の空白を飛ばし、改行または40文字までを使う。この処理に無効化設定は見当たらない。
  本体には `set_title` があるが、通常の拡張へ公開された API ではない。
- Hot Exit 相当の機能は存在する。`session.restore_unsaved_buffers` は未保存本文の復元を制御し、
  `restore_on_startup` は起動時にどのワークスペースを開くかを制御する。
  [公式設定](https://zed.dev/docs/reference/all-settings#session)参照。
  [Editor の serialize](https://github.com/zed-industries/zed/blob/main/crates/editor/src/items.rs)と
  [永続化 DB](https://github.com/zed-industries/zed/blob/main/crates/editor/src/persistence.rs)は、
  パスがない文書も本文を SQLite に保存する。名前付きファイルの定期バックアップだけではない。
- 未保存内容の復元と LSP 接続は別。前者が動いても、ファイルに紐づかないバッファは
  [LspStore::register_buffer_with_language_servers](https://github.com/zed-industries/zed/blob/main/crates/project/src/lsp_store.rs)
  で登録されないため、現行の校正・変換・翻訳サーバーに本文が届かない。
- [通常の Extension API](https://github.com/zed-industries/zed/blob/main/crates/extension_api/src/extension_api.rs)
  は LSP、スラッシュコマンド、MCP、デバッガーなどを対象としている。
  新規タブ作成・編集・終了の汎用イベント購読、タブ名設定、通常の保存動作の差し替えは公開されていない。

まず確認する設定例（既存設定へマージする。設定ファイル全体を置き換えない）:

```json
{
  "language_detection": false,
  "session": { "restore_unsaved_buffers": true },
  "restore_on_startup": "last_session"
}
```

これは固定連番タイトルや未保存バッファへの LSP 接続を実現する設定ではない。
復元の確認では、個別タブを閉じる操作、ウィンドウを閉じる操作、アプリ終了、異常終了を区別する。
「保存せず閉じる」で破棄した文書を後から復元することは、通常終了時のセッション復元とは別の要件。

## 関連する既存実装

| 資料 | 状態・参考になる点 | 要件との差 |
| --- | --- | --- |
| [PR #46557](https://github.com/zed-industries/zed/pull/46557) | 2026-01-23 マージ。フォルダーなし・単独ファイルのウィンドウにも Hot Exit を拡張 | 連番タイトル、LSP 対応は含まない |
| [PR #60477](https://github.com/zed-industries/zed/pull/60477) | 2026-08-24 マージ。macOS の最後のウィンドウを閉じる際の復元不具合を修正 | 保存完了前にセッション状態を消す終了順序の問題への対処 |
| [PR #63213](https://github.com/zed-industries/zed/pull/63213) | マージ済み。終了・更新再起動・リロード時の永続化完了待ち。1.19.2 のリリース情報に掲載 | 復元の基盤として利用する変更 |
| [PR #52810](https://github.com/zed-industries/zed/pull/52810) | マージされたが [#54688](https://github.com/zed-industries/zed/pull/54688) で取り消し | そのまま取り込む候補にはしない |
| [Discussion #24231](https://github.com/zed-industries/zed/discussions/24231) | Persistent scratch buffer の要望。コメントに `.zed/scratch.md` を作成して `zed` で開くタスク例あり | 単一ファイル。連番再利用・保存操作・閉じた文書の管理はない |
| [Discussion #16751](https://github.com/zed-industries/zed/discussions/16751) | 言語対応、管理された一時ファイル、正式保存への移行を含む Scratchpad の提案 | 完成した実装としての提供は確認できない |
| [Raycast Scratchpad](https://www.raycast.com/asnimansari/scratchpad) | macOS 用。指定フォルダーに `.txt` などを作成し Zed で開ける。[ソース](https://github.com/raycast/extensions/tree/42c55bc6e54132c83f6efd0bbed638d90f9c3cb2/extensions/scratchpad/)公開 | Zed の通常の新規文書操作には介入しない。希望する保存・連番再利用を満たす確認はない |
| [the-inconvenience-store/scratchpad](https://github.com/the-inconvenience-store/scratchpad) | GPUI 製の独立アプリ。保存設計の参考候補 | Zed 拡張でも、現在の校正拡張をそのまま使う代替でもない |

[Zed の公式拡張登録簿](https://github.com/zed-industries/extensions/blob/main/extensions.toml)には
`scratch` / `untitled` に一致する登録は見当たらなかった。検索はこの文字列照合に加え、
公開 Web 上の persistent scratch、scratchpad、untitled、hot-exit、tab title に関する検索を行った。

## 設計案

完全な操作感を実現する場合は、本体に「正式保存前だが内部に実ファイルを持つ文書」という状態を追加する。
内部の `.txt` を実際の編集バッファに紐づけて LSP を接続し、UI 上の正式保存先とは区別する。
本文を別ファイルへコピーするだけでは、元の Untitled バッファに LSP は接続されない。

- 新規作成時に空いている最小の正整数を予約し、表示名を `Untitled-N` に固定する。
  同時に空タブを複数作る場合に備えて番号は作成時に予約し、本文の永続化は初回編集からでもよい。
- 永続 ID と表示番号は分離する。例えば内部ファイルは `drafts/<UUID>/Untitled-1.txt`。
  古い `Untitled-1` を復元用に残しつつ新しい `Untitled-1` を作るので、同じパスを上書きしてはいけない。
- 編集中は短い遅延で内部ファイルを安全に更新する。終了・閉じる時は最後の書き込み完了を待つ。
  自動保存の完了と「ユーザーが正式保存したか」は別の状態として管理する。
- 通常の保存操作で保存先を尋ね、成功後に正式なファイルへバッファを付け替える。
  キャンセルや失敗では下書きを維持する。以後は通常の保存動作に戻す。
- 個別タブを閉じたら active から archived に移し、番号を解放する。分割ペインでは最後の表示を閉じた時に解放。
  復元一覧は archived を対象にし、復元時に元の番号が使用中なら別の空き番号を割り当てる。
- アプリ終了時は active の集合を保持し、再起動時に再表示する。個別タブの破棄とアプリ終了を区別する。
- 番号の範囲（ウィンドウ単位かアプリ全体か）と、バックアップの保持期限は実装前に決める。
  保存先は OS に清掃される一時ディレクトリではなく、アプリの永続データ領域にする。

軽量な試作はタスク＋CLI で `.txt` を作成して開き、Zed の autosave を利用する構成にできる。
ただし既存ファイルなので通常の保存は内部ファイルへ保存し、正式保存には「名前を付けて保存」が必要。
通常の新規文書操作すべての置き換え、正確な閉じる検知、番号再利用、破棄後の履歴 UI は別途必要になる。
グローバルな autosave 設定は他のファイルにも影響するため、試作ではメモ専用プロジェクトに限定する。

本体パッチなら既存の永続化を再利用しつつ、下書き管理・保存状態・固定タイトル・LSP 接続を追加するのが
妥当。校正サーバーに文書管理を持たせる設計にはしない。
