/**
 * Phase-specific messages for kernel bootstrap.
 *
 * Simple string arrays (one per phase, 5 messages each).
 * Messages are D&D themed for app personality.
 *
 * Purpose: Centralized source for bootstrap messages.
 * Future: Can be extended with keys/localization in Issue #47.
 */

export const PHASE_MESSAGES = {
  config: [
    "Preparing the campaign...",
    "Shuffling the deck...",
    "Consulting the spell book...",
    "Marking the map...",
    "Rolling for initiative...",
  ],
  preload: [
    "Loading character sheets...",
    "Gathering miniatures...",
    "Inscribing runes...",
    "Infusing with magic...",
    "Binding artifacts...",
  ],
  network: [
    "Connecting to the scrying crystal...",
    "Opening the arcane portal...",
    "Sending messenger ravens...",
    "Establishing the ritual circle...",
    "Tuning the sending stone...",
  ],
  storage: [
    "Organizing the bag of holding...",
    "Cataloging the treasury...",
    "Arranging the library...",
    "Tallying the loot...",
    "Restocking the provisions...",
  ],
  services: [
    "Awakening the spirits...",
    "Summoning the servants...",
    "Preparing the shrine...",
    "Lighting the eternal flame...",
    "Invoking the ancient ones...",
  ],
  jobSetup: [
    "Setting tasks for the day...",
    "Setting up the quest board...",
    "Assigning the quest log...",
    "Organizing the workbench...",
    "Scheduling the routines...",
  ],
  auth: [
    "Verifying your bloodline...",
    "Consulting the oracle...",
    "Checking the sacred tome...",
    "Validating the sigil...",
    "Confirming your identity with the council...",
  ],
  sync: [
    "Synchronizing the tapestry...",
    "Aligning the constellations...",
    "Harmonizing the threads...",
    "Settling into the realm...",
    "The adventure awaits...",
  ],
} as const;

/**
 * Get random message for a phase.
 *
 * @param phaseName - Phase key (e.g., 'config', 'network', 'auth')
 * @returns Random message string from that phase
 */
export function getPhaseMessage(
  phaseName: keyof typeof PHASE_MESSAGES,
): string {
  let messages: readonly string[];

  switch (phaseName) {
    case "config":
      messages = PHASE_MESSAGES.config;
      break;
    case "preload":
      messages = PHASE_MESSAGES.preload;
      break;
    case "network":
      messages = PHASE_MESSAGES.network;
      break;
    case "storage":
      messages = PHASE_MESSAGES.storage;
      break;
    case "services":
      messages = PHASE_MESSAGES.services;
      break;
    case "jobSetup":
      messages = PHASE_MESSAGES.jobSetup;
      break;
    case "auth":
      messages = PHASE_MESSAGES.auth;
      break;
    case "sync":
      messages = PHASE_MESSAGES.sync;
      break;
  }

  const randomIndex = Math.floor(Math.random() * messages.length);
  // Use .at() for safe bounded array access
  const message = messages.at(randomIndex);
  return message ?? "Loading...";
}
