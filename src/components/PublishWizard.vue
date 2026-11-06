<template>
  <section class="vfp vfp-card vfp-wizard" :aria-labelledby="headingId">
    <h3 :id="headingId" class="vfp-heading">{{ current ? `Publish the ${KIND_LABEL[current.kind]}` : 'Publish a Dataset or Model' }}</h3>

    <p v-if="loading" class="vfp-muted" role="status">Loading…</p>
    <LoadError v-else-if="error" :message="error" @retry="reload" />
    <PublishingOff v-else-if="disabled" />

    <template v-else-if="config">
      <!-- Choose what to publish ------------------------------------------------ -->
      <template v-if="!current">
        <p v-if="notFound" class="vfp-alert vfp-alert-error" role="alert">
          This {{ KIND_LABEL[notFound.kind] ?? 'item' }} could not be found among the things you can publish. Check that it is yours, or pick another one.
        </p>
        <p v-if="!artefacts.length" class="vfp-muted">You have no Datasets or Models to publish yet.</p>
        <form v-else class="vfp-form" @submit.prevent="pick">
          <div class="vfp-field">
            <label :for="id('pick')">What do you want to publish?</label>
            <select :id="id('pick')" v-model="pickValue" class="vfp-input">
              <option value="" disabled>Choose a Dataset or Model</option>
              <option v-for="a in artefacts" :key="`${a.kind}:${a.id}`" :value="`${a.kind}:${a.id}`">
                {{ KIND_LABEL[a.kind] }}: {{ a.title }}{{ a.publication ? ' (already published)' : '' }}
              </option>
            </select>
          </div>
          <button type="submit" class="vfp-btn vfp-btn-primary" :disabled="!pickValue">Continue</button>
        </form>
      </template>

      <!-- Already published ------------------------------------------------------ -->
      <div v-else-if="current.publication" class="vfp-notice" role="status">
        <p><strong>This {{ KIND_LABEL[current.kind] }} is already published.</strong></p>
        <p>
          DOI <a :href="doiUrl(current.publication.doi)" target="_blank" rel="noopener noreferrer">{{ current.publication.doi }}</a>
          · <a :href="current.publication.record_url" target="_blank" rel="noopener noreferrer">View the record</a>
        </p>
      </div>

      <!-- A Model whose training Dataset has no DOI ----------------------------- -->
      <div v-else-if="blockedByDataset" class="vfp-alert vfp-alert-warning" role="status">
        <p><strong>Publish the training Dataset first.</strong></p>
        <p>
          This Model was trained on the Dataset “{{ blockedByDataset.title }}”, which has no DOI yet. A published Model must point to
          the Dataset it learned from, so publish that Dataset first (at any access level), then come back to this Model.
        </p>
        <button type="button" class="vfp-btn vfp-btn-primary" @click="switchTo(blockedByDataset)">Publish the Dataset first</button>
      </div>

      <!-- Published -------------------------------------------------------------- -->
      <div v-else-if="published" class="vfp-alert vfp-alert-success" role="status">
        <p><strong>Published.</strong> Your {{ KIND_LABEL[current.kind] }} now has a permanent DOI.</p>
        <p>
          DOI <a :href="doiUrl(published.doi)" target="_blank" rel="noopener noreferrer">{{ published.doi }}</a>
        </p>
        <p><a :href="published.record_url" target="_blank" rel="noopener noreferrer">View the record on {{ config.repository.name }}</a></p>
      </div>

      <!-- Details ---------------------------------------------------------------- -->
      <form v-else-if="stage === 'details'" class="vfp-step" novalidate @submit.prevent="toPreview">
        <ol class="vfp-steps">
          <li aria-current="step">1. Describe it</li>
          <li>2. Check and publish</li>
        </ol>

        <p v-if="current.kind === 'model' && current.training_dataset?.doi" class="vfp-muted">
          Trained on the Dataset “{{ current.training_dataset.title }}”, DOI
          <a :href="doiUrl(current.training_dataset.doi)" target="_blank" rel="noopener noreferrer">{{ current.training_dataset.doi }}</a>.
          The record will link to it.
        </p>

        <fieldset class="vfp-fieldset">
          <legend>About the {{ KIND_LABEL[current.kind] }}</legend>
          <div v-for="f in textFields" :key="f.key" class="vfp-field">
            <label :for="id(f.key)">{{ f.label }}<span v-if="isRequired(f.key)" class="vfp-required"> (required)</span></label>
            <textarea
              v-if="f.key === 'description'"
              :id="id(f.key)"
              v-model="form[f.key]"
              class="vfp-input"
              :aria-required="isRequired(f.key) ? 'true' : undefined"
              :aria-invalid="invalid.has(f.key) ? 'true' : undefined"
              :aria-describedby="f.hint ? id(`${f.key}-hint`) : undefined"
            />
            <select
              v-else-if="f.key === 'license'"
              :id="id(f.key)"
              v-model="form.license"
              class="vfp-input"
              :aria-required="isRequired(f.key) ? 'true' : undefined"
              :aria-invalid="invalid.has(f.key) ? 'true' : undefined"
              :aria-describedby="f.hint ? id(`${f.key}-hint`) : undefined"
            >
              <option value="">Choose a license</option>
              <option v-for="l in config.licenses" :key="l.id" :value="l.id">{{ l.title }}</option>
            </select>
            <input
              v-else
              :id="id(f.key)"
              v-model="form[f.key]"
              type="text"
              class="vfp-input"
              :aria-required="isRequired(f.key) ? 'true' : undefined"
              :aria-invalid="invalid.has(f.key) ? 'true' : undefined"
              :aria-describedby="f.hint ? id(`${f.key}-hint`) : undefined"
            />
            <p v-if="f.hint" :id="id(`${f.key}-hint`)" class="vfp-muted">{{ f.hint }}</p>
          </div>
        </fieldset>

        <fieldset class="vfp-fieldset" :class="{ 'vfp-invalid': invalid.has('creators') }">
          <legend>Creators<span v-if="isRequired('creators')" class="vfp-required"> (required)</span></legend>
          <p class="vfp-muted">The people who made it, as they should be cited. Write names as “Family, Given”.</p>
          <div v-for="(c, i) in creators" :key="c.key" class="vfp-creator">
            <div class="vfp-field">
              <label :for="id(`creator-${c.key}-name`)">Name</label>
              <input
                :id="id(`creator-${c.key}-name`)"
                v-model="c.name"
                type="text"
                class="vfp-input"
                placeholder="Family, Given"
                :aria-invalid="invalid.has('creators') && i === 0 ? 'true' : undefined"
              />
            </div>
            <div class="vfp-field">
              <label :for="id(`creator-${c.key}-affiliation`)">Affiliation</label>
              <input :id="id(`creator-${c.key}-affiliation`)" v-model="c.affiliation" type="text" class="vfp-input" />
            </div>
            <div class="vfp-field">
              <label :for="id(`creator-${c.key}-orcid`)">ORCID</label>
              <input :id="id(`creator-${c.key}-orcid`)" v-model="c.orcid" type="text" class="vfp-input" placeholder="0000-0000-0000-0000" />
            </div>
            <button v-if="creators.length > 1" type="button" class="vfp-btn vfp-btn-secondary" @click="creators.splice(i, 1)">
              Remove<span class="vfp-sr-only"> creator {{ i + 1 }}</span>
            </button>
          </div>
          <button type="button" class="vfp-btn vfp-btn-secondary" @click="addCreator()">Add a creator</button>
        </fieldset>

        <fieldset class="vfp-fieldset">
          <legend>Who can get the files?</legend>
          <label v-for="level in config.access_levels" :key="level" class="vfp-choice">
            <input v-model="access" type="radio" :name="id('access')" :value="level" />
            <span>
              {{ ACCESS_LABEL[level] }}
              <span class="vfp-choice-hint">{{ ACCESS_HINT[level] }}</span>
            </span>
          </label>
          <div v-if="access === 'restricted'" class="vfp-field">
            <label :for="id('access_conditions')">Access conditions<span class="vfp-required"> (required)</span></label>
            <textarea
              :id="id('access_conditions')"
              v-model="accessConditions"
              class="vfp-input"
              aria-required="true"
              :aria-invalid="invalid.has('access_conditions') ? 'true' : undefined"
              placeholder="For example: for non-commercial research only; describe your project when you ask."
            />
            <p class="vfp-muted">Shown to everyone who asks for the files. Say who may have them and for what.</p>
          </div>
        </fieldset>

        <fieldset class="vfp-fieldset" :class="{ 'vfp-invalid': invalid.has('card') || invalid.has('card_approved') }">
          <legend>The {{ KIND_LABEL[current.kind] }} card</legend>
          <p class="vfp-muted">
            A short document that tells others what this {{ KIND_LABEL[current.kind] }} is, how it was made and what it should not be used for.
            It is published as {{ current.kind === 'model' ? 'MODEL_CARD.md' : 'DATASET_CARD.md' }}.
          </p>
          <button type="button" class="vfp-btn vfp-btn-secondary" :disabled="drafting" @click="draft">
            {{ drafting ? 'Drafting…' : cardText ? 'Draft the card again' : 'Draft the card' }}
          </button>
          <p v-if="draftError" class="vfp-alert vfp-alert-error" role="alert">{{ draftError }}</p>
          <p v-if="cardSource === 'llm'" class="vfp-alert vfp-alert-warning">
            An AI language model wrote this draft. It can be wrong or invent details. Read it all and correct it before you approve it.
          </p>
          <p v-else-if="cardSource === 'template'" class="vfp-muted">This draft comes from a template. Fill in the parts it leaves open.</p>
          <div class="vfp-field">
            <label :for="id('card')">Card text</label>
            <textarea
              :id="id('card')"
              v-model="cardText"
              class="vfp-input vfp-card-text"
              :aria-invalid="invalid.has('card') ? 'true' : undefined"
            />
          </div>
          <label class="vfp-choice">
            <input v-model="cardApproved" type="checkbox" :aria-invalid="invalid.has('card_approved') ? 'true' : undefined" />
            <span>I have read this card and approve it for publication.</span>
          </label>
        </fieldset>

        <RefusalAlert v-if="refusal" :refusal="refusal" />
        <button type="submit" class="vfp-btn vfp-btn-primary" :disabled="previewing">
          {{ previewing ? 'Preparing the preview…' : 'Preview the deposit' }}
        </button>
      </form>

      <!-- Preview, attestation and publish ---------------------------------------- -->
      <div v-else class="vfp-step">
        <ol class="vfp-steps">
          <li>1. Describe it</li>
          <li aria-current="step">2. Check and publish</li>
        </ol>
        <RefusalAlert v-if="refusal" :refusal="refusal" />
        <button type="button" class="vfp-btn vfp-btn-secondary" @click="backToDetails">Back to the details</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { errorMessage, useAdapter, useConfig } from '../context'
