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
  | { param: "horosc"; value: boolean }
  | { param: "verosc"; value: boolean }
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
      return `tune set horosc ${asBit(command.value)}`
    case "verosc":
      return `tune set verosc ${asBit(command.value)}`
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
const horizontalOscillationCommand = (on: boolean): string =>
  buildCommand({ param: "horosc", value: on })
const verticalOscillationCommand = (on: boolean): string =>
  buildCommand({ param: "verosc", value: on })
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
