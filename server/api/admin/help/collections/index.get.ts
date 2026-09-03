import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { helpArticle, helpCollection } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgMember(event)

  const query = getQuery(event)
  const db = useDB()

  const fields = {
    id: helpCollection.id,
    name: helpCollection.name,
    description: helpCollection.description,
    icon: helpCollection.icon,
    visible: helpCollection.visible,
    position: helpCollection.position,
  }

  if (query.flat === '1') {
    const rows = await db
      .select(fields)
      .from(helpCollection)
      .where(eq(helpCollection.orgId, orgId))
      .orderBy(asc(helpCollection.position), asc(helpCollection.id))

    return { data: rows, pagination: { page: 1, pageSize: rows.length, total: rows.length } }
  }

  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Number(query.pageSize) || 10, 100)

  const [countResult] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(helpCollection)
    .where(eq(helpCollection.orgId, orgId))

  const collections = await db
    .select(fields)
    .from(helpCollection)
    .where(eq(helpCollection.orgId, orgId))
    .orderBy(asc(helpCollection.position), asc(helpCollection.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const articles = collections.length
    ? await db
        .select({
          id: helpArticle.id,
          collectionId: helpArticle.collectionId,
          title: helpArticle.title,
          status: helpArticle.status,
          position: helpArticle.position,
          updatedAt: helpArticle.updatedAt,
        })
        .from(helpArticle)
        .where(and(eq(helpArticle.orgId, orgId), inArray(helpArticle.collectionId, collections.map(c => c.id))))
        .orderBy(asc(helpArticle.position), asc(helpArticle.id))
    : []

  return {
    data: collections.map((c) => {
      const own = articles.filter(a => a.collectionId === c.id)
      return {
        ...c,
        articleCount: own.length,
        articles: own.map(({ collectionId: _collectionId, ...a }) => a),
      }
    }),
    pagination: { page, pageSize, total: countResult?.total ?? 0 },
  }
})