import { ACCESS_HINT, ACCESS_LABEL, KIND_LABEL, doiUrl } from '../labels'
import type {
  AccessLevel,
  Artefact,
  ArtefactKind,
  ArtefactRef,
  MetadataField,
  Preview,
  Publication,
  PublishingAdapter,
  PublishingConfig,
  PublishingError,
  PublishRequest,
} from '../types'
import LoadError from './LoadError.vue'
import PublishingOff from './PublishingOff.vue'
import RefusalAlert from './RefusalAlert.vue'

const props = defineProps<{
  adapter?: PublishingAdapter
  /** The host config, if the parent already has it; otherwise it is fetched. */
  config?: PublishingConfig
  /** With `id`: the artefact to publish. Without them the user picks one. */
  kind?: ArtefactKind
  id?: string
}>()

const emit = defineEmits<{
  /** The deposit succeeded. */
  published: [publication: Publication]
  /** The user asked to open another artefact (the training Dataset of a Model). */
  'switch-artefact': [ref: ArtefactRef]
}>()

const adapter = useAdapter(props.adapter)
const uid = Math.random().toString(36).slice(2, 8)
const headingId = `vfp-wizard-${uid}`
const id = (name: string) => `vfp-wizard-${uid}-${name}`

type TextKey = Exclude<MetadataField, 'creators'> | 'ecli'
const textFields: { key: TextKey; label: string; hint?: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'keywords', label: 'Keywords', hint: 'Separate them with commas.' },
  { key: 'license', label: 'License', hint: 'The terms under which others may reuse it.' },
  { key: 'language', label: 'Language', hint: 'The language of the documents, e.g. nl or en.' },
  { key: 'jurisdiction', label: 'Jurisdiction', hint: 'e.g. NL or EU.' },
  { key: 'document_type', label: 'Document type', hint: 'e.g. judgment, contract or statute.' },
  { key: 'ecli', label: 'ECLI', hint: 'Only if it is about one decision.' },
  { key: 'version', label: 'Version', hint: 'e.g. 1.0.' },
]
const FIELD_LABEL: Record<string, string> = {
  ...Object.fromEntries(textFields.map((f) => [f.key, f.label])),
  creators: 'Creators',
  access_conditions: 'Access conditions',
  card: 'Card text',
  card_approved: 'Card approval',
}

