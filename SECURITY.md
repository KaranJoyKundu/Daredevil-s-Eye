# Security policy

## Scope

This repository is an experimental prototype. It is not approved for safety-critical or unsupervised use.

## Reporting a vulnerability

Do not publish API keys, access tokens, pairing codes, personal images or exploitable details in a public issue. Use GitHub's private Report a vulnerability / Security Advisory feature for this repository, or contact the maintainer privately through GitHub.

Include the affected file or route, impact, reproduction steps and suggested mitigation. Do not include Gemini keys or emergency contact details.

## Secret handling

- Never commit .dev.vars, .env, provider keys, Cloudflare tokens, app access tokens or receiver tokens.
- Rotate credentials that have been exposed.
- Use GitHub Actions Secrets for deployment credentials and Cloudflare Worker secrets for runtime credentials.
- Never put production secrets in browser code.
