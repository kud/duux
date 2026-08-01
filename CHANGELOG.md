# Changelog

All notable changes to this project are documented here.

---

## 0.4.0 — 2026-08-01

### Breaking Changes

- Cloud control now works. Reading state and sending commands previously failed with `Not_Allowed`, which read as a permissions problem and was in fact three wrong endpoints: commands are addressed by the device's MAC address, not its numeric sensor id; there is no `/data/{id}/status` endpoint for state; and state instead rides along on the device list at `/smarthome/sensors` as `latestData.fullData`. Discovery moved to that same endpoint, so one call now returns devices and their state together. Verified against a real Duux Whisper Flex 2. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))
- `Transport` methods take the MAC as a string, not a numeric id. `Device` gained an optional `mac` field; devices saved before it existed throw a clear "run discovery again" error rather than a misleading permissions failure. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))
- `FanState` now uses the fan's own field names — `horosc`, `verosc`, `night` — instead of the invented `swing`/`tilt` aliases, and everything is nullable because the fan reports null for anything it lacks. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))
- Night mode is readable after all. The library documented it as write-only; the state payload carries `night`, so `FanState.night` now reports it. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))
- Vertical oscillation is a 0–2 preset (off / 45° / 100°), not a boolean, matching horizontal's 0–3. `verticalOscillationCommand` validates the range and still accepts a boolean for compatibility, mapping `true` to preset 1. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))

### Fixes

- MQTT `getStatus` no longer hangs forever. It waits for the fan to publish, so pointed at a broker the fan has never connected to it blocked indefinitely with no output at all. It now fails after a deadline (10s default, configurable via `statusTimeoutMs`) naming the topic it was waiting on. ([0a7f1ac](https://github.com/kud/duux/commit/0a7f1acf3df76efe934f96b5d23a889ada2f2b0b))

---

## 0.3.0 — 2026-07-31

### Breaking Changes

- Horizontal oscillation is now a 0–3 sweep-angle preset, not an on/off toggle. It was modelled as a boolean, which silently discarded presets 2 and 3 — `tune set horosc` accepts 0 (off) through 3, confirmed against the Home Assistant integrations built on the same MQTT protocol. `horizontalOscillationCommand` now takes a number and throws a `RangeError` outside 0–3; it still accepts a boolean for compatibility, mapping `true` to preset 1. `setOscillation`'s value parameter widened to `number | boolean` on both the one-shot client and the session. ([27614f3](https://github.com/kud/duux/commit/27614f34d84ff8879afc62b5b5d1dd3229049d16))
- `FanState.swing` is now a number rather than a boolean. The fan reports the sweep preset, and flattening it with `=== 1` destroyed any value above 1. Note honestly: only the _command_ range is confirmed — that the fan reports the same 0–3 range back is inferred and still awaits a real state payload to verify. ([27614f3](https://github.com/kud/duux/commit/27614f34d84ff8879afc62b5b5d1dd3229049d16))
- Vertical oscillation (`verosc`) is deliberately unchanged and remains a boolean — no equivalent confirmation exists for it yet. ([27614f3](https://github.com/kud/duux/commit/27614f34d84ff8879afc62b5b5d1dd3229049d16))

---

## 0.2.0 — 2026-07-31

### Breaking Changes

- `discover()` now returns `{ devices }` — the `tenantId` field is gone, along with `resolveTenantId` and the `TenantSummary` type. Tenant memberships still exist (v5 `/users/current` exposes them as `permissions`), but nothing in the library needs one any more. ([638e8be](https://github.com/kud/duux/commit/638e8be0a24ee14915546fef8e7b55338078e6da))
- `SensorSummary` gained a `name` field and `displayName` is now `string | null` — a fan has no `displayName` until its owner renames it in the Duux app. A new exported helper, `sensorLabel(sensor)`, falls back to the factory name when `displayName` is null. ([638e8be](https://github.com/kud/duux/commit/638e8be0a24ee14915546fef8e7b55338078e6da))

### Highlights

- Device discovery moved from Cloudgarden's v4 API to v5. In practice v4 no longer works for this purpose: `/users/current` doesn't return a `tenants` array at all, `/tenants` reports a count but lists nothing, and `/tenants/{id}/sensors` answers 403 for every tenant an account holds. Discovery now calls v5 `/sensor` instead, verified against a real Duux Whisper Flex 2. The cloud transport defaults to v5 as a result (v4 remains selectable via `apiVersion`). ([638e8be](https://github.com/kud/duux/commit/638e8be0a24ee14915546fef8e7b55338078e6da))
- Refusals are no longer silent. v5 answers a rejected request with HTTP 200 and the reason in an `errorMessage` field, so an `ok` check alone was turning a rejection like "Not_Allowed" into null data with no explanation. A new `unwrap()` handles both the wrapped and bare payload shapes and throws when `errorMessage` is populated. ([638e8be](https://github.com/kud/duux/commit/638e8be0a24ee14915546fef8e7b55338078e6da))
- MQTT can now complete a TLS handshake. Cloudgarden's broker uses a self-signed certificate whose SAN list omits its own hostname, so verification could never succeed and the transport failed for everyone. The certificate is now pinned, with the hostname check bypassed only for Cloudgarden's own host. Note honestly: the broker then refuses the login with "Bad username or password" — the credentials the Duux app uses aren't obtainable from the REST API, so cloud control remains unavailable pending capture of those credentials. ([638e8be](https://github.com/kud/duux/commit/638e8be0a24ee14915546fef8e7b55338078e6da))

<details>
<summary>Internal (1 commit)</summary>

- Initial project scaffold. ([5eff04f](https://github.com/kud/duux/commit/5eff04f4cc4ec1d15da2335e4e7c317aea50719d))

</details>

---
