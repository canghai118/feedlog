import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { helpArticle, helpCollection } from '../db/schemas'
import { getOrgInfo } from '../utils/org-cache'
import { DEFAULT_ORG_SLUG } from '../../shared/constants/default-org'
import { resolvePortalModules } from '../../shared/utils/portal-modules'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('sitemap:input', async (ctx) => {
    const event = ctx.event
    if (!event) return

    const info = await getOrgInfo(event.context.orgSlug ?? DEFAULT_ORG_SLUG)
    const orgId = event.context.orgId ?? info?.id
    if (!orgId || !resolvePortalModules(info?.metadata).helpCenter) return

    const rows = await db
      .select({ shortId: helpArticle.shortId, slug: helpArticle.slug, updatedAt: helpArticle.updatedAt })
      .from(helpArticle)
      .innerJoin(helpCollection, eq(helpArticle.collectionId, helpCollection.id))
      .where(and(
        eq(helpArticle.orgId, orgId),
        eq(helpArticle.status, 'published'),
        eq(helpCollection.visible, true),
      ))
      .orderBy(asc(helpCollection.position), asc(helpArticle.position), asc(helpArticle.id))

    for (const row of rows) {
      ctx.urls.push({ loc: `/help/${row.shortId}-${row.slug}`, lastmod: row.updatedAt, _i18nTransform: true })
    }
  })
})
