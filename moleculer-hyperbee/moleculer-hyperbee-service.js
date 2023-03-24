const HyperbeeAdapter = require('./moleculer-hyperbee-adapter')
const Hyperswarm = require('hyperswarm')
const { Buffer } = require('buffer')

module.exports = {
  name: '',
  metadata: {
    $category: 'database',
    $description: 'Moleculer Hyperbee Mixin',
    $official: false,
    $package: {
      name: 'moleculer-hyperbee-mixin',
      version: '0.0.1',
      repo: null
    }
  },
  settings: {},
  actions: {
    put: {
      params: {
        key: {
          type: 'string',
          required: true
        },
        value: // [
          // { type: 'string', optional: true },
          { type: 'object', optional: true },
        // ]
      },
      handler(ctx) {
        return this._put(ctx, ctx.params)
      }
    },

    swap: {
      params: {
        key: {
          type: 'string',
          required: true
        },
        value: [
          { type: 'string', optional: true },
          { type: 'object', optional: true },
        ],
        cas: {
          type: 'function', optional: true
        }
      },
      handler(ctx) {
        return this._swap(ctx, ctx.params)
      }
    },

    get: {
      params: {
        key: {
          type: 'string',
          required: true
        }
      },
      handler(ctx) {
        return this._get(ctx, ctx.params)
      }
    },

    del: {
      params: {
        key: {
          type: 'string',
          required: true
        }
      },
      handler(ctx) {
        return this._del(ctx, ctx.params)
      }
    },

    delCondition: {
      params: {
        key: {
          type: 'string',
          required: true
        },
        cas: {
          type: 'function', optional: true
        }
      },
      handler(ctx) {
        return this._delCondition(ctx, ctx.params)
      }
    },

    insertMany: {
      params: {
        records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                required: true
              },
              value: [
                {
                  type: 'string',
                  optional: true
                },
                {
                  type: 'object',
                  optional: true
                },
              ]
            }
          }
        },
      },
      handler(ctx) {
        return this._insertMany(ctx, ctx.params)
      }
    },

    findFirst: {
      params: {
        query: {
          type: 'object',
          required: true
        }
      },
      handler(ctx) {
        return this._findFirst(ctx, ctx.params)
      }
    },

    find: {
      params: {
        query: {
          type: 'object',
          required: true
        }
      },
      handler(ctx) {
        return this._find(ctx, ctx.params)
      }
    },

    fullHistory: {
      params: {
        query: {
          type: 'object',
          required: true
        }
      },
      handler(ctx) {
        return this._fullHistory(ctx, ctx.params)
      }
    },

    findDiff: {
      params: {
        version: 'number',
        query: {
          type: 'object',
          required: true
        }
      },
      handler(ctx) {
        return this._findDiff(ctx, ctx.params)
      }
    },

    subDb: {
      params: {
        prefix: 'string',
        options: {
          type: 'object',
          optional: true
        }
      },
      handler(ctx) {
        return this._sub(ctx, ctx.params)
      }
    }
  },

  methods: {
    sha256(inp) {
      return this.adapter.sha256(inp)
    },

    _put(ctx, params) {
      const { key, value } = params
      return this.adapter.api.put({ key, value })
    },

    _swap(ctx, params) {
      const { key, value, cas } = params
      return this.adapter.api.swap({ key, value, cas })
    },

    _get(ctx, params) {
      const { key } = params
      return this.adapter.api.get({ key })
    },

    _del(ctx, params) {
      const { key } = params
      return this.adapter.api.del({ key })
    },

    _delCondition(ctx, params) {
      const { key, cas } = params
      return this.adapter.api.delCondition({ key, cas })
    },

    _insertMany(ctx, params) {
      const { records } = params
      return this.adapter.api.insertMany({ records })
    },

    _findFirst(ctx, params) {
      const { query } = params
      return this.adapter.api.findFirst({ query })
    },

    _find(ctx, params) {
      const { query } = params
      return this.adapter.api.find({ query })
    },

    _fullHistory(ctx, params) {
      const { query } = params
      return this.adapter.api.fullHistory({ query })
    },

    _findDiff(ctx, params) {
      const { version, query } = params
      return this.adapter.api.findDiff(version, { query })
    },

    _sub(ctx, params) {
      const { prefix, options } = params
      return this.adapter.api.subDb({ prefix, options })
    },

    async _createSubIndexes(db, keys, value) {
      let subDb = db
      let prevKey
      for await (const key of keys) {
        subDb = await subDb.subDb({ prefix: key })
        await subDb.put({
          key: (prevKey
            ? `${value[prevKey]}!${value[key.split(':')[0]]}!${value._id}`
            : `${value[key.split(':')[0]]}!${value._id}`
          ),
          value
        })
        prevKey = key
      }
      return value
    },

  },

  async created() {
    this.adapter = new HyperbeeAdapter(`${this.name}`)
    await this.adapter.init(this.broker, this)
    if (this.settings.swarm) {
      const topic = this.adapter.sha256(`growr-hyperspace-${this.name}`)
      console.log(`${this.name} topic: ${topic}`)
      const topicHex = Buffer.from(topic, 'hex')
      this.swarm = new Hyperswarm()
      this.swarm.on('connection', socket => this.adapter.core.replicate(socket))
      console.log(`${this.name} discovery key: ${this.adapter.core.discoveryKey.toString('hex')}`)
      this.swarm.join(topicHex, { server: true, client: false })
      await this.swarm.flush()
    }
  },

  async stopped() {
    if (this.settings.swarm) {
      await this.swarm.destroy()
    }
    await this.adapter.store.close();
  }

}