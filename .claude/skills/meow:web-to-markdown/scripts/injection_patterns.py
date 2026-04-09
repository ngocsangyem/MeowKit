#!/usr/bin/env python3
"""
injection_patterns.py — Pattern data for Layer 5 injection scanner.

Pattern set vendored from github.com/lasso-security/claude-hooks (MIT, 260409)
MeowKit-specific patterns added for DATA-fence injection and tool-call hijack.

Imported by injection_detect.py — do NOT import scan() from here.
"""

# ---------------------------------------------------------------------------
# Vendored pattern sets
# Only regex strings that compiled cleanly are included; Unicode literal
# patterns (homoglyphs) are implemented separately via char-range checks.
# ---------------------------------------------------------------------------

# instructionOverridePatterns
_INSTRUCTION_OVERRIDE: list[tuple[str, str]] = [
    (r"(?i)\bignore\s+(all\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|guidelines?|directives?|context)",
     "Attempts to ignore previous instructions"),
    (r"(?i)\bforget\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?|training|guidelines?)",
     "Attempts to make AI forget instructions"),
    (r"(?i)\bdisregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|rules?)",
     "Attempts to disregard previous instructions"),
    (r"(?i)\boverride\s+(your\s+|all\s+)?(instructions?|programming|directives?|rules?|guidelines?)",
     "Attempts to override instructions"),
    (r"(?i)\breplace\s+(your\s+)?(instructions?|prompt|guidelines?|rules?)\s+with",
     "Attempts to replace instructions"),
    (r"(?i)\b(do\s+)?not\s+follow\s+(your\s+)?(previous|original|initial)\s+(instructions?|rules?|guidelines?)",
     "Instructs to not follow previous guidelines"),
    (r"(?i)\b(new|updated|revised|real)\s+system\s+prompt\b",
     "Attempts to inject new system prompt"),
    (r"(?i)\bsystem\s+prompt\s*(:|=|override)",
     "System prompt injection marker"),
    (r"(?i)\b(this\s+is\s+)?(your\s+)?new\s+(instructions?|task|objective|mission|directive)",
     "Attempts to set new instructions"),
    (r"(?i)\bfrom\s+now\s+on[,\s]+(you\s+)?(will|must|should|are)",
     "Attempts to redefine behavior going forward"),
    (r"(?i)\bthis\s+(instruction|command|task|directive)\s+(takes?\s+)?(priority|precedence)\s+over",
     "Attempts to take priority over other instructions"),
    (r"(?i)\b(more\s+)?important\s+than\s+(your\s+)?(original|previous|other)\s+(instructions?|rules?)",
     "Claims higher importance than existing instructions"),
    (r"(?i)\breset\s+(your\s+)?(context|memory|instructions?|state|conversation)",
     "Attempts to reset context"),
    (r"(?i)\bclear\s+(your\s+)?(memory|context|instructions?|history|state)",
     "Attempts to clear memory/context"),
    (r"(?i)\bwipe\s+(your\s+)?(memory|context|slate)",
     "Attempts to wipe memory"),
    (r"(?i)\bend\s+(of\s+)?(system\s+)?(prompt|instructions?)\b.*\b(new|begin|start)",
     "Fake end-of-prompt marker"),
    (r"(?i)\[/?system\]|\{/?system\}|</?system\s*>",
     "Fake system message markers"),
    (r"(?i)\[\[SYSTEM\]\]|\(\(SYSTEM\)\)|\{\{SYSTEM\}\}",
     "Fake system block markers"),
]

