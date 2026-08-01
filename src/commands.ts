import { FAN_MODE_VALUES, type FanMode } from "./types.js"

// "tune set <param> <value>" — the text grammar both the cloud REST API and
// the local MQTT command topic accept verbatim (see the API spec's
// "Commands" section). Centralised here so a transport never invents its
// own encoding of a command, and a consumer only ever has to know this one
// grammar regardless of which transport is in use.
type Command =
  | { param: "power"; value: boolean }
  | { param: "speed"; value: number }
  | { param: "mode"; value: FanMode }
  // horosc is a four-position sweep-angle preset, not a toggle — confirmed
  // against the Home Assistant integrations built on this same protocol,
  // which document "tune set horosc X (X: 0-3)" and "verosc X (X: 0-2)" —
  // corroborated by a real state payload reporting both as plain integers.
  // Neither is a toggle: horosc is off/30°/60°/90°, verosc off/45°/100°.
  | { param: "horosc"; value: number }
  | { param: "verosc"; value: number }
  | { param: "night"; value: boolean }
  | { param: "timer"; value: number }

const asBit = (value: boolean): 0 | 1 => (value ? 1 : 0)

const buildCommand = (command: Command): string => {
  switch (command.param) {
    case "power":
      return `tune set power ${asBit(command.value)}`
    case "speed":
      if (
        !Number.isInteger(command.value) ||
        command.value < 1 ||
        command.value > 30
      )
        throw new RangeError(
          `speed must be an integer between 1 and 30, got ${command.value}`,
        )
      return `tune set speed ${command.value}`
    case "mode":
      return `tune set mode ${FAN_MODE_VALUES[command.value]}`
    case "horosc":
      if (
        !Number.isInteger(command.value) ||
        command.value < 0 ||
        command.value > 3
      )
        throw new RangeError(
          `horizontal oscillation must be an integer between 0 (off) and 3, got ${command.value}`,
        )
      return `tune set horosc ${command.value}`
    case "verosc":
      if (
        !Number.isInteger(command.value) ||
        command.value < 0 ||
        command.value > 2
      )
        throw new RangeError(
          `vertical oscillation must be an integer between 0 (off) and 2, got ${command.value}`,
        )
      return `tune set verosc ${command.value}`
    case "night":
      return `tune set night ${asBit(command.value)}`
    case "timer":
      if (!Number.isInteger(command.value) || command.value < 0)
        throw new RangeError(
          `timer must be a non-negative integer number of hours, got ${command.value}`,
        )
      return `tune set timer ${command.value}`
  }
}

const powerCommand = (on: boolean): string =>
  buildCommand({ param: "power", value: on })
const speedCommand = (speed: number): string =>
  buildCommand({ param: "speed", value: speed })
const modeCommand = (mode: FanMode): string =>
  buildCommand({ param: "mode", value: mode })
// Accepts a boolean so existing callers keep working: true maps to preset 1,
// the narrowest sweep, which is what "on" used to mean.
const horizontalOscillationCommand = (level: number | boolean): string =>
  buildCommand({
    param: "horosc",
    value: typeof level === "boolean" ? (level ? 1 : 0) : level,
  })
// Accepts a boolean so existing callers keep working: true maps to preset 1.
const verticalOscillationCommand = (level: number | boolean): string =>
  buildCommand({
    param: "verosc",
    value: typeof level === "boolean" ? (level ? 1 : 0) : level,
  })
const nightModeCommand = (on: boolean): string =>
  buildCommand({ param: "night", value: on })
const timerCommand = (hours: number): string =>
  buildCommand({ param: "timer", value: hours })

export {
  buildCommand,
  powerCommand,
  speedCommand,
  modeCommand,
  horizontalOscillationCommand,
  verticalOscillationCommand,
  nightModeCommand,
  timerCommand,
}
export type { Command }
