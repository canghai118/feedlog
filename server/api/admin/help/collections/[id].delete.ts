import { and, eq } from 'drizzle-orm'
import { helpCollection } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })

  const id = getRouterParam(event, 'id')!
  const db = useDB()

  const [deleted] = await db
    .delete(helpCollection)
    .where(and(eq(helpCollection.id, id), eq(helpCollection.orgId, orgId)))
    .returning({ id: helpCollection.id })

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Collection not found' })
  }

  setResponseStatus(event, 204)
  return null
})
