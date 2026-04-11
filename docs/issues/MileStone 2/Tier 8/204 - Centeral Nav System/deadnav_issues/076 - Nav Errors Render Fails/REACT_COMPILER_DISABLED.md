# React Compiler Experiment Disabled

**Date**: January 9, 2026  
**Issue**: #76 - Navigation Errors and Render Fails  
**Decision**: Disabled `experiments.reactCompiler` in app.json

## Problem

After re-enabling the React Compiler experiment (`reactCompiler: true` in app.json), we encountered numerous runtime errors:

```
Expected a constant size argument for each invocation of useMemoCache. 
The previous cache was allocated with size 9 but size 6 was requested.
```

These errors appeared repeatedly during:
- Screen transitions
- Component re-renders
- Navigation events
- Login flow

## Root Cause

The React Compiler (experimental) uses `useMemoCache` internally to optimize component renders. When cache size requirements change between renders (due to conditional hooks or dynamic component structure), it throws errors.

This is a known issue with the experimental compiler when:
1. Components have conditional rendering that affects hook counts
2. Hook order changes between renders
3. Dynamic imports or lazy-loaded components alter hook structure

## Impact

The errors were:
- **Non-blocking** but flooded the console
- Made debugging navigation issues impossible
- Potentially caused performance degradation
- Violated React's Rules of Hooks indirectly

## Decision

Set `experiments.reactCompiler: false` in app.json to:
1. Eliminate cache size errors
2. Clean up console output for debugging
3. Ensure stable hook ordering
4. Maintain compatibility with current component structure

## Trade-offs

**Lost**: Automatic React 19+ compiler optimizations (memoization, reduced re-renders)  
**Gained**: Stable runtime, clean console, debuggable navigation flow

## Future Considerations

Re-enable once:
1. React Compiler exits experimental phase
2. Expo Router fully supports it
3. Our component structure is audited for hook consistency
4. Comprehensive testing can validate no regressions

## Related Files

- `app.json` - experiments.reactCompiler = false
- Issue #76 - Navigation system migration

## Reference

- [React Compiler Documentation](https://react.dev/learn/react-compiler)
- [Rules of Hooks](https://react.dev/link/rules-of-hooks)
- Expo Router compatibility: https://docs.expo.dev/router/introduction/
