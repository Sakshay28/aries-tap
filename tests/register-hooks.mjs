// Registers the test-only resolver hook (tests/ts-hooks.mjs) before any test
// module loads. Wired into `npm test` via `node --import ./tests/register-hooks.mjs`.
// The test runner forwards this process's execArgv to the per-file worker
// processes, so the hook is active wherever a test imports the real event core.
import { register } from "node:module";
register("./ts-hooks.mjs", import.meta.url);
