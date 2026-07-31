type FanMode = "normal" | "natural" | "night"

// The device state as exposed by latestData.fullData (v4) / data (v5) — see
// the API spec's "Discovery" section. mode/power are nullable because a
// freshly provisioned or offline fan reports them as null.
type FanState = {
  mode: FanMode | null
  power: boolean | null
  speed: number
  swing: boolean
  tilt: boolean
  timer: number
  sensor: string
}

// The wire shape before mapping: power/swing/tilt as 0|1, mode as a small
// int. Kept distinct from FanState so the int/bool conversion only happens
// in one place (toFanState below).
type RawFanData = {
  mode: number | null
  power: number | null
  speed: number
  swing: number
  tilt: number
  timer: number
  sensor: string
}

type SensorSummary = {
  id: number
  type: string
  displayName: string
}

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
  swing: raw.swing === 1,
  tilt: raw.tilt === 1,
  timer: raw.timer,
  sensor: raw.sensor,
})

export { toFanState, FAN_MODE_VALUES, FAN_MODE_BY_VALUE }
export type {
  FanMode,
  FanState,
  RawFanData,
  SensorSummary,
  FanSessionState,
  ApiVersion,
}
