// Duux issues 90-day bearer tokens tied to the user's cloud account — long-
// lived credentials, not a device-local secret. Persisting them in
// ~/.config/duux/config.json alongside the rest of the store (like gtv does
// for its device certs) would put them in a plaintext, world-readable-to-
// the-user file that's an easy accidental inclusion in a dotfiles sync. The
// macOS Keychain is the right place for a secret this durable — the same
// call this project's Qobuz tooling already made for its own long-lived
// browser token. Only the token's *expiry timestamp* and the account it
// belongs to live in config.ts; the tokens themselves live here, one
// Keychain item per account email.
//
// This makes the library darwin-only. That's a deliberate trade-off, not an
// oversight — every consumer of this library runs on macOS today.

import { spawnSync } from "node:child_process"

const SERVICE_NAME = "@kud/duux"

type TokenPair = {
  accessToken: string
  refreshToken: string
}

const assertDarwin = (): void => {
  if (process.platform !== "darwin") {
    throw new Error(
      `@kud/duux stores auth tokens in the macOS Keychain and only runs on darwin (current platform: ${process.platform}).`,
    )
  }
}

const readToken = (account: string): TokenPair | null => {
  assertDarwin()

  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", account, "-s", SERVICE_NAME, "-w"],
    { encoding: "utf8" },
  )
  if (result.status !== 0) return null

  const raw = result.stdout.trim()
  return raw ? (JSON.parse(raw) as TokenPair) : null
}

const writeToken = (account: string, token: TokenPair): void => {
  assertDarwin()

  const result = spawnSync(
    "security",
    [
      "add-generic-password",
      "-a",
      account,
      "-s",
      SERVICE_NAME,
      "-w",
      JSON.stringify(token),
      "-U",
    ],
    { encoding: "utf8" },
  )
  if (result.status !== 0) {
    throw new Error(
      `Failed to write Duux credentials to the Keychain: ${result.stderr.trim()}`,
    )
  }
}

const deleteToken = (account: string): void => {
  assertDarwin()
  spawnSync(
    "security",
    ["delete-generic-password", "-a", account, "-s", SERVICE_NAME],
    { encoding: "utf8" },
  )
}

export { readToken, writeToken, deleteToken }
export type { TokenPair }
