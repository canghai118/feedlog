<script setup lang="ts">
import draggable from 'vuedraggable'
import { toast } from 'vue-sonner'
import type { HelpCollectionFormValue } from '~/components/help/HelpCollectionDialog.vue'
import type { HelpArticleStatus, HelpCollectionIcon } from '#layers/feedlog/shared/constants/help'

definePageMeta({ layout: 'dashboard', middleware: 'admin' })

interface InlineArticle {
  id: string
  title: string
  status: HelpArticleStatus
  position: number
  updatedAt: string
}

interface AdminCollection {
  id: string
  name: string
  description: string | null
  icon: HelpCollectionIcon
  visible: boolean
  position: number
  articleCount: number
  articles: InlineArticle[]
}

interface FlatArticle {
  id: string
  shortId: string
  slug: string
  title: string
  status: HelpArticleStatus
  position: number
  updatedAt: string
  collection: { id: string; name: string; visible: boolean }
}

const PAGE_SIZE = 10

const { t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()

const view = ref<'collections' | 'articles'>('collections')
const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)
const expanded = ref(new Set<string>())
const selected = ref(new Set<string>())
const dialogOpen = ref(false)
const editing = ref<HelpCollectionFormValue | null>(null)

let searchTimer: ReturnType<typeof setTimeout>
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
    page.value = 1
    selected.value = new Set()
  }, 300)
})

watch(view, () => {
  page.value = 1
  selected.value = new Set()
})

const flat = computed(() => view.value === 'articles' || !!debouncedSearch.value)

const { data: stats, refresh: refreshStats } = await useFetch<{ collectionCount: number; articleCount: number }>('/api/admin/help/stats')

const { data: collectionsData, refresh: refreshCollections } = await useFetch<{
  data: AdminCollection[]
  pagination: { total: number }
}>('/api/admin/help/collections', {
  query: computed(() => ({ page: page.value, pageSize: PAGE_SIZE })),
  immediate: true,
})

const { data: articlesData, refresh: refreshArticles } = await useFetch<{
  data: FlatArticle[]
  pagination: { total: number }
}>('/api/admin/help/articles', {
  query: computed(() => ({ page: page.value, pageSize: PAGE_SIZE, q: debouncedSearch.value || undefined })),
})

const collections = computed(() => collectionsData.value?.data ?? [])
const articles = computed(() => articlesData.value?.data ?? [])

