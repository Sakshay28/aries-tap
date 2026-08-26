// Test-only ESM resolver hook.
//
// The event core uses extensionless relative imports (`import … from "./config"`)
// and the `@/…` path alias — both idiomatic for the Next/bundler build, but
// Node's native ESM loader (which is what `node --experimental-strip-types
// --test` uses, with no bundler) refuses to resolve either. That's the sole
// reason the acceptance suite couldn't load the real store, and why the real
// tag-owner lookup couldn't load at all.
//
// This hook closes both gaps without touching a line of production code:
//   • extensionless relative specifiers retry with a `.ts` extension, and
//   • `@/…` maps to `<repo>/src/…`, teaching the raw runner the same alias the
//     bundler already applies,
// except `@/lib/content`, which is redirected to a tiny test stub so the venue's
// content/image assets never have to load. Nothing here changes how the code
// runs in production. Registered via tests/register-hooks.mjs.

const SRC_BASE = new URL("../src/", import.meta.url);
const CONTENT_STUB = new URL("./stubs/content.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  // The venue content module → minimal stub (avoids binary image imports).
  if (specifier === "@/lib/content" || specifier === "@/lib/content.ts") {
    return { url: CONTENT_STUB, shortCircuit: true };
  }
  // `@/x` → `<repo>/src/x` (with the .ts retry below handling the extension).
  if (specifier.startsWith("@/")) {
    const mapped = new URL(specifier.slice(2), SRC_BASE).href;
    return resolveWithTsFallback(mapped, context, nextResolve);
  }
  return resolveWithTsFallback(specifier, context, nextResolve);
}

async function resolveWithTsFallback(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relativeOrUrl =
      specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("file:");
    const hasExt = /\.[cm]?[jt]sx?$/.test(specifier);
    if (err?.code === "ERR_MODULE_NOT_FOUND" && relativeOrUrl && !hasExt) {
      return await nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
