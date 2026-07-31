// EXPERIMENTAL — unverified against a real Duux Flex 2 or a local broker.
// Implements the shape described in the API spec's "Local MQTT transport"
// section: the same "tune set …" command grammar as the cloud API,
// published to sensor/{id}/command over TLS. The device's certificate is
// validated but not pinned, so a DNS override to a local broker (EMQX or
// Mosquitto with TLS) is how you'd actually get the fan talking to this
// instead of Cloudgarden. Nobody on this project has a broker set up yet —
// treat this as a correct shape, not a proven one. Get a fan onto a local
// broker before relying on it.

import mqtt, { type MqttClient } from "mqtt"
import type { Transport } from "./index.js"
import { toFanState, type FanState, type RawFanData } from "../types.js"

const DEFAULT_HOST = "collector3.cloudgarden.nl"
const DEFAULT_PORT = 443

type MqttTransportOptions = {
  host?: string
  port?: number
  clientId?: string
  username?: string
  password?: string
}

const topic = (
  deviceId: number,
  suffix: "in" | "online" | "update" | "command",
): string => `sensor/${deviceId}/${suffix}`

const createMqttTransport = (options: MqttTransportOptions = {}): Transport => {
  const client: MqttClient = mqtt.connect({
    host: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    protocol: "mqtts",
    ...(options.clientId ? { clientId: options.clientId } : {}),
    ...(options.username ? { username: options.username } : {}),
    ...(options.password ? { password: options.password } : {}),
  })

  const subscribedTopics = new Set<string>()

  const ensureSubscribed = (deviceId: number): void => {
    const stateTopic = topic(deviceId, "in")
    if (subscribedTopics.has(stateTopic)) return
    subscribedTopics.add(stateTopic)
    client.subscribe(stateTopic)
  }

  const sendCommand = (deviceId: number, command: string): Promise<void> =>
    new Promise((resolve, reject) => {
      client.publish(topic(deviceId, "command"), command, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })

  // The device publishes state on sensor/{id}/in rather than answering a
  // request/response call, so a one-shot getStatus waits for the next
  // publish — there is no pull endpoint on this transport.
  const getStatus = (deviceId: number): Promise<FanState> =>
    new Promise((resolve, reject) => {
      const stateTopic = topic(deviceId, "in")

      const handler = (receivedTopic: string, payload: Buffer): void => {
        if (receivedTopic !== stateTopic) return
        client.removeListener("message", handler)
        try {
          resolve(toFanState(JSON.parse(payload.toString()) as RawFanData))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }

      client.on("message", handler)
      ensureSubscribed(deviceId)
    })

  const subscribe = (
    deviceId: number,
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
