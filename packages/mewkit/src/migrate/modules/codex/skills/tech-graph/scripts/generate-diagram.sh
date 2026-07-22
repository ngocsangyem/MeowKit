#!/bin/bash
# SVG Diagram Generation — Validates and exports SVG diagrams with optional PNG export.
# PNG export requires rsvg-convert (librsvg). Degrades gracefully to SVG-only when absent.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
STYLE="1"
WIDTH="1920"
OUTPUT_DIR="."
VALIDATE=true

# Valid diagram types
VALID_TYPES="architecture|data-flow|flowchart|sequence|comparison|timeline|mind-map|agent|memory|use-case|class|state-machine|er-diagram|network-topology"

usage() {
    cat << USAGE
Usage: $0 [OPTIONS]

Options:
    -t, --type TYPE        Diagram type ($VALID_TYPES)
    -s, --style STYLE      Style number (1-8, default: 1)
    -o, --output PATH      Output SVG path (default: <type>-style<N>.svg in current dir)
    -w, --width WIDTH      PNG width in pixels (default: 1920)
    --no-validate          Skip validation
    -h, --help             Show this help

Examples:
    $0 -t architecture -s 1 -o ./output/arch.svg
    $0 -t class -s 2 -w 2400
    $0 -t sequence -s 6

PNG export requires rsvg-convert. If absent, SVG is emitted only.
USAGE
    exit 0
}

# Parse arguments — all values read from positional "$2" (never eval or shell-expand user input)
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TYPE="$2"
            shift 2
            ;;
        -s|--style)
            STYLE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_PATH="$2"
            shift 2
            ;;
        -w|--width)
            WIDTH="$2"
            shift 2
            ;;
        --no-validate)
            VALIDATE=false
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}" >&2
            usage
            ;;
    esac
done

# Check required parameters
if [ -z "${TYPE:-}" ]; then
    echo -e "${RED}Error: Diagram type is required${NC}" >&2
    usage
fi

# Validate type against fixed allowlist (prevents injection via TYPE variable)
VALID_TYPE=false
for t in architecture data-flow flowchart sequence comparison timeline mind-map agent memory use-case class state-machine er-diagram network-topology; do
    if [ "$TYPE" = "$t" ]; then
        VALID_TYPE=true
        break
    fi
done

if [ "$VALID_TYPE" = false ]; then
    echo -e "${RED}Error: Invalid diagram type '$TYPE'${NC}" >&2
    echo "Valid types: $VALID_TYPES" >&2
    exit 1
fi

# Validate STYLE is a positive integer (prevents injection via STYLE variable)
if ! [[ "$STYLE" =~ ^[1-9][0-9]*$ ]]; then
    echo -e "${RED}Error: Style must be a positive integer, got: $STYLE${NC}" >&2
    exit 1
fi

# Validate WIDTH is a positive integer
if ! [[ "$WIDTH" =~ ^[1-9][0-9]*$ ]]; then
    echo -e "${RED}Error: Width must be a positive integer, got: $WIDTH${NC}" >&2
    exit 1
fi

# Determine output path
if [ -z "${OUTPUT_PATH:-}" ]; then
    BASENAME="${TYPE}-style${STYLE}"
    SVG_FILE="${OUTPUT_DIR}/${BASENAME}.svg"
    PNG_FILE="${OUTPUT_DIR}/${BASENAME}.png"
else
    SVG_FILE="$OUTPUT_PATH"
    PNG_FILE="${OUTPUT_PATH%.svg}.png"
fi

echo -e "${BLUE}Generating ${TYPE} diagram (style ${STYLE})...${NC}"
echo "Output: $SVG_FILE"

# Load style reference
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STYLE_FILE=$(find "${SKILL_DIR}/references" -maxdepth 1 -type f -name "style-${STYLE}-*.md" | head -n 1)

if [ -z "${STYLE_FILE:-}" ] || [ ! -f "$STYLE_FILE" ]; then
    echo -e "${RED}Error: Style reference not found for style ${STYLE}${NC}" >&2
    echo "Available styles: 1-8" >&2
    exit 1
fi

# Note: Actual SVG generation is performed by the AI agent following SKILL.md instructions.
# This script handles validation and export only.

echo -e "${YELLOW}Note: SVG content generation is performed by the AI agent.${NC}"
echo -e "${YELLOW}This script validates and exports an already-generated SVG.${NC}"

# Validate if SVG exists
if [ -f "$SVG_FILE" ]; then
    if [ "$VALIDATE" = true ]; then
        echo -e "\n${BLUE}Validating SVG...${NC}"
        if "${SKILL_DIR}/scripts/validate-svg.sh" "$SVG_FILE"; then
            echo -e "${GREEN}Validation passed${NC}"
        else
            echo -e "${RED}Validation failed${NC}" >&2
            exit 1
        fi
    fi

    # Export PNG — fail-closed on missing rsvg-convert: emit hint, continue with SVG only
    echo -e "\n${BLUE}Exporting PNG (width: ${WIDTH}px)...${NC}"
    if command -v rsvg-convert &>/dev/null; then
        if rsvg-convert -w "$WIDTH" "$SVG_FILE" -o "$PNG_FILE" 2>/dev/null; then
            PNG_SIZE=$(du -h "$PNG_FILE" | cut -f1)
            echo -e "${GREEN}PNG exported: $PNG_FILE (${PNG_SIZE})${NC}"
        else
            echo -e "${RED}PNG export failed (rsvg-convert error)${NC}" >&2
            exit 1
        fi
    else
        echo -e "${YELLOW}PNG skipped: rsvg-convert not found.${NC}"
        echo -e "${YELLOW}Install: brew install librsvg         # macOS${NC}"
        echo -e "${YELLOW}         sudo apt install librsvg2-bin  # Debian/Ubuntu${NC}"
        echo -e "${GREEN}SVG is a fully usable artifact: $SVG_FILE${NC}"
    fi
else
    echo -e "${YELLOW}SVG file not found at $SVG_FILE — generate it first.${NC}" >&2
    exit 1
fi

echo -e "\n${GREEN}Done${NC}"
