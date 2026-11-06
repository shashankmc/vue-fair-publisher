# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is 0.x, minor releases may contain breaking changes.

## [Unreleased]

### Added

- `PublishingAdapter`, with one method per route of fair-publishing's HTTP
  API, and `createHttpAdapter({ baseUrl, getAuthToken })`, which rejects with
  the backend's message, status, code and extra fields (`missing`,
  `training_dataset`, `detail`).
- `PublishWizard`: publish one Dataset or Model with metadata (honouring the
  host's required fields and licenses), creators, access level, an approved
  card (optionally drafted by an LLM), a preview of the deposit and the three
  attestations. Handles every backend refusal; emits `published` and
  `switch-artefact`.
- `RepositoryToken`: connect or forget the personal repository token; the
  token is write-only.
- `PublicationRegistry`: search and filter the platform's publications.
- `VueFairPublisherPlugin`, providing the adapter under `vfp:adapter`.
- Every component says when publishing is turned off on the platform and
  makes no other call.
- `--vfp-*` CSS custom properties for theming.
- Vite library build (ES, UMD, `dist/style.css`, type declarations), Vitest
  tests and a CI workflow on Node 22.
- Repository set up with its FAIR4RS metadata (CITATION.cff, codemeta.json,
  .zenodo.json), license, contributing guide and CI.

[Unreleased]: https://github.com/shashankmc/vue-fair-publisher/commits/main
