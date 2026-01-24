# Content Security Policy (CSP) Configuration

## Overview
The application uses a strict Content Security Policy to protect against XSS and other injection attacks.

## Current Configuration
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://dnd-tool.thesnowpost.com https://*.supabase.co; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';
```

## Security Decisions

### Removed 'unsafe-inline' and 'unsafe-eval'
- **Risk**: Allows execution of any injected inline scripts or eval'd code
- **Impact**: Significantly weakens XSS protection
- **Alternative**: Use nonces, hashes, or external script files

### Allowed Domains
- `'self'`: Local scripts and resources
- `https://dnd-tool.thesnowpost.com`: App domain
- `https://*.supabase.co`: Supabase services
- `https://fonts.googleapis.com`: Google Fonts
- `https://fonts.gstatic.com`: Google Fonts assets

## Testing
If the app breaks with this strict CSP:
1. Check browser console for CSP violation errors
2. Identify which inline scripts are blocked
3. Consider adding specific nonces or hashes for required scripts
4. Avoid re-adding 'unsafe-inline' or 'unsafe-eval'

## Future Improvements
- Implement CSP nonces for dynamic content
- Use Subresource Integrity (SRI) for external scripts
- Consider CSP violation reporting endpoint