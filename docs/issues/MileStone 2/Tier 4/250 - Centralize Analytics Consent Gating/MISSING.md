# MISSING.md - Issue #250: Centralize Analytics Consent Gating

## Overview

This document outlines features and improvements that are **intentionally not implemented** in the current consent gating system. These represent future enhancements that would provide more sophisticated privacy controls, better user experience, and additional compliance features.

## Missing Features

### 1. Crash Consent Dialog UI

**Current State:** Core crash opt-in logic is implemented via `useCrashConsentReport` hook. When consent is 'none' and an error occurs, the error is stored locally with an opt-in mechanism available. The hook provides `canOptIn` and `sendCrashReport` functions for programmatic crash reporting.

**Missing:** User-friendly modal dialog UI for the crash opt-in flow.

#### Required Implementation

**CrashConsentDialog Component**
```
┌─ App Error Occurred ──────────────────────┐
│                                           │
│ Something went wrong in the app.         │
│                                           │
│ Help us fix this by sending error details│
│ to our development team?                 │
│                                           │
│ Error details include:                    │
│ • Error message and stack trace          │
│ • App version and device info            │
│ • No personal information                │
│                                           │
│ [Send Error Report] [Don't Send]         │
│                                           │
│ [Privacy Policy]                          │
└───────────────────────────────────────────┘
```

