import { beforeEach, describe, expect, it, vi } from "vitest"

// keychain.ts shells out to the macOS `security` CLI. We fake that call so
// the suite never touches the real Keychain on the machine running it.
const spawnSync = vi.fn()

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => spawnSync(...args),
}))

const { readToken, writeToken, deleteToken } = await import("./keychain.js")

const originalPlatform = process.platform

const setPlatform = (platform: string): void => {
  Object.defineProperty(process, "platform", { value: platform })
}

beforeEach(() => {
  spawnSync.mockReset()
  setPlatform(originalPlatform === "darwin" ? "darwin" : "darwin")
})

describe("on non-darwin platforms", () => {
  it("readToken throws a clear, actionable error instead of shelling out", () => {
    setPlatform("linux")
    expect(() => readToken("me@example.com")).toThrow(/darwin/)
    expect(spawnSync).not.toHaveBeenCalled()
    setPlatform("darwin")
  })
})

describe("readToken", () => {
  it("returns null when the Keychain has no matching entry", () => {
    spawnSync.mockReturnValue({ status: 1, stdout: "", stderr: "not found" })

    expect(readToken("me@example.com")).toBeNull()
  })

  it("parses the stored JSON token pair", () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ accessToken: "a", refreshToken: "r" }),
      stderr: "",
    })

    expect(readToken("me@example.com")).toEqual({
      accessToken: "a",
      refreshToken: "r",
    })
    expect(spawnSync).toHaveBeenCalledWith(
      "security",
      [
        "find-generic-password",
        "-a",
        "me@example.com",
        "-s",
        "@kud/duux",
        "-w",
      ],
      { encoding: "utf8" },
    )
  })
})

describe("writeToken", () => {
  it("passes the token as an argv element, never interpolated into a shell string", () => {
    spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" })

    writeToken("me@example.com", { accessToken: "a", refreshToken: "r" })

    const [command, args, opts] = spawnSync.mock.calls[0]!
    expect(command).toBe("security")
    expect(args).toContain(
      JSON.stringify({ accessToken: "a", refreshToken: "r" }),
    )
    expect(opts).toEqual({ encoding: "utf8" })
  })

  it("throws when the security CLI reports failure", () => {
    spawnSync.mockReturnValue({ status: 1, stdout: "", stderr: "denied" })

    expect(() =>
      writeToken("me@example.com", { accessToken: "a", refreshToken: "r" }),
    ).toThrow(/denied/)
  })
})

describe("deleteToken", () => {
  it("shells out to delete-generic-password for the given account", () => {
    spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" })

    deleteToken("me@example.com")

    expect(spawnSync).toHaveBeenCalledWith(
      "security",
      ["delete-generic-password", "-a", "me@example.com", "-s", "@kud/duux"],
      { encoding: "utf8" },
    )
  })
})