const artefacts = ref<Artefact[]>([])
const current = ref<Artefact | null>(null)
const notFound = ref<ArtefactRef | null>(null)
const pickValue = ref('')
const disabledByBackend = ref(false)

const form = reactive<Record<TextKey, string>>({
  title: '',
  description: '',
  keywords: '',
  license: '',
  language: '',
  jurisdiction: '',
  document_type: '',
  ecli: '',
  version: '',
})
let creatorKey = 0
const creators = ref<{ key: number; name: string; affiliation: string; orcid: string }[]>([])
const access = ref<AccessLevel>('open')
const accessConditions = ref('')
const cardText = ref('')
const cardSource = ref<'llm' | 'template' | null>(null)
const cardApproved = ref(false)
const drafting = ref(false)
const draftError = ref('')

const stage = ref<'details' | 'preview'>('details')
const invalid = reactive(new Set<string>())
const refusal = ref<PublishingError | null>(null)
const previewing = ref(false)
const previewData = ref<Preview | null>(null)
const published = ref<Publication | null>(null)

const { config, loading, error, reload } = useConfig(adapter, () => props.config, async () => {
  artefacts.value = await adapter.listArtefacts()
  openRef(props.kind, props.id)
})

const disabled = computed(() => disabledByBackend.value || (config.value !== null && !config.value.enabled))

