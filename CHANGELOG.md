# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2025

### Fixed
- Fallback secret store for systems without OS keychain
- Update-token UX improvements
- Stream pane overlap issue

## [1.0.0] - 2025

### Added
- Observer mode (read without consumer group)
- Consumer mode (join group, manual commit)
- Producer (send test messages)
- Profile/Broker management with named credentials
- SASL authentication (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER)
- mTLS support
- Schema Registry with Avro decoding
- Multi-tab streaming sessions
- Message search by timestamp
- Export messages to JSON/CSV
- Consumer group management (reset, delete, members)
- Cluster health metrics
- Plugin system for custom message decoders
- Pinned/favorite topics
- Advanced topic search (regex, partition filter)
- Topic groups
- Dark/light theme
- Profile import/export
- Auto-update check (GitHub releases)
- Cross-platform builds (macOS, Windows, Linux)
