use std::{
    env, fs,
    path::{Path, PathBuf},
};
use zed_extension_api::{self as zed, settings::LspSettings, Result};

struct WritingToolsProofreading;

const SERVER_DIST_DIR: &str = "writing-tools-proofreading-server";
const SERVER_VERSION: &str = "0.1.0";
const RELEASE_TAG: &str = "v0.1.0";
const RELEASE_REPOSITORY: &str = "neatsorg/zed-writing-tools";
const RELEASE_ASSET: &str = "writing-tools-proofreading-server-0.1.0.tar.gz";
const SERVER_ENTRY: &str = "src/lsp/proofreading-server.js";

fn server_path(work_dir: &Path) -> PathBuf {
    work_dir
        .join(SERVER_DIST_DIR)
        .join(SERVER_VERSION)
        .join(SERVER_ENTRY)
}

fn ensure_server(language_server_id: &zed::LanguageServerId) -> Result<PathBuf> {
    let work_dir = env::current_dir().map_err(|error| error.to_string())?;
    let server_path = server_path(&work_dir);
    if server_path.is_file() {
        return Ok(server_path);
    }
    zed::set_language_server_installation_status(
        language_server_id,
        &zed::LanguageServerInstallationStatus::Downloading,
    );
    let release = zed::github_release_by_tag_name(RELEASE_REPOSITORY, RELEASE_TAG)?;
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.name == RELEASE_ASSET)
        .ok_or_else(|| format!("GitHub Release {RELEASE_TAG} に {RELEASE_ASSET} がありません。"))?;
    let relative_dir = format!("{SERVER_DIST_DIR}/{SERVER_VERSION}");
    fs::create_dir_all(work_dir.join(SERVER_DIST_DIR)).map_err(|error| error.to_string())?;
    zed::download_file(
        &asset.download_url,
        &relative_dir,
        zed::DownloadedFileType::GzipTar,
    )
    .map_err(|error| format!("サーバーのダウンロードに失敗しました: {error}"))?;
    if !server_path.is_file() {
        return Err(format!(
            "サーバーを展開しましたが、{} が見つかりません。",
            server_path.display()
        ));
    }
    zed::set_language_server_installation_status(
        language_server_id,
        &zed::LanguageServerInstallationStatus::None,
    );
    Ok(server_path)
}

impl zed::Extension for WritingToolsProofreading {
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
        let arguments = match arguments {
            Some(arguments) => arguments,
            None => {
                let server_path = ensure_server(id)?;
                vec![
                    server_path.to_string_lossy().into_owned(),
                    "--stdio".to_string(),
                ]
            }
        };
        Ok(zed::Command {
            command: match path {
                Some(path) => path,
                None => zed::node_binary_path()?,
            },
            args: arguments,
            env: Default::default(),
        })
    }
}

zed::register_extension!(WritingToolsProofreading);
