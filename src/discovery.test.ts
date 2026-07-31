import { beforeEach, describe, expect, it, vi } from "vitest"
import { discover, fetchCurrentUser, unwrap } from "./discovery.js"

describe("unwrap", () => {
  it("returns a bare array untouched", () => {
    const sensors = [{ id: 9, type: "58", name: "DUUX.1", displayName: null }]
    expect(unwrap(sensors, "/sensor")).toEqual(sensors)
  })

  it("unwraps the { data, errorMessage } envelope", () => {
    expect(unwrap({ data: { id: 1 }, errorMessage: null }, "/x")).toEqual({
      id: 1,
    })
  })

  // The whole point: v5 answers a refusal with HTTP 200 and puts the reason
  // in errorMessage, so a response.ok check alone yields a silent null.
  it("throws when errorMessage is populated, even on a 200", () => {
    expect(() =>
      unwrap({ data: null, errorMessage: "Not_Allowed" }, "/data/1/status"),
    ).toThrow(/Not_Allowed/)
  })

  it("throws when the envelope carries no data and no error", () => {
    expect(() => unwrap({ data: null, errorMessage: null }, "/x")).toThrow(
      /no data/,
    )
  })
})

describe("discover", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  const ok = (payload: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(payload),
    })

  it("lists sensors from v5 /sensor without resolving a tenant", async () => {
    const sensors = [
      { id: 373883, type: "58", name: "DUUX.1.356505", displayName: "Whisper" },
    ]
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://v5.api.cloudgarden.nl/sensor") return ok(sensors)
      throw new Error(`unexpected fetch: ${url}`)
    })

    await expect(discover("token-123")).resolves.toEqual({ devices: sensors })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("surfaces a refusal that arrives as a 200", async () => {
    fetchMock.mockImplementation(() =>
      ok({ data: null, errorMessage: "Not_Allowed" }),
    )

    await expect(discover("token-123")).rejects.toThrow(/Not_Allowed/)
  })

  it("throws a descriptive error when the request fails outright", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({}),
    })

    await expect(discover("token-123")).rejects.toThrow(/401/)
  })
})

describe("fetchCurrentUser", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("unwraps the user envelope and exposes tenant permissions", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          data: {
            id: "158567",
            username: "kud",
            displayName: "kud",
            email: "kud@example.com",
            permissions: [
              { tenantId: 44, role: 1 },
              { tenantId: 163587, role: 3 },
            ],
          },
          errorMessage: null,
        }),
    })

    const user = await fetchCurrentUser("token-123")
    expect(user.permissions.map((p) => p.tenantId)).toEqual([44, 163587])
  })
})