const blockedByDataset = computed(() => {
  const a = current.value
  return a && a.kind === 'model' && a.training_dataset && !a.training_dataset.doi ? a.training_dataset : null
})

function isRequired(key: string) {
  return (config.value?.required_fields as string[] | undefined)?.includes(key) ?? false
}

function addCreator(name = '') {
  creators.value.push({ key: creatorKey++, name, affiliation: '', orcid: '' })
}

function openRef(kind: ArtefactKind | undefined, artefactId: string | undefined) {
  notFound.value = null
  if (!kind || !artefactId) {
    current.value = null
    return
  }
  const found = artefacts.value.find((a) => a.kind === kind && a.id === artefactId)
  if (found) open(found)
  else {
    current.value = null
    notFound.value = { kind, id: artefactId }
  }
}

function open(a: Artefact) {
  current.value = a
  form.title = a.title ?? ''
  form.description = a.description ?? ''
  form.keywords = ''
  form.license = ''
  form.language = a.legal?.language ?? ''
  form.jurisdiction = a.legal?.jurisdiction ?? ''
  form.document_type = a.legal?.document_type ?? ''
  form.ecli = a.legal?.ecli ?? ''
  form.version = ''
  creators.value = []
  addCreator()
  const levels = config.value?.access_levels ?? []
  access.value = levels.includes('open') ? 'open' : (levels[0] ?? 'open')
  accessConditions.value = ''
  cardText.value = ''
  cardSource.value = null
  cardApproved.value = false
  draftError.value = ''
  stage.value = 'details'
  invalid.clear()
  refusal.value = null
  previewData.value = null
  published.value = null
}

