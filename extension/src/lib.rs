use zed_extension_api::{self as zed, settings::LspSettings, Result};

struct TextTools;

impl zed::Extension for TextTools {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let settings = LspSettings::for_worktree(id.as_ref(), worktree)?;
        let binary = settings
            .binary
            .ok_or("Set lsp.text-tools.binary.path and arguments in Zed settings")?;
        Ok(zed::Command {
            command: binary
                .path
                .ok_or("Set lsp.text-tools.binary.path to node")?,
            args: binary.arguments.unwrap_or_default(),
            env: Default::default(),
        })
    }
}

zed::register_extension!(TextTools);
