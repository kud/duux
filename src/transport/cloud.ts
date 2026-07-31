import type { Transport } from "./index.js"
import { unwrap } from "../discovery.js"
import {
  toFanState,
  type ApiVersion,
  type FanState,
  type RawFanData,
} from "../types.js"

const V4_BASE_URL = "https://v4.api.cloudgarden.nl"
const V5_BASE_URL = "https://v5.api.cloudgarden.nl"

type CloudTransportOptions = {
  getAccessToken: () => string | Promise<string>
  tenantId?: number
  apiVersion?: ApiVersion
  baseUrl?: string
}

// v4 and v5 differ in path shape but not in the command grammar or the
// eventual fan-state fields — see the API spec's "Hosts" table. v5 is the
// default: v4's tenant-scoped paths answer 403 on a real account, and its
// discovery endpoint no longer returns the tenants it needs. v4 is retained
// because the command grammar is identical and older accounts may still
// answer on it, but nothing reaches for it unprompted any more.
const createCloudTransport = (options: CloudTransportOptions): Transport => {
  const apiVersion = options.apiVersion ?? "v5"
  const baseUrl =
    options.baseUrl ?? (apiVersion === "v4" ? V4_BASE_URL : V5_BASE_URL)

  const requireTenantId = (): number => {
    if (options.tenantId == null)
      throw new Error(
        `tenantId is required for the Duux ${apiVersion} cloud API`,
      )
    return options.tenantId
  }

  const authorizedFetch = async (
    path: string,
    init: RequestInit = {},
  ): Promise<Response> => {
    const accessToken = await options.getAccessToken()
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    })
    if (!response.ok) {
      throw new Error(
        `Duux cloud API request to ${path} failed: ${response.status} ${response.statusText}`,
      )
    }
    return response
  }

  const commandPath = (deviceId: number): string =>
    apiVersion === "v4"
      ? `/tenants/${requireTenantId()}/sensors/${deviceId}/command`
      : `/sensor/${deviceId}/commands`

  const statusPath = (deviceId: number): string =>
    apiVersion === "v4"
      ? `/tenants/${requireTenantId()}/sensors/${deviceId}`
      : `/data/${deviceId}/status`

  const sendCommand = async (
    deviceId: number,
    command: string,
  ): Promise<void> => {
    const path = commandPath(deviceId)
    const response = await authorizedFetch(path, {
      method: "POST",
      body: JSON.stringify({ command }),
    })
    // A refused command comes back as HTTP 200 with the reason in the body,
    // so the response must be read even though nothing needs its value —
    // otherwise every rejection reads as a successful send.
    unwrap<unknown>(await response.json().catch(() => null), path)
  }

  const getStatus = async (deviceId: number): Promise<FanState> => {
    const path = statusPath(deviceId)
    const response = await authorizedFetch(path)
    const body = (await response.json()) as unknown

    const raw =
      apiVersion === "v4"
        ? (body as { latestData: { fullData: RawFanData } }).latestData.fullData
        : unwrap<RawFanData>(body, path)

    return toFanState(raw)
  }

  return { name: "cloud", sendCommand, getStatus }
}

export { createCloudTransport, V4_BASE_URL, V5_BASE_URL }
export type { CloudTransportOptions }
