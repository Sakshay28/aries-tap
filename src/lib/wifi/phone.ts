// Phone normalization for Indian mobiles. Everything downstream (rate-limit
// keys, OTP store, lead records) uses the E.164 form so one person can't be
// counted as two by formatting differences.

const IN_MOBILE = /^[6-9]\d{9}$/;

// Returns "+91XXXXXXXXXX" or null if it isn't a plausible Indian mobile.
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // Strip a country code or trunk prefix, however the guest typed it.
  let local = digits;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
  if (!IN_MOBILE.test(local)) return null;
  return `+91${local}`;
}

// For display / logs — "+91 98200 00000". Never used as a key.
export function prettyPhone(e164: string): string {
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
