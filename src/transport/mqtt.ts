// For a LOCAL broker. The cloud transport is the default and works against
// Duux's own API, so this exists for running without the cloud at all: point
// collector3.cloudgarden.nl at your own broker by DNS and the fan connects
// there instead, publishing to sensor/{mac}/in and accepting the same
// "tune set …" commands.
//
// Connecting to Cloudgarden's *own* broker is not possible: the TLS handshake
// succeeds with the pinned certificate below, but the CONNECT is refused with
// "Bad username or password", and no credentials the REST API exposes are
// accepted. Supply your own via username/password if your broker needs them.

import mqtt, { type MqttClient } from "mqtt"
import type { Transport } from "./index.js"
import { toFanState, type FanState, type RawFanData } from "../types.js"

const DEFAULT_HOST = "collector3.cloudgarden.nl"
const DEFAULT_PORT = 443
const DEFAULT_STATUS_TIMEOUT_MS = 10_000

// Cloudgarden serves this broker with a self-signed certificate whose SAN
// list is "localhost", an empty DNS entry and two private IPs — its own
// hostname is absent, so ordinary verification cannot succeed no matter which
// CA store is used. Pinning the exact certificate and skipping only the
// hostname check keeps the connection meaningful: an impostor still needs
// Cloud Garden's private key, which `rejectUnauthorized: false` would not
// require. Valid to 2031-12-05; if it is rotated, this constant is the one
// thing to replace.
const COLLECTOR3_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDwjCCAqqgAwIBAgIUEIm++z9XUR7oZjgO/bv92fvU3rQwDQYJKoZIhvcNAQEL
BQAwgYYxCzAJBgNVBAYTAk5MMRMwEQYDVQQIDApTb21lLVN0YXRlMRowGAYDVQQK
DBFDbG91ZCBHYXJkZW4gQi5WLjEiMCAGA1UEAwwZY29sbGVjdG9yMy5jbG91ZGdh
cmRlbi5ubDEiMCAGCSqGSIb3DQEJARYTaW5mb0BjbG91ZGdhcmRlbi5ubDAeFw0y
MTEyMDcwNzM1MDdaFw0zMTEyMDUwNzM1MDdaMIGGMQswCQYDVQQGEwJOTDETMBEG
A1UECAwKU29tZS1TdGF0ZTEaMBgGA1UECgwRQ2xvdWQgR2FyZGVuIEIuVi4xIjAg
BgNVBAMMGWNvbGxlY3RvcjMuY2xvdWRnYXJkZW4ubmwxIjAgBgkqhkiG9w0BCQEW
E2luZm9AY2xvdWRnYXJkZW4ubmwwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQDhWZ4u5n9ey+rwkIrAFz0KOC0YKABE4j95DE8H7jfweJpSkyxqzhL7OPlP
7A1ioNNhShKE0FuDlpmU4Gr10DeiAbU6wmEyBwMDJk0HweLprkxIIEs6Kx2OGDwP
yCQ8L1Dt1j13SwURnt/VishPgR0vMRWzUm2B1zOVHx5/Hj0g1/JjLCn4eoU0+6ye
gG/Ugmj9iBOiZOlQAgzcfOz4/3rF3+CzU1pUp0JhrXFjyO6sofwTDgYsPG7IIwq6
adVdBurDSz03hHT1qYuvle9kwyxtiLejm6Ghf66++qqOsPd8tUfFIRpB1lt9OSRh
stz1b9Y3fx8aXdOjW06X1YjiwAHzAgMBAAGjJjAkMCIGA1UdEQQbMBmCCWxvY2Fs
aG9zdIIAhwR/AAABhwQKhXgUMA0GCSqGSIb3DQEBCwUAA4IBAQCKjB3K1ILq4m7r
7DRzDLjh+jk4pph1FEg3tikJiy9DVKhHsKfboafCWqSebGnxP4kJIPd/0Ml2D0Nu
fJVX9CB3TaLsS64OjAmsh4Qnd/+nOLNj0oYsq2UWAMxi4bdupIY0tubwsaiZRAGn
7FEjKgDGVnsS1jLabC9hYgzHtJsqDAtYNDRkOjReqa5yARcM4b4HQ9Xker92rIPU
Kb5Jw6RiVfMaJnvD7uIBqYVf/eRxSorXT1z6oG61006Y/0Gue3UdvmikuAdj3jt4
6y0IGj5/M3/rO3Afuy36Nf7qehUWU+H2vZgIz13RzSII+dHpV1Ud0QJFyGqzp1X9
kDc4AQn8
-----END CERTIFICATE-----
`

type MqttTransportOptions = {
  host?: string
  port?: number
  clientId?: string
  username?: string
  password?: string
  // Set for a local broker (EMQX, Mosquitto) with its own certificate. Left
  // unset, the pinned Cloudgarden certificate above is used.
  ca?: string | Buffer
  rejectUnauthorized?: boolean
  // How long a one-shot getStatus waits for the fan to publish before giving
  // up. The fan pushes on its own schedule, so this is a deadline, not a
  // request timeout.
  statusTimeoutMs?: number
}

const topic = (
  deviceId: string,
  suffix: "in" | "online" | "update" | "command",
): string => `sensor/${deviceId}/${suffix}`

const createMqttTransport = (options: MqttTransportOptions = {}): Transport => {
  const usesDefaultHost = (options.host ?? DEFAULT_HOST) === DEFAULT_HOST
  const statusTimeoutMs = options.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS

  const client: MqttClient = mqtt.connect({
    host: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    protocol: "mqtts",
    ca: [Buffer.from(options.ca ?? COLLECTOR3_CERTIFICATE)],
    // Only Cloudgarden's own broker has the mismatched SAN list; a local
    // broker should be held to the normal hostname check.
    ...(usesDefaultHost && options.ca === undefined
      ? { checkServerIdentity: () => undefined }
      : {}),
    ...(options.rejectUnauthorized !== undefined
      ? { rejectUnauthorized: options.rejectUnauthorized }
      : {}),
    ...(options.clientId ? { clientId: options.clientId } : {}),
    ...(options.username ? { username: options.username } : {}),
    ...(options.password ? { password: options.password } : {}),
  })

  const subscribedTopics = new Set<string>()

  const ensureSubscribed = (deviceId: string): void => {
    const stateTopic = topic(deviceId, "in")
    if (subscribedTopics.has(stateTopic)) return
    subscribedTopics.add(stateTopic)
    client.subscribe(stateTopic)
  }

  const sendCommand = (deviceId: string, command: string): Promise<void> =>
    new Promise((resolve, reject) => {
      client.publish(topic(deviceId, "command"), command, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })

  // The device publishes state on sensor/{id}/in rather than answering a
  // request/response call, so a one-shot getStatus waits for the next publish
  // — there is no pull endpoint on this transport. It therefore needs a
  // deadline: without one, a broker the fan has never connected to leaves the
  // caller hanging indefinitely with no output at all.
  const getStatus = (deviceId: string): Promise<FanState> =>
    new Promise((resolve, reject) => {
      const stateTopic = topic(deviceId, "in")

      const settle = (fn: () => void) => {
        clearTimeout(timer)
        client.removeListener("message", handler)
        fn()
      }

      const handler = (receivedTopic: string, payload: Buffer): void => {
        if (receivedTopic !== stateTopic) return
        settle(() => {
          try {
            resolve(toFanState(JSON.parse(payload.toString()) as RawFanData))
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      }

      const timer = setTimeout(() => {
        settle(() =>
          reject(
            new Error(
              `No state published on ${stateTopic} within ${statusTimeoutMs}ms. The fan may not be connected to this broker.`,
            ),
          ),
        )
      }, statusTimeoutMs)

      client.on("message", handler)
      ensureSubscribed(deviceId)
    })

  const subscribe = (
    deviceId: string,
    onUpdate: (state: FanState) => void,
  ): (() => void) => {
    const stateTopic = topic(deviceId, "in")

    const handler = (receivedTopic: string, payload: Buffer): void => {
      if (receivedTopic !== stateTopic) return
      try {
        onUpdate(toFanState(JSON.parse(payload.toString()) as RawFanData))
      } catch {
        // Malformed or partial publish — skip rather than crash the session.
      }
    }

    client.on("message", handler)
    ensureSubscribed(deviceId)

    return () => client.removeListener("message", handler)
  }

  return { name: "mqtt", sendCommand, getStatus, subscribe }
}

export { createMqttTransport }
export type { MqttTransportOptions }