**Implementation Requirements:**
- React Native compatible modal component
- Expo Router integration
- Stores user preference for future crashes
- Links to privacy policy section
- Accessible design (screen reader support)
- Non-blocking UI (doesn't interrupt user flow)

**Files to Create:**
- `components/ui/CrashConsentDialog.tsx` - Main dialog component
- `lib/error/crash-consent-manager.ts` - Dialog state management

**Files Already Created:**
- `hooks/analytics/use-crash-consent-report.ts` - Core opt-in logic hook

**Integration Points:**
- `lib/error/ErrorBoundary.tsx` - Trigger dialog when consent='none'
- `lib/api/request-manager.ts` - Optional dialog for API errors
- Settings screen - Allow users to change crash reporting preference

### 2. Granular Consent Categories

**Current State:** Three fixed categories (essential, performance, usage) with fixed mappings.

**Missing:** User-configurable consent categories and custom event mappings.

#### Advanced Consent Controls
```
Analytics Consent Settings
┌─────────────────────────────────────────┐
│ □ Error Reporting (Always Required)    │
│ □ Performance Metrics                  │
│ □ Usage Analytics                      │
│ □ Custom Categories                    │
│   └─ Screen Views                      │
│   └─ Feature Usage                     │
│   └─ User Interactions                 │
└─────────────────────────────────────────┘
```

**Implementation Requirements:**
- Dynamic category system
- User preference persistence
- Runtime event mapping updates
- Backward compatibility with existing mappings

**Technical Challenges:**
- Schema changes for user preferences
- Migration of existing consent levels
- Performance impact of dynamic mappings

### 3. Time-Based Consent

**Current State:** Persistent consent levels that survive app restarts.

**Missing:** Temporary consent controls (e.g., "Allow for 24 hours", "Block for session").

#### Time-Based Options
- **Session-based**: Consent resets on app restart
- **Time-limited**: "Allow tracking for next 24 hours"
- **Context-aware**: "Allow during this flow only"
- **Scheduled**: "Block tracking during work hours"

**Use Cases:**
- Privacy-conscious users wanting temporary analytics access
- Development/testing scenarios
- User research sessions
- Compliance with temporary data collection needs

### 4. Consent Audit Logging

**Current State:** Basic debug logging of dropped events.

**Missing:** Comprehensive audit trail of consent decisions and event handling.

#### Audit Features
- **Consent Changes**: When and why consent levels change
- **Event Decisions**: Which events were emitted/dropped and why
- **Policy Compliance**: Reports for GDPR/data protection officers
- **Debug Support**: Detailed logs for troubleshooting consent issues

**Implementation Requirements:**
- Structured logging system
- Privacy-safe audit storage
- Export functionality for compliance
- Performance monitoring of audit overhead

### 5. Advanced Event Filtering

**Current State:** Category-based filtering (essential/performance/usage).

**Missing:** Context-aware and conditional event filtering.

#### Advanced Filtering Rules
```typescript
// Conditional emission based on context
if (user.isPremium && event.category === 'usage') {
  emitEvent(event); // Premium users get more tracking
}

// Geographic restrictions
if (user.region === 'GDPR' && event.sensitive) {
  dropEvent(event);
}

// Sampling rates
if (Math.random() < 0.1) { // 10% sampling
  emitEvent(event);
}
```

**Use Cases:**
- Regional compliance (GDPR vs CCPA)
- User segment targeting
- Performance optimization through sampling
- A/B testing consent variations

### 6. Consent Impact Analysis

**Current State:** Events are filtered but no visibility into what data would be collected.

**Missing:** Tools to show users what analytics would be enabled at each consent level.

#### Consent Preview
```
What we track at Basic consent:
• App crashes and errors
• API response times
• Network connectivity issues
• App startup performance

What we DON'T track:
• Which screens you visit
• Which features you use
• How long you spend in the app
• Your interaction patterns
```

**Implementation Requirements:**
- Event catalog with descriptions
- Consent level simulators
- Privacy impact assessments
- User education content

### 7. Third-Party Integration Controls

**Current State:** All exporters receive all consented events.

**Missing:** Per-exporter consent controls and data sharing preferences.

#### Granular Data Sharing
```
Data Sharing Preferences
┌─────────────────────────────────────────┐
│ Send to:                               │
│ □ Development Team (Crash Reports)     │
│ □ Analytics Service (Usage Data)       │
│ □ Customer Support (Error Context)     │
│ □ Marketing Team (Aggregated Insights) │
└─────────────────────────────────────────┘
```

**Use Cases:**
- Users uncomfortable with marketing analytics
- Compliance with data minimization principles
- Selective sharing for different purposes
- Vendor-specific privacy controls

### 8. Consent Migration Tools

**Current State:** Consent levels are set and persist.

**Missing:** Tools for migrating users between consent systems or updating consent models.

#### Migration Scenarios
- **App Updates**: New consent categories introduced
- **Regulation Changes**: GDPR vs CCPA vs other frameworks
- **User Import**: Migrating consent from other systems
- **Consent Model Updates**: Changing from binary to granular consent

**Implementation Requirements:**
- Backward compatibility layers
- User communication strategies
- Consent preference migration scripts
- Rollback capabilities

## Implementation Priority

### High Priority (Near-term)
1. **Crash Consent Dialog UI** - Core logic implemented, needs user-friendly modal interface
2. **Granular Categories** - Better user control
3. **Consent Audit Logging** - Compliance and debugging

### Medium Priority (Mid-term)
4. **Time-Based Consent** - Advanced privacy controls
5. **Consent Impact Analysis** - User education
6. **Advanced Event Filtering** - Compliance flexibility

### Low Priority (Long-term)
7. **Third-Party Integration Controls** - Advanced sharing preferences
8. **Consent Migration Tools** - System evolution support

## Dependencies

### For Crash Consent Dialog
- **UI Component Library**: Modal and dialog components
- **Error Boundary System**: Integration points for error detection
- **Settings System**: User preference storage

### For Granular Categories
- **Database Schema**: User preference storage expansion
- **Settings UI**: Dynamic preference controls
- **Event Mapping System**: Runtime configuration support

### For Audit Logging
- **Logging Infrastructure**: Structured audit logging
- **Storage System**: Privacy-safe audit storage
- **Export System**: Compliance report generation

## Risk Assessment

### Privacy Risks
- **Over-collection**: Missing features might lead to inadequate privacy controls
- **User Confusion**: Lack of granular controls may frustrate privacy-conscious users
- **Compliance Gaps**: Missing audit trails could complicate regulatory compliance

### Technical Risks
- **Performance**: Advanced filtering could impact event processing speed
- **Complexity**: Granular controls increase system complexity
- **Maintenance**: More features mean more maintenance burden

### Business Risks
- **User Trust**: Inadequate privacy controls could damage user trust
- **Regulatory**: Missing compliance features could lead to legal issues
- **Competitive**: Limited privacy controls vs competitors with advanced features

## Success Metrics

### Privacy Compliance
- [x] Crash opt-in mechanism implemented (`useCrashConsentReport` hook)
- [ ] All required consent categories implemented
- [ ] Audit logging meets compliance requirements
- [ ] User control meets privacy regulation standards

### User Experience
- [ ] Consent dialog conversion rates > 50%
- [ ] User understanding of consent levels > 80%
- [ ] Privacy control satisfaction scores > 4/5

### Technical Performance
- [ ] Event processing overhead < 5ms
- [ ] Consent check failure rate < 0.1%
- [ ] Audit logging performance impact < 10%