# rolePlayingPatterns
_ROLE_PLAYING: list[tuple[str, str]] = [
    (r"(?i)\byou\s+are\s+(now\s+)?DAN\b", "DAN jailbreak attempt"),
    (r"(?i)\bDAN\s+(mode|persona|character|version)\b", "DAN mode activation attempt"),
    (r"(?i)\b(do|does)\s+anything\s+now\b", "DAN Do Anything Now pattern"),
    (r"(?i)\bjailbreak(ed)?\s+(mode|prompt|version|enabled)\b", "Explicit jailbreak attempt"),
    (r"(?i)\b(enable|activate|enter)\s+(jailbreak|unrestricted|god)\s*mode",
     "Mode activation jailbreak"),
    (r"(?i)\bDEVELOPER\s+MODE\s+(ENABLED|ACTIVATED|ON)",
     "Fake developer mode activation"),
    (r"(?i)\byou\s+are\s+(now\s+)?(a|an)\s+(different|new|unrestricted|unfiltered|uncensored)",
     "Persona change to unrestricted AI"),
    (r"(?i)\broleplay\s+as\s+(an?\s+)?(unrestricted|unfiltered|uncensored|evil)",
     "Unrestricted roleplay request"),
    (r"(?i)\b(without|ignore|bypass|disable|remove)\s+(your\s+)?(restrictions?|filters?|safeguards?|limitations?|guardrails?)",
     "Restriction bypass attempt"),
    (r"(?i)\b(remove|turn\s+off|disable|deactivate)\s+(your\s+)?(ethical|safety|content)\s+(guidelines?|filters?|restrictions?)",
     "Safety filter disable attempt"),
    (r"(?i)\bunrestricted\s+(mode|access|version|output)",
     "Unrestricted mode request"),
    (r"(?i)\buncensored\s+(mode|version|response|output)",
     "Uncensored mode request"),
    (r"(?i)\b(evil|shadow|dark|unrestricted|uncensored)\s+(twin|version|mode|side|alter\s*ego)\b",
     "Evil twin persona attempt"),
    (r"(?i)\byour\s+(evil|dark|shadow|unrestricted)\s+(side|self|version)",
     "Dark side persona request"),
]

# encodingPatterns (string-based; char-range homoglyphs handled separately)
_ENCODING_OBFUSCATION: list[tuple[str, str]] = [
    (r"(?i)\bdecode\s+(this\s+|the\s+)?base64\b", "Base64 decode instruction"),
    (r"(?i)\bexecute\s+(the\s+)?decoded\s+(base64|content|string)",
     "Decoded content execution request"),
    (r"(?i)\bdecode\s+(this\s+|the\s+)?hex(adecimal)?\b", "Hex decode instruction"),
    (r"\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2}){5,}", "Hex escaped string sequence"),
    (r"(?i)\b(1gn0r3|f0rg3t|d1sr3g4rd|0v3rr1d3)\b", "Leetspeak instruction keywords"),
    (r"(?i)\b(syst3m|pr0mpt|1nstruct10n[s5]?)\b", "Leetspeak system/prompt terms"),
    (r"(?i)\b(j41lbr34k|byp4ss|h4ck)\b", "Leetspeak jailbreak terms"),
    (r"(?i)\bdecode\s+(this\s+)?(rot13|rot-13|caesar|cipher)\b",
     "ROT13/Caesar cipher decode request"),
    (r"(?i)\breverse\s+(this|the\s+following)\s+(text|string|message)\s+and\s+(execute|follow)",
     "Reverse text with execution"),
]

