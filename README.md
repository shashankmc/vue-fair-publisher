# vue-fair-publisher

Vue 3 components for publishing datasets and models to a research repository (Zenodo in v1) with FAIR metadata: choosing what to publish, metadata, access level, attestation, the dataset or model card, and a registry of published records. Talks to fair-publishing's HTTP API through a host-supplied adapter.

Status: in development (BAIGLE issue shashankmc/reducing_digital_divide#69). The
API is not stable before 1.0.

## Installation

```bash
npm install vue-fair-publisher
```

Vue 3.4 or later is a peer dependency. The package has no other runtime
dependencies. Import the stylesheet once:

```ts
import 'vue-fair-publisher/style.css'
```

## The adapter

The components never call the network themselves. They use a
`PublishingAdapter`, with one method per route of fair-publishing's HTTP API
(`docs/openapi.yaml` in fair-publishing, mounted under `/api/publishing`).
`createHttpAdapter` implements it with `fetch`:

```ts
import { createHttpAdapter } from 'vue-fair-publisher'

const adapter = createHttpAdapter({
  baseUrl: '/api/publishing', // where the host mounts the API
  getAuthToken: () => session.accessToken, // optional; sent as a Bearer token
})
```

| Method | Route | Resolves to |
| --- | --- | --- |
| `getConfig()` | `GET /config` | `PublishingConfig` |
| `getTokenStatus()` | `GET /token` | `{ connected }` |
| `saveToken(token)` | `PUT /token` | `{ connected }` (the token is never returned) |
| `deleteToken()` | `DELETE /token` | nothing |
| `listArtefacts()` | `GET /artefacts` | `Artefact[]` |
| `draftCard({ kind, id })` | `POST /card-draft` | `{ card, source: 'llm' \| 'template' }` |
| `preview(request)` | `POST /preview` | `{ datacite, ro_crate, card, files }` |
| `publish(request)` | `POST /publish` | `Publication` |
| `listPublications(q?, kind?)` | `GET /registry?q=&kind=` | `Publication[]` |
| `getPublication(id)` | `GET /registry/{id}` | `Publication` |

Every method rejects with a `PublishingError`: an `Error` whose `message` is
the backend's `error` text, with `status`, `code` and any extra fields the
backend sent (`missing`, `training_dataset`, `detail`). You can write your own
adapter, for example for tests or another transport, as long as it keeps that
shape.

Pass the adapter to each component as the `adapter` prop, or install the
plugin, which provides it under the injection key `vfp:adapter` (exported as
`ADAPTER_KEY`) and registers the components globally:

```ts
import { VueFairPublisherPlugin } from 'vue-fair-publisher'

app.use(VueFairPublisherPlugin, { adapter }) // or { adapter: { baseUrl, getAuthToken } }
```

## Components

When the host's `config.enabled` is false, every component says that
publishing is turned off on this platform and makes no other call.

All components take an optional `config` prop (`PublishingConfig`). Pass it if
you have already fetched it, and the component will not fetch it again.

### `PublishWizard`

Publishes one Dataset or Model: the metadata form (prefilled from the
artefact, honouring `config.required_fields` and `config.licenses`), creators,
access level (open, restricted with access conditions, or metadata only),
the card (drafted with `draftCard`, editable, and approved by the user), a
preview of the deposit, the three attestations (license, rights, personal
data) and Publish. Publish stays disabled until the preview has loaded, the
token is connected and all three attestations are confirmed.

| Prop | Type | |
| --- | --- | --- |
| `adapter` | `PublishingAdapter` | Optional with the plugin |
| `config` | `PublishingConfig` | Optional |
| `kind`, `id` | `'dataset' \| 'model'`, `string` | The artefact to publish. Without them the user picks one from `listArtefacts()`. |

| Event | Payload | When |
| --- | --- | --- |
| `published` | `Publication` | The deposit succeeded. The wizard shows the DOI and the record link. |
| `switch-artefact` | `{ kind: 'dataset', id }` | The user chose to publish a Model's training Dataset first. The wizard opens that Dataset itself when it is in `listArtefacts()`; listen to update your route. |

A Model whose training Dataset has no DOI is not offered the form; the wizard
explains that the Dataset must be published first. Backend refusals are shown
by their message, with specific handling for `token_required` (shows
`RepositoryToken`), `round_trip_failed` (shows `detail`; publishing is
refused), `dataset_doi_required`, and `attestation_required` /
`missing_fields` (highlights what is missing).

### `RepositoryToken`

Connects or forgets the user's personal repository token (for Zenodo, a
personal access token). The token field is write-only: it is read when the
form is submitted, sent once with `saveToken` and cleared, and never kept in
component state or browser storage. Links to `config.repository.token_url` and
shows "Sandbox" when `config.repository.sandbox` is true.

