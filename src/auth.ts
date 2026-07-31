import { fetchCurrentUser } from "./discovery.js"
import { writeAuthMeta } from "./config.js"
import { writeToken, type TokenPair } from "./keychain.js"

// The passwordless login flow the Duux app itself uses: request a one-time
// code by email, then exchange it for an OAuth2 token pair over PKCE. The
// code_challenge/code_verifier pair below is not generated per request — it
// is baked into the app binary and reused for every login, so it is
// reproduced verbatim rather than derived. A freshly generated pair would be
// rejected; the server only recognises this one.
const AUTH_HOST = "https://v4.api.cloudgarden.nl"
const DUUX_TENANT_ID = 44
const CLIENT_ID = "83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c"
const REDIRECT_URI = "https://duux-deeplink.vercel.app/login/verify"
const CODE_CHALLENGE_METHOD = "sha256"
const CODE_CHALLENGE = "NzyryiS6cQ7w7ZjwXmFkM4a3ZU0wZ8tLKe1VfuRaYCY"
const CODE_VERIFIER =
  "j2yOyLB3KbdFE3ZjYtm6QGMDBL8-_5FWo0UMYkRVdljLYATNMFa4fJ86vwe3jsVHPsuZcZXGLkezJqHnvhLrRMJjymjDnw-LvCA8WVAFQZNWwFmiUULgNsldc29ZyI36"
const USER_AGENT = "Duux/154 CFNetwork/1335.0.3.4 Darwin/21.6.0"

type LoginCodeResult = {
  success: boolean
  message: string
}

const requestLoginCode = async (email: string): Promise<LoginCodeResult> => {
  const response = await fetch(
    `${AUTH_HOST}/tenants/${DUUX_TENANT_ID}/auth/passwordlessLogin/code`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        email,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge_method: CODE_CHALLENGE_METHOD,
        code_challenge: CODE_CHALLENGE,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Duux login code request failed: ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as LoginCodeResult
}

type TokenExchangeResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

// Exchanges the emailed code for a token pair, then persists it: the tokens
// go to the Keychain (keychain.ts), the account + expiry go to config.ts.
// The token endpoint doesn't return the account's email, so this makes one
// extra call to /users/current with the fresh token purely to learn which
// identity it authenticates as — the Keychain entry needs that as its key.
const exchangeLoginCode = async (code: string): Promise<TokenPair> => {
  const response = await fetch(`${AUTH_HOST}/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: CODE_VERIFIER,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      makeAccessTokenLongLasting: true,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Duux login code exchange failed: ${response.status} ${response.statusText}`,
    )
  }

  const body = (await response.json()) as TokenExchangeResponse
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new Error(
      "Duux login code exchange returned an unexpected response shape",
    )
  }

  const token: TokenPair = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  }
  const expiresAt = Date.now() + body.expires_in * 1000

  const user = await fetchCurrentUser(token.accessToken)
  writeToken(user.email, token)
  writeAuthMeta({ account: user.email, expiresAt })

  return token
}

export { requestLoginCode, exchangeLoginCode }
export type { LoginCodeResult }
