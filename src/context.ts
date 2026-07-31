// Shared "resolve what we're talking to" helpers for client.ts and
// session.ts — both need the same current-device / tenant / access-token
// resolution with the same friendly errors, so it lives once, here, rather
// than being duplicated across the two consumers. Not part of the public
// API — see index.ts.

import {
  getCurrentDevice,
  readTenantId,
  readAuthMeta,
  type Device,
} from "./config.js"
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

const requireTenantId = (): number => {
  const tenantId = readTenantId()
  if (tenantId == null)
    throw new Error("No Duux tenant configured. Run discovery first.")
  return tenantId
}

export { getAccessToken, requireCurrentDevice, requireTenantId }
