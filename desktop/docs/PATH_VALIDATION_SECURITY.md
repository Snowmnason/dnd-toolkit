# Cross-Platform Path Validation Security

## Problem

The original protocol handler code used simple `startsWith()` comparison to validate that file paths stayed within the `resources/web-build/` directory:

```typescript
// ❌ Problematic approach
if (!resolvedCandidate.startsWith(resolvedRoot)) {
  // Block path traversal
}
```

This approach fails on Windows for several reasons:

### Windows Path Issues

1. **Case Sensitivity**
   - `C:\Users\App\web-build` ≠ `c:\users\app\web-build` (string comparison)
   - While Windows treats these as identical paths, `startsWith()` is case-sensitive
   - `path.resolve()` doesn't normalize case on Windows

2. **Path Separator Inconsistency**
   - Mixed separators: `C:\path/to\file` after joining/resolving
   - `path.normalize()` ensures consistent separators but doesn't solve case issue

3. **Example Attack That Could Slip Through**

   ```
   Root:     C:\Users\App\web-build
   Attempt:  c:\users\app\web-build\..\..\..\windows\system32\config

   Result:   startsWith() returns false (case difference)
            But paths are actually equivalent on Windows!
   ```

## Solution

Replaced all path traversal validation with a robust cross-platform approach using `path.relative()`:

```typescript
// ✅ Robust approach
function isPathWithinRoot(resolvedPath: string, allowedRoot: string): boolean {
  const normalizedPath = path.normalize(resolvedPath);
  const normalizedRoot = path.normalize(allowedRoot);

  // path.relative() handles Windows case-insensitivity automatically
  const relative = path.relative(normalizedRoot, normalizedPath);

  return !relative.startsWith("..") && !path.isAbsolute(relative);
}
```

### Why `path.relative()` Works

| Platform | Case Sensitivity              | Behavior                                            |
| -------- | ----------------------------- | --------------------------------------------------- |
| Windows  | Case-insensitive              | Returns normalized relative path regardless of case |
| macOS    | Case-insensitive (by default) | Returns normalized relative path                    |
| Linux    | Case-sensitive                | Preserves exact case, validates accurately          |

### Attack Prevention

The solution blocks all known path traversal attacks:

1. **Direct traversal**: `../../etc/passwd`
   - `path.relative()` returns `..` prefix → blocked

2. **Case-based bypass (Windows)**
   - `c:\users\app\web-build\..\windows\system32`
   - `path.relative()` normalizes case → correctly detected as `..` → blocked

3. **Absolute path injection**
   - `/etc/passwd` or `C:\Windows\System32`
   - `path.isAbsolute()` detects and blocks

4. **Mixed separators**
   - `..\..\etc\passwd` or `../../etc/passwd`
   - `path.normalize()` ensures consistent handling → blocked

## Implementation Details

### Key Functions Using `isPathWithinRoot()`

1. **Protocol Handler** (`lines ~530`)
   - Validates file requests to `app://` protocol
   - Ensures all files served from `resources/web-build/`

2. **Safe File Operations** (`lines ~135, ~172, ~207`)
   - `safeFileExists()` - validates before checking existence
   - `safeReadFile()` - validates before reading
   - `safeReadDir()` - validates before listing directory

3. **User Data Directory** (`line ~315`)
   - Validates paths in `app/userData/` directory
   - Prevents escaping user-specific storage

## Testing Recommendations

### Windows-Specific Tests

```typescript
// Case-insensitive attacks
const root = "C:\\web-build";
isPathWithinRoot("c:\\web-build\\index.html", root); // ✓ true
isPathWithinRoot("C:\\WEB-BUILD\\index.html", root); // ✓ true
isPathWithinRoot("c:\\web-build\\..\\..\\windows\\system32", root); // ✓ false

// Mixed separators
isPathWithinRoot("C:\\web-build/styles/app.css", root); // ✓ true
isPathWithinRoot("C:\\web-build\\..\\secret.txt", root); // ✓ false
```

### Unix/Linux Tests

```typescript
// Case-sensitive validation
const root = "/opt/app/web-build";
isPathWithinRoot("/opt/app/web-build/index.html", root); // ✓ true
isPathWithinRoot("/opt/app/WEB-BUILD/index.html", root); // ✗ false (different case)
isPathWithinRoot("/opt/app/web-build/../../../etc/passwd", root); // ✓ false

// Relative path traversal
isPathWithinRoot("/opt/app/web-build/../../etc/passwd", root); // ✓ false
```

## Migration History

- **Original**: Simple `startsWith()` comparison (vulnerable on Windows)
- **Improved**: Added `path.relative()` check (robust cross-platform)
- **Current**: Removed redundant `startsWith()` after `path.relative()` check

The `path.relative()` approach is considered the Node.js standard for secure path validation.

## References

- Node.js `path` module documentation
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
