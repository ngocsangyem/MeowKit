#!/bin/sh
# post-write.sh — Security scan on every written file.
# Usage: post-write.sh <file-path>

FILE="$1"

if [ -z "$FILE" ]; then
  echo "Usage: post-write.sh <file-path>"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE"
  exit 1
fi

FILENAME=$(basename "$FILE")
EXT="${FILENAME##*.}"
HAS_BLOCK=0
HAS_WARN=0
HAS_FINDING=0

check_pattern() {
  _severity="$1"
  _description="$2"
  _pattern="$3"
  _file="$4"
  _fname=$(basename "$_file")

  _results=$(grep -n "$_pattern" "$_file" 2>/dev/null || true)
  if [ -n "$_results" ]; then
    echo "$_results" | while IFS= read -r line; do
      _linenum=$(echo "$line" | cut -d: -f1)
      echo "$_severity — $_description at line $_linenum in $_fname"
    done
    if [ "$_severity" = "BLOCK" ]; then
      return 1
    fi
    return 2
  fi
  return 0
}

# Returns: sets HAS_BLOCK/HAS_WARN via subshell workaround
run_check() {
  _severity="$1"
  _description="$2"
  _pattern="$3"
  _file="$4"

  _results=$(grep -n "$_pattern" "$_file" 2>/dev/null || true)
  if [ -n "$_results" ]; then
    _fname=$(basename "$_file")
    echo "$_results" | while IFS= read -r line; do
      _linenum=$(echo "$line" | cut -d: -f1)
      echo "$_severity — $_description at line $_linenum in $_fname"
    done
    if [ "$_severity" = "BLOCK" ]; then
      echo "__BLOCK__"
    else
      echo "__WARN__"
    fi
  fi
}

OUTPUT=""

case "$EXT" in
  ts|js)
    OUTPUT=$(
      run_check "BLOCK" "Hardcoded secret detected" 'api_key=\|apiKey=\|secret=\|password=\|token=' "$FILE"
      run_check "BLOCK" "Usage of 'any' type" ': any\|as any' "$FILE"
      run_check "WARN" "process.env without validation" 'process\.env\.' "$FILE"
      run_check "BLOCK" "Potential SQL injection via template literal" '`[^`]*\(SELECT\|INSERT\|UPDATE\|DELETE\)' "$FILE"
      run_check "BLOCK" "JWT secret in source code" 'jwt.*secret.*=.*["\x27]' "$FILE"
    )
    ;;
  vue)
    OUTPUT=$(
      run_check "BLOCK" "v-html with dynamic content (XSS risk)" 'v-html' "$FILE"
      run_check "BLOCK" "localStorage used for tokens/auth" 'localStorage.*token\|localStorage.*auth' "$FILE"
    )
    ;;
  swift)
    OUTPUT=$(
      run_check "BLOCK" "UserDefaults used for sensitive data" 'UserDefaults.*password\|UserDefaults.*token\|UserDefaults.*secret' "$FILE"
      run_check "BLOCK" "Disabled certificate validation" 'allowsInvalidSSLCertificate\|disableCertificatePinning' "$FILE"
    )
    ;;
  sql)
    OUTPUT=$(
      run_check "BLOCK" "RLS disabled" 'ENABLE ROW LEVEL SECURITY.*false\|NO FORCE ROW LEVEL SECURITY' "$FILE"
      run_check "WARN" "CASCADE DELETE detected — review carefully" 'CASCADE' "$FILE"
    )
    ;;
  *)
    echo "PASS — no security checks for .$EXT files [$FILENAME]"
    exit 0
    ;;
esac

# Parse output for block/warn markers
if echo "$OUTPUT" | grep -q "__BLOCK__"; then
  HAS_BLOCK=1
fi
if echo "$OUTPUT" | grep -q "__WARN__"; then
  HAS_WARN=1
fi

# Print findings without markers
CLEAN_OUTPUT=$(echo "$OUTPUT" | grep -v "^__BLOCK__$" | grep -v "^__WARN__$" | grep -v "^$" || true)

if [ -z "$CLEAN_OUTPUT" ]; then
  echo "PASS — no issues found in $FILENAME"
  exit 0
fi

echo "$CLEAN_OUTPUT"

if [ "$HAS_BLOCK" -eq 1 ]; then
  exit 1
fi

exit 0
