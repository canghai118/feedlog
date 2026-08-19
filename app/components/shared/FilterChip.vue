<script setup lang="ts">
// Three-segment filter chip: field | operator | value(s) | ×
// The `single` kind has no operator segment.

export interface FilterChipOption {
  value: string
  label: string
  sub?: string
  color?: string
  image?: string | null
}

const props = withDefaults(defineProps<{
  label: string
  icon: string
  kind: 'enum' | 'date' | 'single'
  op: string
  values?: string[]
  from?: string
  to?: string
  options?: FilterChipOption[]
  searchable?: boolean
}>(), {
  values: () => [],
  options: () => [],
  from: undefined,
  to: undefined,
  searchable: false,
})

const emit = defineEmits<{
  'update:op': [op: string]
  'update:values': [values: string[]]
  'update:range': [range: { from?: string, to?: string }]
  'remove': []
}>()

const { t } = useI18n()

const OPS: Record<string, string[]> = {
  enum: ['is', 'not'],
  date: ['after', 'before', 'range'],
  single: [],
}

const opLabel = (op: string) => t(`dashboard.filter.op.${op}`)

const valueLabel = computed(() => {
  if (props.kind === 'date') {
    if (props.op === 'range') return `${props.from || '…'} – ${props.to || '…'}`
    return props.from || props.to || t('dashboard.filter.pickDate')
  }
  if (!props.values.length) return t('dashboard.filter.pickValue')
  const first = props.options.find(o => o.value === props.values[0])
  return first?.label ?? props.values[0]!
})

const extraCount = computed(() => (props.kind === 'date' ? 0 : Math.max(0, props.values.length - 1)))

const search = ref('')
const showSearch = computed(() => props.searchable || props.options.length > 8)
const visibleOptions = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return props.options
  return props.options.filter(o =>
    o.label.toLowerCase().includes(kw) || (o.sub || '').toLowerCase().includes(kw))
})

function toggleValue(value: string) {
  if (props.kind === 'single') {
    emit('update:values', [value])
    return
  }
  const next = props.values.includes(value)
    ? props.values.filter(v => v !== value)
    : [...props.values, value]
  emit('update:values', next)
}

function quickRange(days: number | 'quarter') {
  const now = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const start = days === 'quarter'
    ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
  emit('update:op', 'range')
  emit('update:range', { from: iso(start), to: iso(now) })
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="inline-flex shrink-0 items-center border border-border rounded-lg overflow-hidden h-7 bg-card">
    <span class="px-2.5 py-1 bg-background text-[10px] font-bold text-muted-foreground border-r border-border flex items-center gap-1.5 whitespace-nowrap">
      <Icon :name="icon" size="14" />
      {{ label }}
    </span>

    <DropdownMenu v-if="kind !== 'single'">
      <DropdownMenuTrigger as-child>
        <button
          class="px-2.5 py-1 text-[10px] font-bold border-r border-border hover:bg-background/50 transition-colors cursor-pointer whitespace-nowrap"
          :class="op === 'not' ? 'text-primary' : 'text-muted-foreground'"
        >
          {{ opLabel(op) }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="min-w-[120px]">
        <DropdownMenuItem
          v-for="o in OPS[kind]"
          :key="o"
          class="cursor-pointer text-xs"
          :class="o === op ? 'text-primary font-bold' : ''"
          @select="emit('update:op', o)"
        >
          <span class="w-4 shrink-0 flex items-center justify-center">
            <Icon v-if="o === op" name="lucide:check" size="12" />
          </span>
          {{ opLabel(o) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button class="px-2.5 py-1 text-primary text-[10px] font-bold flex items-center gap-1 hover:bg-background/50 transition-colors cursor-pointer whitespace-nowrap">
          {{ valueLabel }}
          <span v-if="extraCount" class="text-muted-foreground font-semibold">+{{ extraCount }}</span>
          <Icon name="lucide:chevron-down" size="10" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" class="min-w-[200px] max-w-[320px]">
        <template v-if="kind === 'date'">
          <div class="flex flex-wrap gap-1.5 p-1.5">
            <button
              v-for="[key, days] in ([['last7', 7], ['last30', 30], ['thisQuarter', 'quarter']] as const)"
              :key="key"
              class="text-[10px] font-bold px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              @click="quickRange(days)"
            >
              {{ $t(`dashboard.filter.${key}`) }}
            </button>
          </div>
          <div class="flex items-center gap-1.5 p-1.5 pt-0">
            <input
              v-if="op !== 'before'"
              type="date"
              :value="from || ''"
              class="flex-1 h-7 px-1.5 rounded-md border border-border bg-background text-[11px]"
              @input="emit('update:range', { from: ($event.target as HTMLInputElement).value || undefined, to })"
            >
            <span v-if="op === 'range'" class="text-[10px] text-muted-foreground">–</span>
            <input
              v-if="op !== 'after'"
              type="date"
              :value="to || ''"
              class="flex-1 h-7 px-1.5 rounded-md border border-border bg-background text-[11px]"
              @input="emit('update:range', { from, to: ($event.target as HTMLInputElement).value || undefined })"
            >
          </div>
        </template>

        <template v-else>
          <div v-if="showSearch" class="p-1.5 pb-1">
            <input
              v-model="search"
              class="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
              :placeholder="$t('dashboard.filter.searchPlaceholder')"
            >
          </div>
          <div class="max-h-[240px] overflow-y-auto">
            <DropdownMenuItem
              v-for="opt in visibleOptions"
              :key="opt.value"
              class="cursor-pointer text-xs gap-2"
              @select.prevent="toggleValue(opt.value)"
            >
              <span
                class="w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center"
                :class="values.includes(opt.value) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'"
              >
                <Icon v-if="values.includes(opt.value)" name="lucide:check" size="10" />
              </span>
              <span v-if="opt.color" class="w-2 h-2 rounded-full shrink-0" :style="{ background: opt.color }" />
              <Avatar v-else-if="opt.sub !== undefined" class="w-5 h-5 shrink-0">
                <img v-if="opt.image" :src="opt.image" :alt="opt.label" class="aspect-square size-full rounded-full object-cover" referrerpolicy="no-referrer">
                <AvatarFallback v-else class="bg-accent text-accent-foreground text-[8px] font-bold">
                  {{ initials(opt.label) }}
                </AvatarFallback>
              </Avatar>
              <span class="truncate">{{ opt.label }}</span>
              <span v-if="opt.sub" class="ml-auto pl-2 text-[10px] text-muted-foreground truncate">{{ opt.sub }}</span>
            </DropdownMenuItem>
            <p v-if="!visibleOptions.length" class="px-2 py-3 text-center text-[11px] text-muted-foreground">
              {{ $t('dashboard.filter.noMatches') }}
            </p>
          </div>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <button
      class="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors border-l border-border"
      @click="emit('remove')"
    >
      <Icon name="lucide:x" size="12" />
    </button>
  </div>
</template>
