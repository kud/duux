import type { FanState } from "../types.js"

// The seam: cloud POSTs `{"command": "tune set speed 10"}` to REST, local
// MQTT publishes the identical string to sensor/{id}/command — same
// grammar (commands.ts), different pipe. Nothing in the domain model
// (client.ts, session.ts) knows or cares which implementation it holds.
interface Transport {
  readonly name: "cloud" | "mqtt"
  sendCommand(deviceId: number, command: string): Promise<void>
  getStatus(deviceId: number): Promise<FanState>
  // Push-based updates. Only meaningful for transports with a persistent
  // connection (MQTT) — cloud transports have no push channel and are
  // polled instead; see session.ts.
  subscribe?(deviceId: number, onUpdate: (state: FanState) => void): () => void
}

export type { Transport }
