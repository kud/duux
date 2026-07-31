// Device store + tenant + auth metadata (non-secret)
export {
  readStore,
  listDevices,
  getCurrentDevice,
  findDevice,
  upsertDevice,
  setCurrentDevice,
  removeDevices,
  readTenantId,
  writeTenantId,
  readAuthMeta,
  writeAuthMeta,
  clearAuthMeta,
  deleteConfig,
  readPreferences,
  writePreferences,
  CONFIG_PATH,
} from "./config.js"
export type { Device, AuthMeta, Store, Preferences } from "./config.js"

// Auth tokens (macOS Keychain — see keychain.ts for why they live here and
// not in config.json)
export { readToken, writeToken, deleteToken } from "./keychain.js"
export type { TokenPair } from "./keychain.js"

// Passwordless login flow
export { requestLoginCode, exchangeLoginCode } from "./auth.js"
export type { LoginCodeResult } from "./auth.js"

// Command grammar
export {
  buildCommand,
  powerCommand,
  speedCommand,
  modeCommand,
  horizontalOscillationCommand,
  verticalOscillationCommand,
  nightModeCommand,
  timerCommand,
} from "./commands.js"
export type { Command } from "./commands.js"

// Transports
export {
  createCloudTransport,
  V4_BASE_URL,
  V5_BASE_URL,
} from "./transport/cloud.js"
export type { CloudTransportOptions } from "./transport/cloud.js"
export { createMqttTransport } from "./transport/mqtt.js"
export type { MqttTransportOptions } from "./transport/mqtt.js"
export type { Transport } from "./transport/index.js"

// Discovery
export {
  discover,
  fetchCurrentUser,
  fetchSensors,
  unwrap,
} from "./discovery.js"
export type { Discovered, CurrentUser, TenantPermission } from "./discovery.js"

// One-shot commands
export {
  sendCommand,
  setPower,
  setSpeed,
  setMode,
  setOscillation,
  setNightMode,
  setTimer,
  getStatus,
} from "./client.js"

// Stateful session
export { createSession } from "./session.js"
export type { Session, CreateSessionOptions } from "./session.js"

// Domain types
export {
  toFanState,
  sensorLabel,
  FAN_MODE_VALUES,
  FAN_MODE_BY_VALUE,
} from "./types.js"
export type {
  FanMode,
  FanState,
  RawFanData,
  SensorSummary,
  FanSessionState,
  ApiVersion,
} from "./types.js"
