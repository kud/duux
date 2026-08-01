import type { SensorSummary } from "./types.js"

const V5_BASE_URL = "https://v5.api.cloudgarden.nl"

// Cloudgarden's v4 tenant-scoped paths are retired in practice: /users/current
// no longer carries a `tenants` array at all, /tenants lists nothing (it
// reports a totalCount but an empty page), and /tenants/{id}/sensors answers
// 403 for every tenant the account holds — including the one it owns. v5 is
// flat, so discovery no longer resolves or needs a tenant. The account's
// tenant memberships still exist, at /users/current under `permissions`, but
// nothing in this library requires them any more.
type TenantPermission = {
  tenantId: number
  role: number
}

type CurrentUser = {
  id: string
  username: string
  displayName: string
  email: string
  permissions: TenantPermission[]
}

type Discovered = {
  devices: SensorSummary[]
}

// v5 is inconsistent about envelopes: /users/current and /data/{id}/status
// wrap their payload as { data, errorMessage }, while /sensor answers with a
// bare array. Worse, a refusal arrives as HTTP 200 with the reason in
// errorMessage — so checking response.ok alone turns "Not_Allowed" into a
// silent null. Unwrap both shapes and treat a populated errorMessage as the
// failure it is.
const unwrap = <T>(body: unknown, path: string): T => {
  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    ("data" in body || "errorMessage" in body)
  ) {
    const envelope = body as { data: T | null; errorMessage: string | null }
    if (envelope.errorMessage) {
      throw new Error(
        `Duux API refused ${path}: ${envelope.errorMessage}. The account may not have permission for this device.`,
      )
    }
    if (envelope.data === null) {
      throw new Error(`Duux API returned no data for ${path}`)
    }
    return envelope.data
  }
  return body as T
}

const v5Get = async <T>(accessToken: string, path: string): Promise<T> => {
  const response = await fetch(`${V5_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Duux API request to ${path} failed: ${response.status} ${response.statusText}`,
    )
  }
  return unwrap<T>(await response.json(), path)
}

const fetchCurrentUser = (accessToken: string): Promise<CurrentUser> =>
  v5Get<CurrentUser>(accessToken, "/users/current")

// /smarthome/sensors rather than /sensor: both list the account's devices, but
// only this one carries latestData.fullData, which is where the fan's live
// state actually lives. There is no separate status endpoint — /data/{id}/status
// is refused for every account tested.
const SENSORS_PATH = "/smarthome/sensors"

const fetchSensors = (accessToken: string): Promise<SensorSummary[]> =>
  v5Get<SensorSummary[]>(accessToken, SENSORS_PATH)

// Addressed by the numeric sensor id, not the MAC — the id identifies the
// record and the MAC identifies the hardware, so metadata edits and commands
// go to different places. Setting displayName is what the Duux app's rename
// does, and it is what `sensorLabel` prefers.
const renameSensor = async (
  accessToken: string,
  sensorId: number,
  displayName: string,
): Promise<SensorSummary> => {
  const path = `/sensor/${sensorId}`
  const response = await fetch(`${V5_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName }),
  })
  if (!response.ok) {
    throw new Error(
      `Duux API request to ${path} failed: ${response.status} ${response.statusText}`,
    )
  }
  return unwrap<SensorSummary>(await response.json(), path)
}

// Lists the fans on the account. Pure — it does not touch config.ts.
// Persisting the result (upsertDevice) is left to the caller, the same split
// gtv draws between its (pure) discovery.ts and its (persisting) pairing.ts.
const discover = async (accessToken: string): Promise<Discovered> => ({
  devices: await fetchSensors(accessToken),
})

export {
  discover,
  fetchCurrentUser,
  fetchSensors,
  renameSensor,
  unwrap,
  V5_BASE_URL,
  SENSORS_PATH,
}
export type { Discovered, CurrentUser, TenantPermission }