# contextManipulationPatterns
_CONTEXT_MANIPULATION: list[tuple[str, str]] = [
    (r"(?i)\b(anthropic|openai|claude\s*team|google|meta)\s+(says?|requires?|demands?|orders?|instructs?)\b",
     "False authority invocation (AI company)"),
    (r"(?i)\b(official|authorized|verified)\s+(instruction|message|update|command)\s+from\s+(anthropic|openai|claude)",
     "Fake official message"),
    (r"(?i)\b(system\s+)?(administrator|admin|root|superuser)\s+(message|override|instruction|command)",
     "Fake admin message"),
    (r"(?i)\bdeveloper\s+(mode|override|access)\s+(enabled|activated|granted)",
     "Fake developer mode claim"),
    (r"(?i)\b(internal|debug|test)\s+mode\s+(enabled|activated|on)",
     "Fake internal/debug mode"),
    (r"<!--\s*(ignore|disregard|override|system|instruction|prompt|forget)",
     "Instruction hidden in HTML comment"),
    (r"/\*\s*(ignore|disregard|override|system|instruction|prompt|forget)",
     "Instruction hidden in code comment"),
    (r'(?i)\{"role"\s*:\s*"system"', "Fake system role JSON"),
    (r"(?i)<system[^>]*>|<instruction[^>]*>|<override[^>]*>",
     "Fake system XML/HTML tags"),
    (r"(?i)<hidden>|<invisible>|<secret>", "Hidden content HTML tags"),
    (r"(?i)\[INST\]|\[/INST\]|\[SYS\]|\[/SYS\]", "Fake instruction block markers"),
    (r"(?i)\bprevious\s+conversation\s+(summary|context|history)\s*:",
     "Fake previous conversation injection"),
    (r"(?i)\buser\s+(profile|context|role)\s*[:\s].*\b(admin|root|developer|superuser)",
     "Fake admin user profile"),
    (r"(?i)\bin\s+our\s+(last|previous)\s+conversation\s+you\s+(agreed|said|confirmed)",
     "Fake previous agreement claim"),
    (r"(?i)\byou\s+(previously|earlier|already)\s+(said|agreed|confirmed|promised)\s+that",
     "Fake prior confirmation claim"),
    (r"(?i)\bignore\s+everything\s+(before|after|above|below)\s+this\s+(line|point|marker)",
     "Instruction boundary manipulation"),
    (r"(?i)\b(real|actual|true)\s+(instruction|prompt|task|command)\s*(starts?|begins?)?\s*(here|below|now)",
     "Fake real instruction marker"),
    (r"(?i)\bthe\s+above\s+(was|is)\s+(just\s+)?(a\s+)?(test|joke|fake|distraction)",
     "Dismisses previous content as fake"),
    (r"(?i)\b(show|reveal|tell|display|print|output)\s+(me\s+)?(your\s+)?(full\s+)?(system\s+)?prompt",
     "System prompt extraction attempt"),
    (r"(?i)\brepeat\s+(your\s+)?(system\s+)?(prompt|instructions?)\s+(back|verbatim|exactly)",
     "Prompt repetition extraction"),
]

# MeowKit-specific: DATA-fence injection, tool-call hijack, memory poisoning
_MEOWKIT_SPECIFIC: list[tuple[str, str]] = [
    # Attacker mimicking our exact wrapper open-fence — never appears legitimately in fetched content
    # (bare closing fences removed: every markdown page has them → CRITICAL false-positive storm)
    (r"```fetched-markdown", "DATA-fence wrapper mimicry (attacker replicating our open-fence marker)"),
    # Tool-call hijack: tightened to imperative + now/immediately/below to avoid tutorial false-positives
    # e.g. "now invoke the Bash tool" / "use the Write tool to save" are suspicious;
    # "you can use the Read tool" in a tutorial is not.
    (r"(?i)\b(now|immediately|next[,\s])\s+(call|use|invoke|run|execute)\s+the\s+(Write|Bash|Read|Edit|Task|Glob|Grep)\s+tool\b",
     "Tool-call hijack attempt (imperative)"),
    (r"(?i)\b(call|use|invoke|run|execute)\s+the\s+(Write|Bash|Edit)\s+tool\s+(to\s+)?(write|create|save|append|delete|overwrite)\b",
     "Tool-call hijack attempt (destructive action)"),
    # File-write hijack: tightened to imperative + specific path patterns to avoid docs false-positives
    # "create a file with your config" is innocent; "create a file with path /etc/passwd containing" is not.
    (r"(?i)\b(write|create|save|append)\s+a?\s*file\s+(at|to|in|named?)\s+['\"/~.]",
     "Implicit file-write hijack (path-targeted)"),
    (r"(?i)\b(write|create|save|append)\s+(to\s+file|a?\s*file)\s+that\s+says",
     "Implicit file-write hijack (content injection)"),
    # Memory poisoning
    (r"(?i)\badd\s+this\s+to\s+(your\s+)?(memory|memory\s+file|lessons)",
     "Memory poisoning attempt"),
    (r"(?i)\bremember\s+that\s+(from\s+now|always|you\s+are|you\s+must|you\s+should)",
     "Memory rewrite attempt"),
    (r"(?i)\bupdate\s+your\s+(memory|lessons|rules|instructions)\s+(to|with|saying)",
     "Memory update injection"),
    # Cross-skill trust bypass
    (r"(?i)--wtm-accept-risk",
     "Possible cross-skill flag injection in fetched content"),
]
