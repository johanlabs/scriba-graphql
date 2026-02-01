# Scriba GraphQL

**Zero-config GraphQL multi-tenant e global para Express**, gerado dinamicamente a partir do **Scriba SDK**.

Este projeto cria schemas GraphQL automaticamente com base nos tenants, tabelas, campos e relações definidos no Scriba — sem precisar escrever resolvers manualmente.

---

## ✨ Features

* 🚀 **Zero configuração**: schemas GraphQL gerados automaticamente
* 🧩 **Multi-tenant por request** (header, subdomínio, etc.)
* 🌍 **Schema global** para acessar todos os tenants
* 🔍 **Filtros avançados** (`eq`, `ne`, `gt`, `lt`, `in`, `contains`, etc.)
* 📄 **Paginação** (`limit` e `offset`)
* 🔗 **Relações automáticas**
* 🧠 **Cache de schema** com LRU
* 🧪 **GraphiQL habilitado**

---

## 📦 Instalação

```bash
npm install scriba-graphql
```

Dependências principais:

* `express`
* `graphql`
* `express-graphql`
* `scriba-sdk`

---

## 🚀 Uso Básico

### 1️⃣ Criando a instância do Scriba

```js
const Scriba = require("scriba-sdk").default

const scriba = new Scriba([
  { id: "ipsum", path: "./database/ipsum.db", schema: "./schema.prisma" },
  { id: "llms", path: "./database/llms.db", schema: "./llms.prisma" }
])
```

---

### 2️⃣ GraphQL Multi-Tenant

Cada request resolve automaticamente o tenant com base no header (ou outra lógica).

```js
const express = require("express")
const { createMultiTenantGraphQL } = require("scriba-graphql")

const app = express()

app.use(
  "/graphql",
  createMultiTenantGraphQL({
    tenantResolver: req => req.headers["x-tenant-id"],
    scribaInstance: scriba
  })
)

app.listen(3000, () =>
  console.log("GraphQL em http://localhost:3000/graphql")
)
```

#### 🔑 Header esperado

```http
x-tenant-id: ipsum
```

---

### 3️⃣ GraphQL Global (todos os tenants)

```js
const { createGlobalGraphQL } = require("scriba-graphql")

app.use(
  "/global",
  createGlobalGraphQL({ scribaInstance: scriba })
)
```

Acesse:

```
http://localhost:3000/global
```

---

## 🧠 Estrutura do Schema

### Tenant

Cada tenant vira um namespace no GraphQL:

```graphql
query {
  ipsum {
    users {
      id
      name
      age
    }
  }
}
```

---

### Queries automáticas

Para cada tabela:

* **singular** → retorna 1 registro
* **plural** → retorna lista

```graphql
query {
  ipsum {
    user(where: { id: { eq: 1 } }) {
      name
    }

    users(
      where: { age: { gte: 18 } }
      limit: 10
      offset: 0
    ) {
      id
      name
      age
    }
  }
}
```

---

## 🔍 Filtros disponíveis

### Tipos numéricos

* `eq`, `ne`
* `gt`, `gte`
* `lt`, `lte`
* `in`, `nin`

### Strings / IDs

* `eq`, `ne`
* `contains`
* `startsWith`
* `endsWith`
* `in`, `nin`

---

## 🔗 Relações

Relações definidas no Scriba são expostas automaticamente:

```graphql
query {
  ipsum {
    users {
      name
      invoices {
        total
      }
    }
  }
}
```

---

## ⚙️ Cache de Schema

Os schemas são:

* Gerados **uma única vez por tenant**
* Armazenados em **LRU Cache**
* Evitam custo de reconstrução por request

---

## 🧪 Desenvolvimento

```bash
node test.js
```

Depois acesse:

* `http://localhost:3000/graphql`
* `http://localhost:3000/global`

---

## 📁 Estrutura do Projeto

```
.
├─ index.js          # Core GraphQL generator
├─ test.js           # Exemplo de uso
├─ package.json
├─ johankit.yml
└─ database/
```

---

## 📌 Requisitos

* Node.js ≥ 16
* Scriba SDK ≥ 1.0
* Express ≥ 4

---

## 🛠️ Roadmap (ideias)

* Mutations automáticas (create/update/delete)
* Autorização por tenant / tabela
* Subscriptions
* Custom scalars
* Hooks de lifecycle

---

## 📄 Licença

MIT © João Santana