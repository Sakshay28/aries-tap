// Shared constants for the WiFi/OTP feature.

export const VERIFY_COOKIE = "wifi_verified";
export const ADMIN_COOKIE = "aries_admin";

// How long a verification is good for — long enough to read the password and
// join, short enough that the cookie isn't a lasting credential.
export const VERIFY_TTL_SECONDS = 60 * 15;
export const ADMIN_TTL_SECONDS = 60 * 60 * 8;

export const CONSENT_VERSION = process.env.CONSENT_VERSION || "2026-08-05";
