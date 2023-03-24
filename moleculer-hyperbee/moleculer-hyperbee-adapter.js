'use strict'

const Corestore = require('corestore')
const HyperBee = require('hyperbee')
const crypto = require('crypto')

const defaultBeeOptions = { keyEncoding: 'utf-8', valueEncoding: 'json' }

class HyperBeeAdapter {

  constructor(name, beeOptions = defaultBeeOptions) {
    this.name = name
    this.options = beeOptions
    this.store = new Corestore(`${process.env.MOUNT_PATH}corestore-${this.name}`)
    this.core = this.store.get({ name: this.name })
    this.sub = {}
  }

  async init(broker, service) {
    this.broker = broker
    this.service = service
    await this.core.ready()
    console.log(`${this.name} core key: ${this.core.key.toString('hex')}`)
    this.bee = new HyperBee(this.core, this.options)
    await this.bee.ready()
    this.version = this.bee.version
    this.api = await this.apiGenerator(this.bee)
    return this
  }

  sha256(inp) {
    return crypto.createHash('sha256').update(inp).digest('hex')
  }

  async apiGenerator(db) {
    return {
      put: async ({ key, value }) => {
        return db.put(key, value)
      },

      swap: async ({ key, value, cas }) => {
        return db.put(key, value, { cas })
      },

      get: async ({ key }) => {
        return db.get(key)
      },

      del: async ({ key }) => {
        return db.del(key)
      },

      delCondition: async ({ key, cas }) => {
        return db.del(key, { cas })
      },

      insertMany: async ({ records }) => {
        const batch = db.batch()
        for await (const { key, value } of records) {
          await batch.put(key, value)
        }
        await batch.flush()
      },

      findFirst: async ({ query }) => {
        return await db.peek(query)
      },

      find: async ({ query }) => {
        const resultSet = []
        for await (const record of db.createReadStream(query)) {
          resultSet.push(record)
        }
        return resultSet
      },

      fullHistory: async ({ query }) => {
        const resultSet = []
        for await (const record of db.createHistoryStream(query)) {
          resultSet.push(record)
        }
        return resultSet
      },

      findDiff: async ({ version, query }) => {
        const resultSet = []
        for await (const record of db.createDiffStream(version, query)) {
          resultSet.push(record)
        }
        return resultSet
      },

      subDb: ({ prefix, options }) => {
        const sub = db.sub(prefix, options)
        return this.apiGenerator(sub)
      }
    }
  }
}

module.exports = HyperBeeAdapter
