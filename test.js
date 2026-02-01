const express = require("express")
const Scriba = require("scriba-sdk").default
const { createMultiTenantGraphQL, createGlobalGraphQL } = require("./index")

const app = express()

const scriba = new Scriba([
    { id: "ipsum", path: "./database/ipsum.db", schema: "./schema.prisma" },
    { id: "llms", path: "./database/llms.db", schema: "./llms.prisma" }
])


const newRegister = async () => {
    const user = await ipsum.User.push({
        name: "Lool",
        age: 18
    })

    await ipsum.Invoice.push({
        total: 10,
        userId: user.id
    })

    llms.Model.push({
        name: "gemini-2.5-flash",
        provider: "OpenRouter",
        inputPrice: 1.50,
        outputPrice: 0.25
    })
}

newRegister();

app.use(
    "/graphql",
    createMultiTenantGraphQL({
        tenantResolver: req => req.headers["x-tenant-id"],
        scribaInstance: scriba
    })
)

app.use(
    "/global",
    createGlobalGraphQL({ scribaInstance: scriba })
)

app.listen(3000, () => console.log("GraphQL server running on http://localhost:3000/graphql"))