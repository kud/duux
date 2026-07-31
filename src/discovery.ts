import type { SensorSummary } from "./types.js"

const V4_BASE_URL = "https://v4.api.cloudgarden.nl"

// Cloudgarden's tenant 44 is Duux's own house tenant and shows up on every
// account alongside the tenant that actually owns the user's devices — the
// Go reference client (ThisIsNoahEvans/DuuxAPI) confirms this by always
// skipping id 44 when picking a tenant to query. We do the same.
const DUUX_HOUSE_TENANT_ID = 44

type TenantSummary = {
  id: number
  name: string
}

type CurrentUser = {
  id: number
  username: string
  email: string
  tenants: TenantSummary[]
}

type Discovered = {
  tenantId: number
  devices: SensorSummary[]
}

const fetchCurrentUser = async (accessToken: string): Promise<CurrentUser> => {
  const response = await fetch(`${V4_BASE_URL}/users/current`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch the current Duux user: ${response.status} ${response.statusText}`,
    )
  }
  const body = (await response.json()) as { user: CurrentUser }
  return body.user
}

const resolveTenantId = (user: CurrentUser): number => {
  const owned = user.tenants.find(
    (tenant) => tenant.id !== DUUX_HOUSE_TENANT_ID,
  )
  const tenantId = owned?.id ?? user.tenants[0]?.id
  if (tenantId == null) throw new Error("Duux account has no tenants")
  return tenantId
}

const fetchSensors = async (
  accessToken: string,
  tenantId: number,
): Promise<SensorSummary[]> => {
  const response = await fetch(`${V4_BASE_URL}/tenants/${tenantId}/sensors`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Duux sensors: ${response.status} ${response.statusText}`,
    )
  }
  return (await response.json()) as SensorSummary[]
}

// Resolves the account's tenant and its fan list. Pure — it does not touch
// config.ts. Persisting the result (writeTenantId, upsertDevice) is left to
// the caller, the same split gtv draws between its (pure) discovery.ts and
// its (persisting) pairing.ts.
const discover = async (accessToken: string): Promise<Discovered> => {
  const user = await fetchCurrentUser(accessToken)
  const tenantId = resolveTenantId(user)
  const devices = await fetchSensors(accessToken, tenantId)
  return { tenantId, devices }
}

export { discover, fetchCurrentUser, resolveTenantId }
export type { Discovered, CurrentUser, TenantSummary }
