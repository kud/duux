import { beforeEach, describe, expect, it, vi } from "vitest"
import { discover, resolveTenantId } from "./discovery.js"

describe("resolveTenantId", () => {
  it("picks the tenant that isn't Duux's own house tenant (44)", () => {
    const user = {
      id: 1,
      username: "kud",
      email: "kud@example.com",
      tenants: [
        { id: 44, name: "Duux" },
        { id: 512, name: "kud's home" },
      ],
    }

    expect(resolveTenantId(user)).toBe(512)
  })

  it("falls back to tenant 44 when it is the only tenant on the account", () => {
    const user = {
      id: 1,
      username: "kud",
      email: "kud@example.com",
      tenants: [{ id: 44, name: "Duux" }],
    }

    expect(resolveTenantId(user)).toBe(44)
  })

  it("throws when the account has no tenants at all", () => {
    const user = {
      id: 1,
      username: "kud",
      email: "kud@example.com",
      tenants: [],
    }

    expect(() => resolveTenantId(user)).toThrow(/no tenants/)
  })
})

describe("discover", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("resolves the tenant from /users/current, then lists its sensors", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/users/current")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () =>
            Promise.resolve({
              user: {
                id: 1,
                username: "kud",
                email: "kud@example.com",
                tenants: [
                  { id: 44, name: "Duux" },
                  { id: 512, name: "kud's home" },
                ],
              },
            }),
        })
      }
      if (url.includes("/tenants/512/sensors")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () =>
            Promise.resolve([{ id: 9, type: "fan", displayName: "Bedroom" }]),
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await expect(discover("token-123")).resolves.toEqual({
      tenantId: 512,
      devices: [{ id: 9, type: "fan", displayName: "Bedroom" }],
    })
  })

  it("throws a descriptive error when /users/current fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({}),
    })

    await expect(discover("token-123")).rejects.toThrow(/401/)
  })
})
