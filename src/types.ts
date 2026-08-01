type FanMode = "normal" | "natural" | "night"

// The device state, from latestData.fullData on /smarthome/sensors. The field
// names are the command names verbatim — horosc, verosc, night — not the
// swing/tilt aliases this library used to invent for them. Everything is
// nullable because the fan reports null for anything it doesn't have.
type FanState = {
  mode: FanMode | null
  power: boolean | null
  speed: number | null
  // Sweep-angle presets, confirmed against both the command grammar and a real
  // state payload: horosc is 0 (off) / 1 (30°) / 2 (60°) / 3 (90°), and verosc
  // is 0 (off) / 1 (45°) / 2 (100°). Neither is a boolean.
  horosc: number | null
  verosc: number | null
  night: boolean | null
  timer: number | null
  sensor: string
}

// The wire shape before mapping: power/night as 0|1, mode as a small int, the
// oscillation fields already the preset number. Kept distinct from FanState so
// the conversion happens in one place (toFanState below).
type RawFanData = {
  mode: number | null
  power: number | null
  speed: number | null
  horosc: number | null
  verosc: number | null
  night: number | null
  timer: number | null
  sensor: string
}

// displayName is null until the owner renames the fan in the Duux app, so it
// can never be the only label — `name` (the factory identifier, e.g.
// "DUUX.1.356505") is always present. Use sensorLabel rather than reading
// displayName directly.
type SensorSummary = {
  id: number
  type: string
  name: string
  displayName: string | null
  // The MAC address. Commands are addressed by this, not by `id` — the numeric
  // id only identifies the record, and posting to it is refused.
  deviceId: string
  latestData?: { fullData: RawFanData } | null
}

const sensorLabel = (sensor: SensorSummary): string =>
  sensor.displayName?.trim() || sensor.name

type FanSessionState = {
  deviceId: number | null
  connected: boolean
  fan: FanState | null
  error: string | null
}

type ApiVersion = "v4" | "v5"

// Enumerated empirically from the Go reference client's UI labels (normal /
// natural / night) — the API itself only ever returns/accepts the bare int.
// See the API spec's open questions: this is the full enumeration found so
// far, not a value confirmed exhaustive against real firmware.
const FAN_MODE_VALUES: Record<FanMode, number> = {
  normal: 0,
  natural: 1,
  night: 2,
}

const FAN_MODE_BY_VALUE: Record<number, FanMode> = {
  0: "normal",
  1: "natural",
  2: "night",
}

const toFanState = (raw: RawFanData): FanState => ({
  mode: raw.mode != null ? (FAN_MODE_BY_VALUE[raw.mode] ?? null) : null,
  power: raw.power != null ? raw.power === 1 : null,
  speed: raw.speed,
  horosc: raw.horosc,
  verosc: raw.verosc,
  night: raw.night != null ? raw.night === 1 : null,
  timer: raw.timer,
  sensor: raw.sensor,
})

export { toFanState, sensorLabel, FAN_MODE_VALUES, FAN_MODE_BY_VALUE }
export type {
  FanMode,
  FanState,
  RawFanData,
  SensorSummary,
  FanSessionState,
  ApiVersion,
}
