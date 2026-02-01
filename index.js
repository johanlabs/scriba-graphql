const express = require("express")
const { graphqlHTTP } = require("express-graphql")
const { GraphQLObjectType, GraphQLSchema, GraphQLID, GraphQLInt, GraphQLString, GraphQLFloat, GraphQLList, GraphQLInputObjectType } = require("graphql")
const { LRUCache } = require("lru-cache")

const schemaCache = new LRUCache({ max: 100 })

function mapScribaTypeToGraphQL(columnName, scribaType) {
  const typeStr = String(scribaType).toLowerCase()
  if (typeStr.includes("int")) return GraphQLInt
  if (typeStr.includes("float") || typeStr.includes("double") || typeStr.includes("decimal")) return GraphQLFloat
  if (columnName.toLowerCase() === "id" || typeStr.includes("id")) return GraphQLID
  return GraphQLString
}

function getFilterInputType(columnName, scribaType, prefix) {
  const baseType = mapScribaTypeToGraphQL(columnName, scribaType)
  const typeName = `${prefix}_${columnName}_Filter`
  
  const fields = {
    eq: { type: baseType },
    ne: { type: baseType },
    in: { type: new GraphQLList(baseType) },
    nin: { type: new GraphQLList(baseType) }
  }

  if (baseType === GraphQLInt || baseType === GraphQLFloat) {
    fields.gt = { type: baseType }
    fields.gte = { type: baseType }
    fields.lt = { type: baseType }
    fields.lte = { type: baseType }
  }

  if (baseType === GraphQLString || baseType === GraphQLID) {
    fields.contains = { type: GraphQLString }
    fields.startsWith = { type: GraphQLString }
    fields.endsWith = { type: GraphQLString }
  }

  return new GraphQLInputObjectType({
    name: typeName,
    fields
  })
}

function generateTenantGraphQLType(scribaInstance, tenantId, prefix) {
  const internalTenant = scribaInstance._tenants[tenantId]
  if (!internalTenant) return null

  const tables = internalTenant.tables
  const gqlTypes = {}

  for (const [name, table] of Object.entries(tables)) {
    const typeName = `${prefix}_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`
    
    gqlTypes[name] = new GraphQLObjectType({
      name: typeName,
      fields: () => {
        const fields = {}
        if (table._fields) {
          table._fields.forEach(f => {
            fields[f.name] = { type: mapScribaTypeToGraphQL(f.name, f.type) }
          })
        }

        if (table._relations) {
          for (const [relName, relConfig] of Object.entries(table._relations)) {
            const targetTableName = relConfig.table.toLowerCase()
            if (gqlTypes[targetTableName]) {
              fields[`${relName}s`] = {
                type: new GraphQLList(gqlTypes[targetTableName]),
                resolve: (parent) => parent[relName] || parent[`${relName}s`] || []
              }
            }
          }
        }
        return fields
      }
    })
  }

  const rootFields = {}
  for (const [name, table] of Object.entries(tables)) {
    const entityName = name.toLowerCase()
    const filterTypeName = `${prefix}_${name}_WhereInput`
    
    const whereFields = {}
    if (table._fields) {
      table._fields.forEach(f => {
        whereFields[f.name] = { type: getFilterInputType(f.name, f.type, filterTypeName) }
      })
    }

    const whereInput = new GraphQLInputObjectType({
      name: filterTypeName,
      fields: whereFields
    })

    rootFields[entityName] = {
      type: gqlTypes[name],
      args: { where: { type: whereInput } },
      resolve: (root, args) => {
        const results = table.query(args.where || {})
        return results[0] || null
      }
    }

    rootFields[`${entityName}s`] = {
      type: new GraphQLList(gqlTypes[name]),
      args: { 
        where: { type: whereInput },
        limit: { type: GraphQLInt }, 
        offset: { type: GraphQLInt } 
      },
      resolve: (root, args) => {
        const { limit, offset, where } = args
        const opts = {}
        if (limit) opts.limit = limit
        if (offset) opts.offset = offset
        return table.query(where || {}, opts)
      }
    }
  }

  return new GraphQLObjectType({
    name: prefix.replace(/[^a-zA-Z0-9_]/g, '_'),
    fields: rootFields
  })
}

function createMultiTenantGraphQL({ tenantResolver, scribaInstance }) {
  const router = express.Router()
  router.use((req, res) => {
    const tenantId = (tenantResolver ? tenantResolver(req) : null) || scribaInstance.tenants()[0]
    if (!tenantId) return res.status(404).json({ error: "Tenant not found" })

    if (!schemaCache.has(tenantId)) {
      const tenantType = generateTenantGraphQLType(scribaInstance, tenantId, `Tenant_${tenantId}`)
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: `Query_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          fields: { [tenantId.replace(/[^a-zA-Z0-9_]/g, '_')]: { type: tenantType, resolve: () => ({}) } }
        })
      })
      schemaCache.set(tenantId, schema)
    }
    return graphqlHTTP({ schema: schemaCache.get(tenantId), graphiql: true })(req, res)
  })
  return router
}

function createGlobalGraphQL({ scribaInstance }) {
  const router = express.Router()
  router.use((req, res) => {
    if (!schemaCache.has('global')) {
      const fields = {}
      for (const id of scribaInstance.tenants()) {
        const type = generateTenantGraphQLType(scribaInstance, id, `Tenant_${id}`)
        if (type) fields[id.replace(/[^a-zA-Z0-9_]/g, '_')] = { type, resolve: () => ({}) }
      }
      schemaCache.set('global', new GraphQLSchema({ query: new GraphQLObjectType({ name: 'Global', fields }) }))
    }
    return graphqlHTTP({ schema: schemaCache.get('global'), graphiql: true })(req, res)
  })
  return router
}

module.exports = { createMultiTenantGraphQL, createGlobalGraphQL }