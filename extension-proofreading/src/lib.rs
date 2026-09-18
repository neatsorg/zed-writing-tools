use std::{env, fs};
use zed_extension_api::{self as zed, settings::LspSettings, Result};

struct TextToolsProofreading;

// サーバー配布物は `npm run build:server-dist -- proofreading` で生成し、
// `npm run deploy:server-dev -- proofreading` で拡張の作業ディレクトリ
// （この Wasm から見た current_dir）に配置する。変換拡張とはディレクトリ名を分け、
// 校正拡張の配布物にのみ textlint 系の依存が含まれるようにする。
const SERVER_DIST_DIR: &str = "text-tools-proofreading-server";
const CURRENT_VERSION_FILE: &str = "CURRENT_VERSION";

// `lsp.text-tools-proofreading.binary` に明示設定が無いときのデフォルトの起動引数。
// 拡張の作業ディレクトリ配下の `text-tools-proofreading-server/<version>/src/lsp/proofreading-server.js`
// を絶対パスで指す。
fn default_server_args() -> Result<Vec<String>> {
    let work_dir = env::current_dir().map_err(|error| error.to_string())?;
    let version_file = work_dir.join(SERVER_DIST_DIR).join(CURRENT_VERSION_FILE);
    let version = fs::read_to_string(&version_file).map_err(|_| {
        format!(
            "サーバー配布物が見つかりません（{}）。校正用の配布物を生成・配置してください。",
            version_file.display()
        )
    })?;
    let version = version.trim();
    if version.is_empty() {
        return Err(format!("{} が空です。配布物を再生成してください。", version_file.display()));
    }
    let server_path = work_dir
        .join(SERVER_DIST_DIR)
        .join(version)
        .join("src/lsp/proofreading-server.js");
    if !server_path.exists() {
        return Err(format!(
            "サーバー本体が見つかりません（{}）。`npm run deploy:server-dev` を再実行してください。",
            server_path.display()
        ));
    }
    Ok(vec![server_path.to_string_lossy().into_owned(), "--stdio".to_string()])
}

impl zed::Extension for TextToolsProofreading {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let settings = LspSettings::for_worktree(id.as_ref(), worktree)?;
        let binary = settings.binary;
        let path = binary.as_ref().and_then(|binary| binary.path.clone());
        let arguments = binary.as_ref().and_then(|binary| binary.arguments.clone());
        Ok(zed::Command {
            // 明示設定があれば優先する。無ければ Zed が使う Node を自動解決する。
            command: match path {
                Some(path) => path,
                None => zed::node_binary_path()?,
            },
            // 明示設定があれば優先する。無ければ配置済みのサーバー配布物を自動解決する。
            args: match arguments {
                Some(arguments) => arguments,
                None => default_server_args()?,
            },
            env: Default::default(),
        })
    }
}

zed::register_extension!(TextToolsProofreading);