watch(
  () => [props.kind, props.id] as const,
  ([kind, artefactId]) => {
    if (config.value?.enabled && !loading.value) openRef(kind, artefactId)
  },
)

function pick() {
  const [kind, ...rest] = pickValue.value.split(':')
  openRef(kind as ArtefactKind, rest.join(':'))
}

function switchTo(dataset: { id: string }) {
  const ref: ArtefactRef = { kind: 'dataset', id: dataset.id }
  emit('switch-artefact', ref)
  openRef(ref.kind, ref.id)
}

async function draft() {
  if (!current.value) return
  drafting.value = true
  draftError.value = ''
  try {
    const result = await adapter.draftCard({ kind: current.value.kind, id: current.value.id })
    cardText.value = result.card
    cardSource.value = result.source
    cardApproved.value = false
  } catch (e) {
    draftError.value = `${errorMessage(e)} You can also write the card yourself.`
  } finally {
    drafting.value = false
  }
}

function namedCreators() {
  return creators.value
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      ...(c.affiliation.trim() ? { affiliation: c.affiliation.trim() } : {}),
      ...(c.orcid.trim() ? { orcid: c.orcid.trim() } : {}),
    }))
}

function buildRequest(): PublishRequest {
  const a = current.value!
  const metadata: PublishRequest['metadata'] = {}
  for (const f of textFields) {
    if (f.key === 'keywords') continue
    const value = form[f.key].trim()
    if (value) metadata[f.key] = value
  }
  const keywords = form.keywords
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
  if (keywords.length) metadata.keywords = keywords
  const named = namedCreators()
  if (named.length) metadata.creators = named
  return {
    kind: a.kind,
    id: a.id,
    metadata,
    access: access.value,
    ...(access.value === 'restricted' ? { access_conditions: accessConditions.value.trim() } : {}),
    card: { text: cardText.value, approved: cardApproved.value },
    attestation: { license: false, rights: false, personal_data: false },
  }
}

function localProblems(): string[] {
  const missing: string[] = []
  for (const key of config.value?.required_fields ?? []) {
    if (key === 'creators') {
      if (!namedCreators().length) missing.push('creators')
    } else if (!form[key as TextKey]?.trim()) missing.push(key)
  }
  if (access.value === 'restricted' && !accessConditions.value.trim()) missing.push('access_conditions')
  if (!cardText.value.trim()) missing.push('card')
  else if (!cardApproved.value) missing.push('card_approved')
  return missing
}

function markInvalid(keys: string[]) {
  invalid.clear()
  keys.forEach((k) => invalid.add(k))
}

function listOf(keys: string[]) {
  return keys.map((k) => FIELD_LABEL[k] ?? k).join(', ')
}

async function toPreview() {
  refusal.value = null
  const missing = localProblems()
  markInvalid(missing)
  if (missing.length) {
    refusal.value = Object.assign(new Error(`Fill in the highlighted parts first: ${listOf(missing)}.`), { code: 'local_missing' }) as PublishingError
    return
  }
  previewing.value = true
  try {
    previewData.value = await adapter.preview(buildRequest())
    stage.value = 'preview'
  } catch (e) {
    handleRefusal(e)
  } finally {
    previewing.value = false
  }
}

function backToDetails() {
  stage.value = 'details'
  previewData.value = null
  refusal.value = null
}

function handleRefusal(e: unknown) {
  const err = (e instanceof Error ? e : new Error(errorMessage(e))) as PublishingError
  switch (err.code) {
    case 'publishing_disabled':
      disabledByBackend.value = true
      return
    case 'missing_fields':
      markInvalid(err.missing ?? [])
      stage.value = 'details'
      break
    case 'invalid_license':
      markInvalid(['license'])
      stage.value = 'details'
      break
    case 'access_conditions_required':
    case 'invalid_access':
      markInvalid(['access_conditions'])
      stage.value = 'details'
      break
    case 'card_not_approved':
      markInvalid(['card_approved'])
      stage.value = 'details'
      break
  }
  refusal.value = err
}
</script>
