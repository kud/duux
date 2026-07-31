import type { Transport } from "./index.js"
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
// eventual fan-state fields — see the API spec's "Hosts" table. Which one
// the Flex 2 actually answers on is unconfirmed (an open question), so both
// are implemented and selectable via apiVersion; v4 is the default because
// it is the only one confirmed to expose discovery (tenants/sensors).
const createCloudTransport = (options: CloudTransportOptions): Transport => {
  const apiVersion = options.apiVersion ?? "v4"
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
    await authorizedFetch(commandPath(deviceId), {
      method: "POST",
      body: JSON.stringify({ command }),
    })
  }

  const getStatus = async (deviceId: number): Promise<FanState> => {
    const response = await authorizedFetch(statusPath(deviceId))
    const body = (await response.json()) as unknown

    const raw =
      apiVersion === "v4"
        ? (body as { latestData: { fullData: RawFanData } }).latestData.fullData
        : (body as { data: RawFanData }).data

    return toFanState(raw)
  }

  return { name: "cloud", sendCommand, getStatus }
}

export { createCloudTransport, V4_BASE_URL, V5_BASE_URL }
export type { CloudTransportOptions }