| Prop | Type |
| --- | --- |
| `adapter` | `PublishingAdapter` (optional with the plugin) |
| `config` | `PublishingConfig` (optional) |

| Event | Payload | When |
| --- | --- | --- |
| `change` | `boolean` | The token was saved (`true`) or forgotten (`false`). |

### `PublicationRegistry`

The publications on this platform, searchable by text (`q`) and filterable by
kind, with DOI and record links, access level, license, the training Dataset
of a Model, and a "Yours" mark on the user's own.

| Prop | Type | |
| --- | --- | --- |
| `adapter` | `PublishingAdapter` | Optional with the plugin |
| `config` | `PublishingConfig` | Optional; used to show license titles |
| `kind` | `'dataset' \| 'model'` | Start filtered to one kind |

## Theming

Classes are prefixed `vfp-`. Colours, type and radii are CSS custom properties
on `:root` and on `.vfp` (every component's root), so a host can map its own
tokens:

```css
html:root,
html .vfp {
  --vfp-font-sans: 'Inter Variable', system-ui, sans-serif;
  --vfp-surface: rgb(var(--white));
  --vfp-surface-sunken: rgb(var(--gray-50));
  --vfp-border: rgb(var(--gray-200));
  --vfp-border-strong: rgb(var(--gray-300));
  --vfp-text: rgb(var(--gray-900));
  --vfp-text-muted: rgb(var(--gray-600));
  --vfp-accent: rgb(var(--primary-600));
  --vfp-accent-strong: rgb(var(--primary-700));
  --vfp-accent-soft: rgb(var(--primary-50));
  --vfp-on-accent: rgb(var(--white));
  --vfp-success: rgb(var(--green-600));
  --vfp-success-soft: rgb(var(--green-50));
  --vfp-warning: rgb(var(--amber-600));
  --vfp-warning-soft: rgb(var(--amber-50));
  --vfp-error: rgb(var(--red-600));
  --vfp-error-soft: rgb(var(--red-50));
}
```

The full list is in `src/styles/tokens.css` (also `--vfp-text-subtle`,
`--vfp-font-mono`, `--vfp-radius-sm|md|lg` and `--vfp-space-xs|sm|md|lg`).

## Development

```bash
npm ci
npm test       # Vitest component and adapter tests, then the vue-tsc type check
npm run build  # dist/: ES and UMD bundles, style.css and type declarations
```

## How to cite

If you use vue-fair-publisher in research or teaching, please cite it. The citation
metadata is in [`CITATION.cff`](CITATION.cff) (GitHub's "Cite this repository"
button reads it); [`codemeta.json`](codemeta.json) carries the same metadata in
CodeMeta form.

> Chakravarthy, S. (2026). *vue-fair-publisher* (Version 0.1.0) [Computer software].
> Maastricht University. https://github.com/shashankmc/vue-fair-publisher

**DOI:** not yet assigned. Once the repository is connected to Zenodo, each
GitHub release will be archived there and its DOI (and a DOI badge) will be
added to this section and to `CITATION.cff`.

The backend is [fair-publishing](https://github.com/shashankmc/fair-publishing);
cite both if you use both.

## License

MIT, see [LICENSE](LICENSE).
