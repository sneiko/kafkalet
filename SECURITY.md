# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in kafkalet, please report it responsibly.

**Do not open a public issue.**

Instead, email: **sneikovich@gmail.com**

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Scope

- Authentication credential handling (SASL, mTLS, OAuth)
- OS keychain integration (go-keyring)
- Secret fallback encryption (AES-256-GCM)
- Profile import/export with secrets
- Schema Registry authentication
- Auto-update mechanism

## Out of Scope

- Kafka broker security configuration (this is the broker admin's responsibility)
- Vulnerabilities in upstream dependencies (report those to the respective projects)
