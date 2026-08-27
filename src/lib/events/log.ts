// Structured, greppable server logs for the event pipeline (spec §26).
//
// One line of JSON per lifecycle moment, so production can answer the questions
// the spec asks — which tag, which tenant, was it persisted, was it published,
// was it deduped, did a stream reconnect and how much did it replay — by
// filtering on `area:"events"` and a `stage`. Deliberately minimal: no raw IPs,
// no free-text guest input, no rating values — only opaque ids and small enums.
// `session` is already an anonymous per-visit token, but we keep it out of logs
// too and record only the coarse facts an operator needs.

export type EventStage =
  | "ingest_ok" // an event was persisted (created=true) or deduped (created=false)
  | "ingest_rejected" // attribution/validation refused the event
  | "ingest_error" // an unexpected throw in the write path
  | "stream_open" // a dashboard opened an SSE stream
  | "stream_resync" // the gap replay ran on (re)connect
  | "stream_close" // the stream was torn down
  | "realtime_publish_error" // the managed broker (Ably) failed to publish/subscribe
  | "authn_failure" // a request presented no/invalid session where one was required
  | "authz_failure"; // a valid session was refused access to a resource

type Fields = Record<string, string | number | boolean | null | undefined>;

// Emitted as a single JSON object. Undefined fields are dropped so lines stay
// tight. Uses console.* (captured by every host's log drain) rather than a
// dependency; swap the sink here if a structured logger is ever adopted.
export function logEvent(stage: EventStage, fields: Fields = {}): void {
  const line: Record<string, unknown> = {
    area: "events",
    stage,
    ts: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) line[k] = v;
  }
  const isError = stage === "ingest_error" || stage === "realtime_publish_error";
  const sink = isError ? console.error : console.log;
  sink(JSON.stringify(line));
}
