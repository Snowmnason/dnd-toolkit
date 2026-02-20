# MISSING.md - Issue #181: Persist Analytics Consent Level Across App Restarts

## Overview

This document outlines features and improvements that are **intentionally not implemented** in the current MVP. These represent future enhancements that would expand the consent system's capabilities, improve user experience, and provide more granular privacy controls.

## Missing Features

### 1. Granular Consent Levels UI

**Current State:** Simple toggle switch between 'basic' and 'full' in settings.

**Missing:** Support for all three consent levels ('none', 'basic', 'full') with clear explanations.

#### Required UI Components

**Consent Level Selector Modal**
```
┌─ Analytics Consent ──────────────────────────┐
│                                             │
│ Choose your privacy level:                  │
│                                             │
│ □ None - No tracking                        │
│   Essential app functions only              │
│                                             │
│ ◇ Basic - Minimal tracking (Recommended)    │
│   Errors and app performance only           │
│                                             │
│ □ Full - Complete tracking                  │
│   Usage analytics and detailed metrics      │
│                                             │
│ [Save Settings] [Cancel]                    │
└─────────────────────────────────────────────┘
```

**Implementation Requirements:**
- Replace simple toggle with radio button group or segmented control
- Add modal/dialog explaining each level's implications
- Include "Learn More" links to detailed privacy policy sections
- Support keyboard navigation and screen reader accessibility

**Files to Create/Modify:**
- `components/ui/ConsentLevelSelector.tsx` - New component
- `components/ui/ConsentExplanationModal.tsx` - New modal
- `Screens/settings/AppSettings.tsx` - Replace toggle with selector
- `hooks/use-analytics-consent.ts` - Add modal state management

### 2. Consent Level Explanations

**Current State:** Basic subtitle text under toggle.

**Missing:** Comprehensive explanations of what each consent level tracks.

#### Detailed Consent Explanations

**None Level:**
- ❌ No analytics events sent
- ❌ No performance monitoring
- ❌ No error reporting (except critical app crashes)
- ✅ App functions normally
- ✅ No data stored for analytics

**Basic Level (Current Default):**
- ✅ Essential error reporting (app crashes, critical failures)
- ✅ Basic app performance (load times, startup metrics)
- ✅ Session tracking (app open/close, duration)
- ❌ User interaction tracking
- ❌ Feature usage analytics
- ❌ Personalization data

**Full Level:**
- ✅ All Basic level tracking
- ✅ User interaction analytics (button clicks, navigation)
- ✅ Feature usage patterns
- ✅ A/B test participation
- ✅ Advanced performance metrics
- ✅ Personalization insights

**Implementation Requirements:**
- Create expandable sections showing exactly what data is collected
- Include data retention policies for each level
- Link to full privacy policy
- Support multiple languages/localization

### 3. Consent Change Audit Trail

**Current State:** Consent changes logged to console only.

**Missing:** User-visible history of consent changes.

#### Audit Trail Features

**Settings Page Addition:**
```
Recent Consent Changes
───────────────────────
Feb 19, 2026 14:30 - Changed to "Full" tracking
Feb 15, 2026 09:15 - Changed to "Basic" tracking
Jan 30, 2026 16:45 - Initial setup: "Basic" tracking

[View Full History]
```

**Full History Modal:**
- Chronological list of all consent changes
- Date/time stamps
- Previous and new consent levels
- Platform/device information (if cross-device)
- Export capability for GDPR requests

**Implementation Requirements:**
- Database table: `consent_audit_log` with columns:
  - `id`, `user_id`, `timestamp`, `old_level`, `new_level`, `platform`, `ip_address`
- API endpoints for fetching audit history
- UI components for displaying timeline
- Data export functionality (JSON/CSV)

### 4. Advanced Consent Options

**Current State:** Single global consent level.

**Missing:** Category-specific consent controls.

#### Granular Consent Categories

**Proposed Categories:**
- **Essential** (always required, cannot be disabled)
  - App crashes and critical errors
  - Basic app functionality metrics

- **Performance** (default: enabled)
  - Screen load times
  - API response times
  - Memory usage patterns

- **Usage Analytics** (default: opt-in)
  - Feature usage patterns
  - User journey analytics
  - A/B test participation

- **Personalization** (default: opt-in)
  - UI customization preferences
  - Adaptive features
  - Personalized recommendations

**Implementation Requirements:**
- Extend consent system to support category flags
- Update `ConsentLevel` type to support granular options
- Modify `isAllowed()` method to check categories
- Database schema changes for granular storage
- Migration strategy from global to granular consent

### 5. Consent Expiration and Renewal

**Current State:** Consent persists indefinitely.

**Missing:** Periodic consent renewal requirements.

#### Expiration Features

**Automatic Renewal Prompts:**
- Every 12 months, show renewal modal
- Explain what data has been collected
- Allow users to review and update consent
- GDPR compliance for periodic consent validation

**Implementation Requirements:**
- Add `consent_expires_at` timestamp to user settings
- Background job to identify expiring consents
- Renewal UI flow with clear explanations
- Automatic downgrade to 'basic' on expiration