const total = computed(() => (flat.value ? articlesData.value?.pagination.total : collectionsData.value?.pagination.total) ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const isEmpty = computed(() => (stats.value?.collectionCount ?? 0) === 0 && (stats.value?.articleCount ?? 0) === 0)
const hasCollections = computed(() => (stats.value?.collectionCount ?? 0) > 0)

const draggableCollections = computed({
  get: () => collections.value,
  set: (value) => { if (collectionsData.value) collectionsData.value.data = value },
})

async function refreshAll() {
  await Promise.all([refreshStats(), refreshCollections(), refreshArticles()])
}

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function toggleSelected(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function collectionSelection(collection: AdminCollection): 'none' | 'some' | 'all' {
  const ids = collection.articles.map(a => a.id)
  if (!ids.length) return 'none'
  const hit = ids.filter(id => selected.value.has(id)).length
  return hit === 0 ? 'none' : hit === ids.length ? 'all' : 'some'
}

function toggleCollectionSelection(collection: AdminCollection) {
  const next = new Set(selected.value)
  const state = collectionSelection(collection)
  for (const article of collection.articles) {
    if (state === 'all') next.delete(article.id)
    else next.add(article.id)
  }
  selected.value = next
  if (state !== 'all' && !expanded.value.has(collection.id)) toggleExpanded(collection.id)
}

function openCreate() {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(collection: AdminCollection) {
  editing.value = {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    icon: collection.icon,
    visible: collection.visible,
  }
  dialogOpen.value = true
}

async function createArticle() {
  const collectionId = collections.value[0]?.id
  if (!collectionId) return
  const created = await $fetch<{ id: string }>('/api/admin/help/articles', {
    method: 'POST',
    body: { collectionId, title: t('help.admin.newArticle'), content: '' },
  })
  await router.push(localePath(`/dashboard/help/${created.id}`))
}

async function onCollectionsDragEnd() {
  await $fetch('/api/admin/help/collections/reorder', {
    method: 'PATCH',
    body: { ids: collections.value.map(c => c.id) },
  })
}

async function onArticlesDragEnd(collection: AdminCollection) {
  await $fetch('/api/admin/help/articles/reorder', {
    method: 'PATCH',
    body: { collectionId: collection.id, ids: collection.articles.map(a => a.id) },
  })
}

async function runBulk(action: 'publish' | 'unpublish') {
  const ids = [...selected.value]
  if (!ids.length) return
  const result = await $fetch<{ affected: number }>(`/api/admin/help/articles/bulk-${action}`, {
    method: 'POST',
    body: { ids },
  })
  selected.value = new Set()
  await refreshAll()
  toast.success(t(`help.admin.${action}Result`, { n: result.affected }))
}

function statusClass(status: HelpArticleStatus) {
  if (status === 'published') return 'border-success/40 text-success'
  if (status === 'archived') return 'border-amber-700/40 text-amber-700'
  return 'border-border text-muted-foreground'
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div class="flex items-center gap-4">
        <h2 class="font-heading text-lg font-bold">{{ $t('help.admin.title') }}</h2>
        <div class="h-4 w-px bg-border" />
        <span class="text-xs font-medium text-muted-foreground">
          {{ isEmpty
            ? $t('help.admin.statsEmpty')
            : $t('help.admin.stats', { collections: stats?.collectionCount ?? 0, articles: stats?.articleCount ?? 0 }) }}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Icon name="lucide:plus" size="16" />
            {{ $t('help.admin.new') }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-64">
          <DropdownMenuItem class="flex-col !items-start gap-0.5 py-2" @select="openCreate">
            <span class="text-sm font-bold">{{ $t('help.admin.newCollection') }}</span>
            <span class="text-xs text-muted-foreground">{{ $t('help.admin.newCollectionHint') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="flex-col !items-start gap-0.5 py-2"
            :disabled="!hasCollections"
            @select="createArticle"
          >
            <span class="text-sm font-bold">{{ $t('help.admin.newArticle') }}</span>
            <span class="text-xs text-muted-foreground">
              {{ hasCollections ? $t('help.admin.newArticleHint') : $t('help.admin.newArticleDisabledHint') }}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div v-if="!isEmpty" class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
      <template v-if="selected.size">
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold">{{ $t('help.admin.selected', { n: selected.size }) }}</span>
          <button type="button" class="text-xs font-medium text-muted-foreground hover:text-foreground" @click="selected = new Set()">
            {{ $t('help.admin.clear') }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-bold hover:bg-secondary"
            @click="runBulk('unpublish')"
          >
            {{ $t('help.admin.unpublish') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            @click="runBulk('publish')"
          >
            {{ $t('help.admin.publish') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="inline-flex rounded-md border border-border p-0.5">
          <button
            v-for="option in (['collections', 'articles'] as const)"
            :key="option"
            type="button"
            class="h-7 rounded px-3 text-xs font-bold transition-colors"
            :class="view === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="view = option"
          >
            {{ option === 'collections' ? $t('help.admin.viewCollections') : $t('help.admin.viewArticles') }}
          </button>
        </div>
        <div class="relative w-full sm:w-64">
          <Icon name="lucide:search" size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="search"
            type="text"
            class="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            :placeholder="$t('help.admin.searchPlaceholder')"
          >
        </div>
      </template>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <div v-if="isEmpty" class="flex flex-col items-center justify-center py-24 text-center">
        <Icon name="lucide:book-open" size="40" class="text-muted-foreground/40" />
        <p class="mt-4 text-sm font-medium text-muted-foreground">{{ $t('help.admin.emptyTitle') }}</p>
        <button
          type="button"
          class="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          @click="openCreate"
        >
          <Icon name="lucide:plus" size="16" />
          {{ $t('help.admin.newCollection') }}
        </button>
      </div>

      <template v-else-if="flat">
        <NuxtLink
          v-for="article in articles"
          :key="article.id"
          :to="localePath(`/dashboard/help/${article.id}`)"
          class="group mb-1.5 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
          :class="selected.has(article.id) && 'bg-primary/5'"
        >
          <button
            type="button"
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity"
            :class="selected.has(article.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border opacity-0 group-hover:opacity-100'"
            @click.prevent.stop="toggleSelected(article.id)"
          >
            <Icon v-if="selected.has(article.id)" name="lucide:check" size="12" />
          </button>
          <span class="w-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ article.title }}</span>
          <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
            <Icon v-if="!article.collection.visible" name="lucide:eye-off" size="11" />
            {{ article.collection.name }}
          </span>
          <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold" :class="statusClass(article.status)">
            {{ $t(`help.admin.status.${article.status}`) }}
          </span>
          <span class="w-28 shrink-0 text-right text-xs text-muted-foreground">{{ formatDate(article.updatedAt) }}</span>
        </NuxtLink>
      </template>

      <ClientOnly v-else>
        <draggable
          v-model="draggableCollections"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-50"
          @start="expanded = new Set()"
          @end="onCollectionsDragEnd"
        >
          <template #item="{ element: collection }">
            <div class="mb-1.5">
              <div
                class="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
                @click="toggleExpanded(collection.id)"
              >
                <button
                  type="button"
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity"
                  :class="collectionSelection(collection) !== 'none'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border opacity-0 group-hover:opacity-100'"
                  @click.stop="toggleCollectionSelection(collection)"
                >
                  <Icon v-if="collectionSelection(collection) === 'all'" name="lucide:check" size="12" />
                  <Icon v-else-if="collectionSelection(collection) === 'some'" name="lucide:minus" size="12" />
                </button>
                <div class="drag-handle w-5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100" @click.stop>
                  <Icon name="lucide:grip-vertical" size="16" />
                </div>
                <Icon
                  name="lucide:chevron-right"
                  size="16"
                  class="shrink-0 text-muted-foreground transition-transform"
                  :class="expanded.has(collection.id) && 'rotate-90'"
                />
                <Icon :name="`lucide:${collection.icon}`" size="16" class="shrink-0 text-muted-foreground" />
                <span class="shrink-0 text-sm font-bold">{{ collection.name }}</span>
                <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ collection.description }}</span>
                <span v-if="!collection.visible" class="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {{ $t('help.admin.hidden') }}
                </span>
                <span class="shrink-0 text-xs text-muted-foreground">{{ $t('help.admin.articleCount', { n: collection.articleCount }) }}</span>
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  @click.stop="openEdit(collection)"
                >
                  <Icon name="lucide:ellipsis" size="16" />
                </button>
              </div>

              <draggable
                v-if="expanded.has(collection.id)"
                v-model="collection.articles"
                item-key="id"
                handle=".drag-handle"
                ghost-class="opacity-50"
                class="mt-1.5"
                @end="onArticlesDragEnd(collection)"
              >
                <template #item="{ element: article }">
                  <NuxtLink
                    :to="localePath(`/dashboard/help/${article.id}`)"
                    class="group mb-1.5 ml-9 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:border-primary/40"
                    :class="selected.has(article.id) && 'bg-primary/5'"
                  >
                    <button
                      type="button"
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity"
                      :class="selected.has(article.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border opacity-0 group-hover:opacity-100'"
                      @click.prevent.stop="toggleSelected(article.id)"
                    >
                      <Icon v-if="selected.has(article.id)" name="lucide:check" size="12" />
                    </button>
                    <div class="drag-handle w-5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100" @click.prevent.stop>
                      <Icon name="lucide:grip-vertical" size="16" />
                    </div>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ article.title }}</span>
                    <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold" :class="statusClass(article.status)">
                      {{ $t(`help.admin.status.${article.status}`) }}
                    </span>
                    <span class="w-28 shrink-0 text-right text-xs text-muted-foreground">{{ formatDate(article.updatedAt) }}</span>
                  </NuxtLink>
                </template>
              </draggable>
            </div>
          </template>
        </draggable>
      </ClientOnly>

      <div v-if="!isEmpty && pageCount > 1" class="mt-4 flex items-center justify-center gap-1">
        <button
          v-for="n in pageCount"
          :key="n"
          type="button"
          class="h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors"
          :class="n === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'"
          @click="page = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <HelpCollectionDialog v-model:open="dialogOpen" :collection="editing" @saved="refreshAll" @deleted="refreshAll" />
  </div>
</template>
