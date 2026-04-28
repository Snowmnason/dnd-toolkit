/**
 * Modal Registration Initializer
 *
 * This file imports all modal components to trigger their registerModal() side effects.
 * Each modal file calls registerModal(...) at the bottom, which populates the modal registry.
 *
 * This file is imported by OverlayProvider at startup to ensure all modals are registered
 * before any openModal() calls are made.
 *
 * Without this, the modal registry would remain empty and modals would fail to render.
 */

// Auth modals
import '@/components/modals/auth/ConfirmDeleteAccountModal'
import '@/components/modals/auth/ConfirmSignOutModal'
import '@/components/modals/auth/UpdatePasswordModal'
import '@/components/modals/auth/UpdateUsernameModal'

// World modals
import '@/components/modals/worlds/ConfrirmLeaveModal'
import '@/components/modals/worlds/CreateWorldModals'
import '@/components/modals/worlds/CreateWorldSignInModal'
import '@/components/modals/worlds/CreateWorldSuccessModal'
import '@/components/modals/worlds/CreateWorldValidationModal'
import '@/components/modals/worlds/EditWorldModal'

// Other modals
import '@/components/modals/EntitlementExpiredModal'
import '@/components/modals/FeatureGatedModal'
import '@/components/modals/LoginModal'
import '@/components/modals/SettingsModal'
import '@/components/modals/SuccessModal'

// Navigation modals
import '@/components/modals/NavModal'
import '@/components/modals/TrustedUrlConsentModal'

