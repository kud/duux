import { beforeEach, describe, expect, it, vi } from "vitest"

// config.ts persists to a single JSON file via node:fs. We fake the
// filesystem in memory so the suite is deterministic, offline, and never
// touches the real ~/.config/duux/config.json on the machine running it.
const virtualFile: { exists: boolean; content: string } = {
  exists: false,
  content: "",
}

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => virtualFile.exists),
    readFileSync: vi.fn(() => virtualFile.content),
    writeFileSync: vi.fn((_path: string, content: string) => {
      virtualFile.exists = true
      virtualFile.content = content
    }),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(() => {
      virtualFile.exists = false
      virtualFile.content = ""
    }),
  },
}))

const deleteToken = vi.fn()
vi.mock("./keychain.js", () => ({
  deleteToken: (...args: unknown[]) => deleteToken(...args),
}))

const {
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
} = await import("./config.js")

const seed = (store: unknown): void => {
  virtualFile.exists = true
  virtualFile.content = JSON.stringify(store)
}

beforeEach(() => {
  virtualFile.exists = false
  virtualFile.content = ""
  deleteToken.mockReset()
})

describe("readStore", () => {
  it("returns an empty store when no config file exists", () => {
    expect(readStore()).toEqual({
      version: 1,
      tenantId: null,
      currentDeviceId: null,
      devices: [],
    })
  })

  it("falls back to defaults for missing fields", () => {
    seed({})

    expect(readStore()).toEqual({
      version: 1,
      tenantId: null,
      currentDeviceId: null,
      devices: [],
    })
  })

  it("preserves auth and preferences only when present", () => {
    seed({ devices: [], auth: { account: "me@example.com", expiresAt: 123 } })
    expect(readStore().auth).toEqual({
      account: "me@example.com",
      expiresAt: 123,
    })

    seed({ devices: [] })
    expect(readStore().auth).toBeUndefined()

    seed({ devices: [], preferences: { theme: "dark" } })
    expect(readStore().preferences).toEqual({ theme: "dark" })
  })
})

describe("upsertDevice", () => {
  it("adds a new device and makes it current by default", () => {
    upsertDevice({ id: 1, type: "fan", displayName: "Lounge" })

    expect(listDevices()).toEqual([
      { id: 1, type: "fan", displayName: "Lounge" },
    ])
    expect(getCurrentDevice()).toEqual({
      id: 1,
      type: "fan",
      displayName: "Lounge",
    })
  })

  it("merges into an existing device", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [{ id: 1, type: "fan", displayName: "Lounge" }],
    })

    upsertDevice({ id: 1, type: "fan", displayName: "Lounge (renamed)" })

    expect(getCurrentDevice()).toEqual({
      id: 1,
      type: "fan",
      displayName: "Lounge (renamed)",
    })
  })

  it("does not steal currentDeviceId from an existing store when makeCurrent is false", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [{ id: 1, type: "fan", displayName: "Lounge" }],
    })

    upsertDevice(
      { id: 2, type: "fan", displayName: "Bedroom" },
      { makeCurrent: false },
    )

    expect(readStore().currentDeviceId).toBe(1)
    expect(listDevices().map((d) => d.id)).toEqual([1, 2])
  })
})

describe("findDevice", () => {
  beforeEach(() => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [
        { id: 1, type: "fan", displayName: "Lounge" },
        { id: 2, type: "fan", displayName: "Bedroom" },
      ],
    })
  })

  it("matches by exact id, including as a string", () => {
    expect(findDevice(2)?.displayName).toBe("Bedroom")
    expect(findDevice("2")?.displayName).toBe("Bedroom")
  })

  it("matches by display name, case-insensitively", () => {
    expect(findDevice("lounge")?.id).toBe(1)
  })

  it("returns null when nothing matches", () => {
    expect(findDevice("nope")).toBeNull()
  })
})

describe("setCurrentDevice", () => {
  it("returns false and leaves the store untouched for an unknown id", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [{ id: 1, type: "fan", displayName: "Lounge" }],
    })

    expect(setCurrentDevice(9)).toBe(false)
    expect(readStore().currentDeviceId).toBe(1)
  })

  it("switches the current device when it exists", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [
        { id: 1, type: "fan", displayName: "Lounge" },
        { id: 2, type: "fan", displayName: "Bedroom" },
      ],
    })

    expect(setCurrentDevice(2)).toBe(true)
    expect(readStore().currentDeviceId).toBe(2)
  })
})

describe("removeDevices", () => {
  it("deletes the config and clears the Keychain entry once the last device is removed", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [{ id: 1, type: "fan", displayName: "Lounge" }],
      auth: { account: "me@example.com", expiresAt: 123 },
    })

    removeDevices([1])

    expect(deleteToken).toHaveBeenCalledWith("me@example.com")
    expect(readStore()).toEqual({
      version: 1,
      tenantId: null,
      currentDeviceId: null,
      devices: [],
    })
  })

  it("reassigns currentDeviceId when the removed device was current", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: 1,
      devices: [
        { id: 1, type: "fan", displayName: "Lounge" },
        { id: 2, type: "fan", displayName: "Bedroom" },
      ],
    })

    removeDevices([1])

    const store = readStore()
    expect(store.devices).toEqual([
      { id: 2, type: "fan", displayName: "Bedroom" },
    ])
    expect(store.currentDeviceId).toBe(2)
  })
})

describe("tenant id", () => {
  it("reads null when unset and persists a written value", () => {
    expect(readTenantId()).toBeNull()

    writeTenantId(77)

    expect(readTenantId()).toBe(77)
  })
})

describe("auth metadata", () => {
  it("reads null when unset and persists what is written", () => {
    expect(readAuthMeta()).toBeNull()

    writeAuthMeta({ account: "me@example.com", expiresAt: 999 })

    expect(readAuthMeta()).toEqual({
      account: "me@example.com",
      expiresAt: 999,
    })
  })

  it("clearAuthMeta clears the Keychain entry and drops the pointer", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: null,
      devices: [],
      auth: { account: "me@example.com", expiresAt: 999 },
    })

    clearAuthMeta()

    expect(deleteToken).toHaveBeenCalledWith("me@example.com")
    expect(readAuthMeta()).toBeNull()
  })
})

describe("deleteConfig", () => {
  it("clears any Keychain entry the store points at before deleting the file", () => {
    seed({
      version: 1,
      tenantId: null,
      currentDeviceId: null,
      devices: [],
      auth: { account: "me@example.com", expiresAt: 999 },
    })

    expect(deleteConfig()).toBe(true)
    expect(deleteToken).toHaveBeenCalledWith("me@example.com")
  })

  it("returns false and does not touch the Keychain when already gone", () => {
    expect(deleteConfig()).toBe(false)
    expect(deleteToken).not.toHaveBeenCalled()
  })
})

describe("preferences", () => {
  it("reads an empty object when none are stored", () => {
    expect(readPreferences()).toEqual({})
  })

  it("merges written preferences on top of existing ones", () => {
    writePreferences({ theme: "dark" })
    writePreferences({ iconStyle: "outline" })

    expect(readPreferences()).toEqual({ theme: "dark", iconStyle: "outline" })
  })
})
