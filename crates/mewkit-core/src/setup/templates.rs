//! File contents setup writes when the kit's own template is absent (no scaffold yet).

pub const DEFAULT_MCP: &str = r#"{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
"#;

pub const DEFAULT_ENV: &str = "# MeowKit Environment Variables
# Never commit this file to git. Shell exports take precedence.

# Gemini (recommended \u{2014} analysis, image gen, video gen)
# Get from: https://aistudio.google.com/apikey
MEOWKIT_GEMINI_API_KEY=

# MiniMax (optional \u{2014} TTS, music, Hailuo video, image fallback)
# Get from: https://platform.minimax.io/
# MEOWKIT_MINIMAX_API_KEY=

# OpenRouter (optional \u{2014} image gen fallback)
# Get from: https://openrouter.ai/keys
# MEOWKIT_OPENROUTER_API_KEY=
# MEOWKIT_OPENROUTER_FALLBACK_ENABLED=true

";

/// Mirrors `.meowkit/gitignore.meowkit`; used only when that template is absent.
pub const DEFAULT_GITIGNORE: &str = "# MeowKit
.env
.env.local
session-state/
tasks/reports/
.claude/logs/

";

/// `.meowkit/.gitignore`: deny everything, then re-include what a team shares.
/// Deny-all fails safe: a new machine-written class is ignored until someone
/// decides it should be shared.
pub const KIT_DIR_GITIGNORE: &str = "*
!.gitignore
!config.yaml
!.env.example
!mcp.json.example
!bin/
!bin/mewkit
!memory/
!memory/*.md
";