### 6. Cross-Device Consent Sync Conflict Resolution

**Current State:** Last-write-wins for database sync.

**Missing:** Intelligent conflict resolution for simultaneous changes.

#### Conflict Resolution Scenarios

**Scenario 1: Different Devices, Same User**
- Device A: Changes to 'full' at 10:00
- Device B: Changes to 'none' at 10:05 (offline)
- Device B comes online at 10:10
- **Resolution:** Show conflict modal on Device B, let user choose

**Scenario 2: Privacy-First Resolution**
- When conflicts detected, default to most restrictive level
- Notify user of conflict and allow override

**Implementation Requirements:**
- Conflict detection in sync queue
- User notification system for conflicts
- Resolution UI with clear explanations
- Audit logging of conflict resolutions

### 7. Consent-Based Data Deletion

**Current State:** Buffer clears on consent downgrade.

**Missing:** Complete data deletion workflows.

#### Data Deletion Features

**On Consent Withdrawal:**
- Delete all stored analytics data for user
- Clear local storage and database records
- Reset to 'none' level
- Provide confirmation of deletion

**GDPR "Right to Erasure" Support:**
- API endpoint for complete data deletion
- Audit trail of deletion requests
- Confirmation emails/notifications

**Implementation Requirements:**
- Data deletion job that removes all user analytics data
- Confirmation UI with clear warnings
- Integration with existing data export features

### 8. Enhanced Privacy Dashboard

**Current State:** Basic settings toggle.

**Missing:** Comprehensive privacy control center.

#### Privacy Dashboard Features

**Data Inventory:**
- Show what data is currently stored
- Breakdown by consent category
- Data retention periods
- Storage locations (local vs server)

**Control Panel:**
- Granular consent toggles
- Data export options
- Deletion request forms
- Audit history access

**Implementation Requirements:**
- New screen: `Screens/settings/PrivacyDashboard.tsx`
- API endpoints for data inventory
- Export functionality for user data
- Integration with consent management

## Implementation Priority

### Phase 1 (Next Sprint) - Essential UI Improvements
1. ✅ Add 'none' option to existing toggle
2. ✅ Basic explanations for each level
3. Consent level selector component

### Phase 2 (Future Release) - Advanced Features
1. Granular consent categories
2. Audit trail UI
3. Privacy dashboard
4. Consent expiration handling

### Phase 3 (Long-term) - Enterprise Features
1. Cross-device conflict resolution
2. Advanced data deletion workflows
3. Third-party data sharing controls

## Technical Considerations

### Database Schema Evolution
```sql
-- Future schema for granular consent
ALTER TABLE public.user_settings
ADD COLUMN consent_categories jsonb DEFAULT '{
  "essential": true,
  "performance": true,
  "usage": false,
  "personalization": false
}';

-- Audit trail table
CREATE TABLE consent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  timestamp timestamptz DEFAULT now(),
  old_level text,
  new_level text,
  categories_changed jsonb,
  platform text,
  ip_address inet,
  user_agent text
);
```

### API Extensions
```typescript
// Future hook API
const {
  level,
  categories,
  setLevel,
  setCategory,
  getAuditHistory,
  requestDataDeletion
} = useAnalyticsConsent();

// Future manager API
await AnalyticsConsent.setGranularConsent({
  essential: true,
  performance: true,
  usage: false,
  personalization: false
});
```

### Migration Strategy
- Global consent levels migrate to granular with backwards compatibility
- Existing 'basic' → essential + performance enabled
- Existing 'full' → all categories enabled
- Clear migration documentation for users

## Success Metrics

### User Experience
- **Consent Understanding:** >90% of users can explain what each level tracks
- **Satisfaction:** >80% user satisfaction with privacy controls
- **Adoption:** >70% of users engage with advanced privacy settings

### Technical Metrics
- **Data Accuracy:** 100% of consent changes properly enforced
- **Performance:** <50ms impact on app startup from consent initialization
- **Reliability:** <0.1% consent sync failures

## Dependencies

### Internal Dependencies
- Enhanced UI component library
- Advanced modal system
- Audit logging infrastructure
- Data export capabilities

### External Dependencies
- Privacy regulation compliance (GDPR, CCPA)
- Localization for consent explanations
- Accessibility standards compliance

## Risk Assessment

### Privacy Risks
- **Over-collection:** Granular controls might encourage excessive data collection
- **Mitigation:** Strict default opt-in for non-essential categories

### UX Risks
- **Complexity:** Too many options confuse users
- **Mitigation:** Progressive disclosure, clear defaults, helpful explanations

### Technical Risks
- **Performance:** Complex consent checks slow down analytics
- **Mitigation:** Efficient caching, background processing

## Conclusion

These missing features represent the natural evolution of the consent system from MVP to a comprehensive privacy management platform. The current implementation provides a solid foundation that can be extended incrementally based on user feedback and regulatory requirements.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 4\181 - Persist Consent\MISSING.md