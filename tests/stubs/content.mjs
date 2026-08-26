// Test-only stub for @/lib/content.
//
// The real content module imports binary image assets and next/image, none of
// which load in the raw Node test runner. The QR/tag store (src/lib/qr/config)
// only needs `business.id` from it, so this minimal stand-in satisfies that one
// import and nothing else — letting the REAL tag-owner lookup (getQrByCodeGlobal
// / resolveTagOwner) load and run without pulling the venue's content/images
// into the test process. Production is unaffected: this file is reachable only
// through the test-only resolver hook (tests/ts-hooks.mjs).
export const business = { id: "stub-deployment" };
