export const HELP_COLLECTION_ICONS = [
  'rocket',
  'layout-grid',
  'circle-question-mark',
  'book-open',
  'settings-2',
  'users',
  'layers',
  'file-text',
] as const

export type HelpCollectionIcon = typeof HELP_COLLECTION_ICONS[number]

export const HELP_COLLECTION_ICON_DEFAULT: HelpCollectionIcon = 'rocket'

export const HELP_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const

export type HelpArticleStatus = typeof HELP_ARTICLE_STATUSES[number]

export const HELP_SHORT_ID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz'
export const HELP_SHORT_ID_LENGTH = 6
