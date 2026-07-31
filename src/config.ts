import fs from "node:fs"
import path from "node:path"
import { deleteToken } from "./keychain.js"

const CONFIG_PATH = path.join(
  process.env["HOME"] ?? "~",
  ".config",
  "duux",
  "config.json",
)

type Device = {
  id: number
  type: string
  displayName: string
}

// Non-secret auth metadata. The access/refresh tokens themselves live in the
// macOS Keychain (see keychain.ts) — this file only remembers *which*
// Keychain entry to read (the account email) and when the token expires, so
// a caller can decide to re-authenticate without this file ever holding a
// credential.
type AuthMeta = {
  account: string
  expiresAt: number
}

// An opaque bag the core persists but does not interpret. Each consumer (a
// CLI's icon style, a TUI's theme…) defines its own typed view over it.
type Preferences = Record<string, unknown>

type Store = {
  version: 1
  tenantId: number | null
  currentDeviceId: number | null
  devices: Device[]
  auth?: AuthMeta
  preferences?: Preferences
}

const emptyStore = (): Store => ({
  version: 1,
  tenantId: null,
  currentDeviceId: null,
  devices: [],
})

const readStore = (): Store => {
  if (!fs.existsSync(CONFIG_PATH)) return emptyStore()

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<Store>

  return {
    version: 1,
    tenantId: raw.tenantId ?? null,
    currentDeviceId: raw.currentDeviceId ?? null,
    devices: raw.devices ?? [],
    ...(raw.auth ? { auth: raw.auth } : {}),
    ...(raw.preferences ? { preferences: raw.preferences } : {}),
  }
}

const writeStore = (store: Store): void => {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2) + "\n")
}

const listDevices = (): Device[] => readStore().devices

const getCurrentDevice = (): Device | null => {
  const store = readStore()
  return (
    store.devices.find((device) => device.id === store.currentDeviceId) ??
    store.devices[0] ??
    null
  )
}

const findDevice = (query: string | number): Device | null => {
  const needle = String(query).toLowerCase()
  return (
    listDevices().find(
      (device) =>
        String(device.id) === needle ||
        device.displayName.toLowerCase() === needle,
    ) ?? null
  )
}

const upsertDevice = (
  device: Device,
  { makeCurrent = true }: { makeCurrent?: boolean } = {},
): void => {
  const store = readStore()
  const existing = store.devices.find((d) => d.id === device.id)
  const merged: Device = existing ? { ...existing, ...device } : device

  const devices = existing
    ? store.devices.map((d) => (d.id === device.id ? merged : d))
    : [...store.devices, merged]

  writeStore({
    ...store,
    currentDeviceId: makeCurrent
      ? device.id
      : (store.currentDeviceId ?? device.id),
    devices,
  })
}

const setCurrentDevice = (id: number): boolean => {
  const store = readStore()
  if (!store.devices.some((device) => device.id === id)) return false
  writeStore({ ...store, currentDeviceId: id })
  return true
}

const removeDevices = (ids: number[]): void => {
  const store = readStore()
  const devices = store.devices.filter((device) => !ids.includes(device.id))

  if (devices.length === 0) {
    deleteConfig()
    return
  }

  const currentDeviceId = devices.some(
    (device) => device.id === store.currentDeviceId,
  )
    ? store.currentDeviceId
    : devices[0]!.id

  writeStore({ ...store, currentDeviceId, devices })
}

const readTenantId = (): number | null => readStore().tenantId

const writeTenantId = (tenantId: number): void => {
  const store = readStore()
  writeStore({ ...store, tenantId })
}

const readAuthMeta = (): AuthMeta | null => readStore().auth ?? null

const writeAuthMeta = (auth: AuthMeta): void => {
  const store = readStore()
  writeStore({ ...store, auth })
}

// Forgets the signed-in account without touching devices — clears the
// Keychain entry it points at, then drops the pointer from the store.
const clearAuthMeta = (): void => {
  const store = readStore()
  if (store.auth) deleteToken(store.auth.account)
  const { auth: _auth, ...rest } = store
  writeStore(rest as Store)
}

// Deletes the whole store, including clearing any Keychain entry it points
// at — otherwise a reset leaves an orphaned credential with nothing left
// that names it.
const deleteConfig = (): boolean => {
  const store = readStore()
  if (store.auth) deleteToken(store.auth.account)
  if (!fs.existsSync(CONFIG_PATH)) return false
  fs.unlinkSync(CONFIG_PATH)
  return true
}

const readPreferences = (): Preferences => readStore().preferences ?? {}

const writePreferences = (partial: Preferences): Preferences => {
  const store = readStore()
  const preferences = { ...store.preferences, ...partial }
  writeStore({ ...store, preferences })
  return preferences
}

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
}
export type { Device, AuthMeta, Store, Preferences }
