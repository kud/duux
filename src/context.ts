// Shared "resolve what we're talking to" helpers for client.ts and
// session.ts — both need the same current-device / access-token resolution
// with the same friendly errors, so it lives once, here, rather than being
// duplicated across the two consumers. Not part of the public API — see
// index.ts.

import { getCurrentDevice, readAuthMeta, type Device } from "./config.js"
import { readToken } from "./keychain.js"

const getAccessToken = (): string => {
  const authMeta = readAuthMeta()
  if (!authMeta)
    throw new Error("Not signed in to Duux. Run the login flow first.")

  const token = readToken(authMeta.account)
  if (!token) {
    throw new Error(
      `No Duux credentials found in the Keychain for ${authMeta.account}. Run the login flow again.`,
    )
  }

  if (Date.now() >= authMeta.expiresAt) {
    throw new Error("Duux session has expired. Run the login flow again.")
  }

  return token.accessToken
}

const requireCurrentDevice = (): Device => {
  const device = getCurrentDevice()
  if (!device) {
    throw new Error(
      "No Duux fan configured. Run discovery and select a device first.",
    )
  }
  return device
}

// Commands and status are addressed by MAC. A store written before that field
// existed has no `mac`, so say what to do rather than sending a request that
// would be refused with a misleading permissions error.
const deviceAddress = (device: Device): string => {
  if (!device.mac) {
    throw new Error(
      "This fan was saved before addresses were recorded. Run discovery again to update it.",
    )
  }
  return device.mac
}

export { getAccessToken, requireCurrentDevice, deviceAddress }
