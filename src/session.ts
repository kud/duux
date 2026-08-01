import { EventEmitter } from "node:events"
import { createCloudTransport } from "./transport/cloud.js"
import type { Transport } from "./transport/index.js"
import { getCurrentDevice, type Device } from "./config.js"
import { getAccessToken, deviceAddress } from "./context.js"
import {
  powerCommand,
  speedCommand,
  modeCommand,
  horizontalOscillationCommand,
  verticalOscillationCommand,
  nightModeCommand,
  childLockCommand,
  timerCommand,
} from "./commands.js"
import type { FanMode, FanSessionState } from "./types.js"

const DEFAULT_POLL_INTERVAL_MS = 30_000

interface Session extends EventEmitter {
  readonly state: FanSessionState
  setPower(on: boolean): Promise<void>
  setSpeed(speed: number): Promise<void>
  setMode(mode: FanMode): Promise<void>
  setOscillation(
    axis: "horizontal" | "vertical",
    on: number | boolean,
  ): Promise<void>
  setNightMode(on: boolean): Promise<void>
  setChildLock(on: boolean): Promise<void>
  setTimer(hours: number): Promise<void>
  refresh(): Promise<void>
  stop(): void
  on(event: "change", listener: (state: FanSessionState) => void): this
  on(event: "error", listener: (error: Error) => void): this
}

type CreateSessionOptions = {
  device?: Device
  transport?: Transport
  pollIntervalMs?: number
}

// A long-lived, transport-agnostic connection to a fan. Cloud transports
// have no push channel, so state is polled on an interval (30s default,
// matching the ha-duux integration this was reverse-engineered against);
// MQTT transports push, so a subscription is used instead — see
// transport/index.ts. Either way the caller only ever sees "change" events
// on one observable `state`.
const createSession = (options: CreateSessionOptions = {}): Session => {
  const emitter = new EventEmitter()
  const state: FanSessionState = {
    deviceId: null,
    connected: false,
    fan: null,
    error: null,
  }

  const update = (patch: Partial<FanSessionState>): void => {
    Object.assign(state, patch)
    emitter.emit("change", state)
  }

  const device = options.device ?? getCurrentDevice()
  let transport: Transport | undefined
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let unsubscribe: (() => void) | undefined

  const refresh = async (): Promise<void> => {
    if (!device || !transport) return
    try {
      const fan = await transport.getStatus(deviceAddress(device))
      update({ connected: true, fan, error: null })
    } catch (error) {
      update({
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!device) {
    update({
      error: "No Duux fan configured. Run discovery and select a device first.",
    })
  } else {
    update({ deviceId: device.id })

    try {
      transport = options.transport ?? createCloudTransport({ getAccessToken })
    } catch (error) {
      update({ error: error instanceof Error ? error.message : String(error) })
    }

    if (transport?.subscribe) {
      unsubscribe = transport.subscribe(deviceAddress(device), (fan) =>
        update({ connected: true, fan, error: null }),
      )
      update({ connected: true })
    } else if (transport) {
      void refresh()
      pollTimer = setInterval(
        () => void refresh(),
        options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      )
    }
  }

  // The fan takes a moment to apply a command and the cloud a moment more to
  // report it, so a read straight after a write still returns the old value.
  // Re-reading after this delay is what turns a caller's optimistic value into
  // a confirmed one instead of leaving it pending until the next poll.
  const CONFIRM_DELAY_MS = 1_500

  const withDevice = (
    fn: (t: Transport, d: Device) => Promise<void>,
  ): Promise<void> => {
    if (!device || !transport) return Promise.resolve()
    return fn(transport, device)
      .then(() => {
        setTimeout(() => void refresh(), CONFIRM_DELAY_MS)
      })
      .catch((error: unknown) => {
        update({
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const setPower = (on: boolean): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), powerCommand(on)))
  const setSpeed = (speed: number): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), speedCommand(speed)))
  const setMode = (mode: FanMode): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), modeCommand(mode)))
  const setOscillation = (
    axis: "horizontal" | "vertical",
    on: number | boolean,
  ): Promise<void> =>
    withDevice((t, d) =>
      t.sendCommand(
        deviceAddress(d),
        axis === "horizontal"
          ? horizontalOscillationCommand(on)
          : verticalOscillationCommand(on),
      ),
    )
  const setNightMode = (on: boolean): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), nightModeCommand(on)))
  const setChildLock = (on: boolean): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), childLockCommand(on)))
  const setTimer = (hours: number): Promise<void> =>
    withDevice((t, d) => t.sendCommand(deviceAddress(d), timerCommand(hours)))

  const stop = (): void => {
    if (pollTimer) clearInterval(pollTimer)
    unsubscribe?.()
  }

  return Object.assign(emitter, {
    state,
    setPower,
    setSpeed,
    setMode,
    setOscillation,
    setNightMode,
    setChildLock,
    setTimer,
    refresh,
    stop,
  }) as Session
}

export { createSession }
export type { Session, CreateSessionOptions }
