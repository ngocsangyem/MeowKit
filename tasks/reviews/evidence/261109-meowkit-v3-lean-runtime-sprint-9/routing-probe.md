# routing-probe.sh

Verbatim copy, wrapped in markdown so this evidence commit carries no ship-capable path.

````bash
#!/bin/bash
# Bounded live routing probe: for each integration journey spec, present the CURRENT
# always-listed integration metadata (name + description + when_to_use, exactly the fields
# the budget extractor measures) plus the journey prompt, and ask for one leaf skill id.
# Run from a scratch cwd so no session artifact lands in the repository.
set -u
REPO=/Users/sangnguyen/Desktop/MeowKit
WORK="${1:?scratch dir}"
CLAUDE=/Users/sangnguyen/.local/bin/claude
mkdir -p "$WORK"

# 1. Render the metadata block from the live tree.
PATH=/opt/homebrew/opt/node@24/bin:$PATH node - "$REPO" > "$WORK/metadata.txt" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const dir = path.join(root, ".claude", "skills");
const names = fs.readdirSync(dir).filter((n) => /^(jira|confluence)(-|$)|^story-sizer$/.test(n)).sort();
const field = (fm, key) => {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!m) return "";
  let v = m[1].trim();
  if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
  else if (/^".*"$/.test(v)) v = v.slice(1, -1);
  return v;
};
for (const n of names) {
  const file = path.join(dir, n, "SKILL.md");
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const fm = text.split(/^---$/m)[1] || "";
  console.log(`- id: ${field(fm, "name")}`);
  console.log(`  description: ${field(fm, "description")}`);
  console.log(`  when_to_use: ${field(fm, "when_to_use")}`);
}
NODE

# 2. One call per integration journey spec.
PATH=/opt/homebrew/opt/node@24/bin:$PATH node - "$REPO" > "$WORK/specs.tsv" <<'NODE'
const fs = require("node:fs");
const lines = fs.readFileSync(`${process.argv[2]}/tests/journey-validation/journey-specs.jsonl`, "utf8").split("\n");
for (const line of lines) {
  if (!line.trim()) continue;
  const j = JSON.parse(line);
  if (!/^j1[3-9]/.test(j.id)) continue;
  console.log([j.id, j.expected_route, j.prompt].join("\t"));
}
NODE

: > "$WORK/results.txt"
while IFS=$'\t' read -r id expected prompt; do
  {
    echo "You are routing one user request to exactly one MeowKit integration skill."
    echo "These are the only candidates, given as the metadata a session lists before any skill runs:"
    echo
    cat "$WORK/metadata.txt"
    echo
    echo "User request: ${prompt}"
    echo
    echo "Answer with the single skill id only (e.g. mk:jira-search). No prose, no explanation."
  } > "$WORK/prompt-$id.txt"

  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  out=$(cd "$WORK" && "$CLAUDE" -p --output-format json --disallowed-tools Bash Edit Write WebFetch WebSearch < "prompt-$id.txt" 2>&1)
  code=$?
  result=$(printf '%s' "$out" | PATH=/opt/homebrew/opt/node@24/bin:$PATH node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(JSON.stringify({result:j.result,model:Object.keys(j.modelUsage||{})[0],is_error:j.is_error,subtype:j.subtype}));}catch(e){console.log(JSON.stringify({raw:s.slice(0,800)}));}})')
  {
    echo "=== $id"
    echo "started_utc: $started"
    echo "exit: $code"
    echo "expected: $expected"
    echo "$result"
  } >> "$WORK/results.txt"
  echo "done $id (exit $code)"
done < "$WORK/specs.tsv"
echo "---- results at $WORK/results.txt"
````
