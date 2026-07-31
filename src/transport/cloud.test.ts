import { beforeEach, describe, expect, it, vi } from "vitest"
import { createCloudTransport, V4_BASE_URL, V5_BASE_URL } from "./cloud.js"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

const jsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  }) as Response

describe("createCloudTransport (v4)", () => {
  it("posts the command grammar as a JSON body to the tenant/sensor path, authorized", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: { success: true } }))

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      tenantId: 77,
      apiVersion: "v4",
    })

    await transport.sendCommand(42, "tune set speed 10")

    expect(fetchMock).toHaveBeenCalledWith(
      `${V4_BASE_URL}/tenants/77/sensors/42/command`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ command: "tune set speed 10" }),
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    )
  })

  it("throws when tenantId is missing", async () => {
    const transport = createCloudTransport({
      getAccessToken: () => "token",
      apiVersion: "v4",
    })

    await expect(transport.sendCommand(42, "tune set power 1")).rejects.toThrow(
      /tenantId is required/,
    )
  })

  it("maps latestData.fullData into a FanState on getStatus", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        latestData: {
          fullData: {
            mode: 1,
            power: 1,
            speed: 12,
            swing: 1,
            tilt: 0,
            timer: 0,
            sensor: "AA:BB:CC:DD:EE:FF",
          },
        },
      }),
    )

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      tenantId: 77,
      apiVersion: "v4",
    })

    await expect(transport.getStatus(42)).resolves.toEqual({
      mode: "natural",
      power: true,
      speed: 12,
      swing: true,
      tilt: false,
      timer: 0,
      sensor: "AA:BB:CC:DD:EE:FF",
    })
  })

  it("throws a descriptive error on a non-ok response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false))

    const transport = createCloudTransport({
      getAccessToken: () => "token",
      tenantId: 77,
      apiVersion: "v4",
    })

    await expect(transport.sendCommand(42, "tune set power 1")).rejects.toThrow(
      /500/,
    )
  })
})

describe("createCloudTransport (v5)", () => {
  it("posts to the sensor/{id}/commands path without needing a tenantId", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: { success: true } }))

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      apiVersion: "v5",
    })

    await transport.sendCommand(42, "tune set speed 10")

    expect(fetchMock).toHaveBeenCalledWith(
      `${V5_BASE_URL}/sensor/42/commands`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("reads status from data/{id}/status, unwrapping the data envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          mode: null,
          power: null,
          speed: 0,
          swing: 0,
          tilt: 0,
          timer: 0,
          sensor: "AA:BB:CC:DD:EE:FF",
        },
      }),
    )

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      apiVersion: "v5",
    })

    await expect(transport.getStatus(42)).resolves.toEqual({
      mode: null,
      power: null,
      speed: 0,
      swing: false,
      tilt: false,
      timer: 0,
      sensor: "AA:BB:CC:DD:EE:FF",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${V5_BASE_URL}/data/42/status`,
      expect.anything(),
    )
  })
})
