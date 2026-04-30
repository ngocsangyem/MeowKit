# Python Error Reference

Common Python exceptions with fix patterns. Load when error output contains Python tracebacks.

## Error Catalog

### SyntaxError

**Message:** `SyntaxError: invalid syntax` or `SyntaxError: unexpected EOF`
**Class:** auto-fixable
**Fix:**
1. Check the line indicated AND the line above (Python reports the line after the error)
2. Common causes: missing `:` after `if`/`for`/`def`/`class`, unclosed `(`, `[`, `{`, `'`, `"`
3. Check for `print "x"` (Python 2 syntax in Python 3 file)

```python
# Common fix patterns
if condition:   # <- missing colon is frequent
    pass

open_list = [   # <- unclosed bracket across lines
    item1,
    item2,
]               # <- close bracket required
```

### IndentationError

**Message:** `IndentationError: unexpected indent` or `IndentationError: expected an indented block`
**Class:** auto-fixable
**Fix:**
1. Check for mixed tabs and spaces — standardize to 4 spaces
2. `unexpected indent` → remove extra indentation
3. `expected indented block` → add body to `if`/`for`/`def`/`class` (use `pass` if intentionally empty)

### ModuleNotFoundError

**Message:** `ModuleNotFoundError: No module named 'X'`
**Class:** auto-fixable
**Fix:**
1. Install missing package: `pip install X` (or check venv is active)
2. Check if it's a local module → verify `__init__.py` exists in the package dir
3. Check PYTHONPATH if it's a custom path module
4. For skills: use `.claude/skills/.venv/bin/python3`

### ImportError

**Message:** `ImportError: cannot import name 'X' from 'Y'`
**Class:** suggest-with-confidence
**Fix:**
1. `X` doesn't exist in module `Y` → check module docs for correct name
2. Circular import → restructure to break the cycle (move shared code to a third module)
3. Package version mismatch → check if `X` was added/removed in a specific version

### TypeError

**Message:** `TypeError: X() takes N positional arguments but M were given`
**Class:** suggest-with-confidence
**Fix:**
1. Count the arguments in the call vs the function signature
2. Check if `self` is missing in class methods
3. Check for missing `*` for variadic args or `**` for keyword args
4. Check for `None` being called as a function: `result()` where `result` is `None`

**Message:** `TypeError: unsupported operand type(s)`
**Class:** suggest-with-confidence
**Fix:** Add type conversion: `int(x)`, `str(x)`, `float(x)` as appropriate.

### AttributeError

**Message:** `AttributeError: 'X' object has no attribute 'Y'`
**Class:** suggest-with-confidence
**Fix:**
1. Typo → correct attribute name
2. `NoneType` has no attribute → add `if obj is not None:` guard before access
3. Wrong type returned from function → trace where `obj` was assigned

### FileNotFoundError

**Message:** `FileNotFoundError: [Errno 2] No such file or directory: 'X'`
**Class:** suggest-with-confidence
**Fix:**
1. Check the path relative to the working directory (`os.getcwd()`)
2. Use `pathlib.Path(__file__).parent / 'relative/path'` for paths relative to the script
3. Create the directory if missing: `os.makedirs(path, exist_ok=True)`

## Quick Lookup by Symptom

| Symptom | Likely Error | Class |
|---------|-------------|-------|
| Missing colon, bracket | SyntaxError | auto-fixable |
| Mixed tabs/spaces | IndentationError | auto-fixable |
| Package not installed | ModuleNotFoundError | auto-fixable |
| Wrong import name | ImportError | suggest |
| Wrong arg count or None call | TypeError | suggest |
| Typo or None.attr | AttributeError | suggest |
| Wrong file path | FileNotFoundError | suggest |
