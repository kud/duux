import { createCloudTransport } from "./transport/cloud.js"
import type { Transport } from "./transport/index.js"
import {
  getAccessToken,
  requireCurrentDevice,
  requireTenantId,
} from "./context.js"
import {
  powerCommand,
  speedCommand,
  modeCommand,
  horizontalOscillationCommand,
  verticalOscillationCommand,
  nightModeCommand,
  timerCommand,
} from "./commands.js"
import type { FanMode, FanState } from "./types.js"

const defaultTransport = (): Transport =>
  createCloudTransport({ getAccessToken, tenantId: requireTenantId() })

const resolveTransport = (transport?: Transport): Transport =>
  transport ?? defaultTransport()

// One-shot: resolve the current device, act, done. For a long-lived
// connection that reacts to state changes, use session.ts instead.
const sendCommand = (command: string, transport?: Transport): Promise<void> => {
  const device = requireCurrentDevice()
  return resolveTransport(transport).sendCommand(device.id, command)
}

const setPower = (on: boolean, transport?: Transport): Promise<void> =>
  sendCommand(powerCommand(on), transport)

const setSpeed = (speed: number, transport?: Transport): Promise<void> =>
  sendCommand(speedCommand(speed), transport)

const setMode = (mode: FanMode, transport?: Transport): Promise<void> =>
  sendCommand(modeCommand(mode), transport)

const setOscillation = (
  axis: "horizontal" | "vertical",
  on: boolean,
  transport?: Transport,
): Promise<void> =>
  sendCommand(
    axis === "horizontal"
      ? horizontalOscillationCommand(on)
      : verticalOscillationCommand(on),
    transport,
  )

const setNightMode = (on: boolean, transport?: Transport): Promise<void> =>
  sendCommand(nightModeCommand(on), transport)

const setTimer = (hours: number, transport?: Transport): Promise<void> =>
  sendCommand(timerCommand(hours), transport)

const getStatus = (transport?: Transport): Promise<FanState> => {
  const device = requireCurrentDevice()
  return resolveTransport(transport).getStatus(device.id)
}

export {
  sendCommand,
  setPower,
  setSpeed,
  setMode,
  setOscillation,
  setNightMode,
  setTimer,
  getStatus,
}
