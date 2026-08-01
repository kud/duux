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

    await transport.sendCommand("aa:bb:cc:dd:ee:ff", "tune set speed 10")

    expect(fetchMock).toHaveBeenCalledWith(
      `${V4_BASE_URL}/tenants/77/sensors/aa:bb:cc:dd:ee:ff/command`,
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

    await expect(transport.sendCommand("aa:bb:cc:dd:ee:ff", "tune set power 1")).rejects.toThrow(
      /tenantId is required/,
    )
  })

  it("throws a descriptive error on a non-ok response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false))

    const transport = createCloudTransport({
      getAccessToken: () => "token",
      tenantId: 77,
      apiVersion: "v4",
    })

    await expect(transport.sendCommand("aa:bb:cc:dd:ee:ff", "tune set power 1")).rejects.toThrow(
      /500/,
    )
  })
})

describe("createCloudTransport (v5)", () => {
  const MAC = "28:05:a5:43:1f:c0"

  it("addresses commands by MAC, not by the numeric sensor id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: "ok", errorMessage: null }),
    )

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      apiVersion: "v5",
    })

    await transport.sendCommand(MAC, "tune set speed 10")

    expect(fetchMock).toHaveBeenCalledWith(
      `${V5_BASE_URL}/sensor/${MAC}/commands`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  // There is no per-device status endpoint: state rides along on the device
  // list as latestData.fullData, so reading one fan means listing them all.
  it("reads state from the device list, matching on MAC", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { id: 1, deviceId: "aa:bb:cc:dd:ee:ff", latestData: null },
          {
            id: 373883,
            deviceId: MAC,
            latestData: {
              fullData: {
                mode: 1,
                power: 0,
                speed: 6,
                horosc: 1,
                verosc: 0,
                night: 1,
                timer: 0,
                sensor: MAC,
              },
            },
          },
        ],
        errorMessage: null,
      }),
    )

    const transport = createCloudTransport({
      getAccessToken: () => "token-123",
      apiVersion: "v5",
    })

    await expect(transport.getStatus(MAC)).resolves.toEqual({
      mode: "natural",
      power: false,
      speed: 6,
      horosc: 1,
      verosc: 0,
      night: true,
      timer: 0,
      sensor: MAC,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${V5_BASE_URL}/smarthome/sensors`,
      expect.anything(),
    )
  })
})
