<script setup lang="ts">
import type { HelpArticleStatus } from '#layers/feedlog/shared/constants/help'

const props = defineProps<{ status: HelpArticleStatus }>()

const TONES: Record<HelpArticleStatus, string> = {
  published: 'text-[var(--status-done)] bg-[var(--status-done-bg)] border-[var(--status-done-border)]',
  draft: 'text-[var(--status-open)] bg-[var(--status-open-bg)] border-[var(--status-open-border)]',
  archived: 'text-[#8D6E52] bg-[rgba(141,110,82,.10)] border-[rgba(141,110,82,.22)]',
}

const tone = computed(() => TONES[props.status] ?? TONES.draft)
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[10px] font-bold leading-[15px]" :class="tone">
    {{ $t(`help.admin.status.${status}`) }}
  </span>
</template>
