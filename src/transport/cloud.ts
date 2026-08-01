import type { Transport } from "./index.js"
import { unwrap, SENSORS_PATH } from "../discovery.js"
import {
  toFanState,
  type ApiVersion,
  type FanState,
  type SensorSummary,
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

  // Addressed by MAC, not by the numeric sensor id. Posting to the id is
  // refused with "Not_Allowed", which reads as a permissions problem and is in
  // fact the wrong identifier.
  const commandPath = (deviceId: string): string =>
    apiVersion === "v4"
      ? `/tenants/${requireTenantId()}/sensors/${deviceId}/command`
      : `/sensor/${deviceId}/commands`

  const sendCommand = async (
    deviceId: string,
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

  // There is no status endpoint. State is carried on the device list as
  // latestData.fullData, so reading one fan means listing them and picking it
  // out by MAC.
  const getStatus = async (deviceId: string): Promise<FanState> => {
    const response = await authorizedFetch(SENSORS_PATH)
    const sensors = unwrap<SensorSummary[]>(await response.json(), SENSORS_PATH)

    const sensor = sensors.find((candidate) => candidate.deviceId === deviceId)
    if (!sensor) {
      throw new Error(`No Duux device found with address ${deviceId}`)
    }

    const raw = sensor.latestData?.fullData
    if (!raw) {
      throw new Error(
        `Duux has no reported state for ${deviceId} yet. The fan may be offline.`,
      )
    }

    return toFanState(raw)
  }

  return { name: "cloud", sendCommand, getStatus }
}

export { createCloudTransport, V4_BASE_URL, V5_BASE_URL }
export type { CloudTransportOptions }
