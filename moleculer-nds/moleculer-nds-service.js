const NDSAdapter = require('./moleculer-nds-adapter')

module.exports = {
  name: '',
  metadata: {
    $category: 'database',
    $description: 'Moleculer NDS Service',
    $official: false,
    $package: {
      name: 'moleculer-nds-service',
      version: '0.0.1',
      repo: null
    }
  },
  settings: {},
  actions: {

    set: {
      params: {
        key: 'string',
        value: 'object'
      },
      async handler(ctx) {
        return this.adapter.set(ctx.params.key, ctx.params.value)
      }
    },

    get: {
      params: {
        key: 'string'
      },
      async handler(ctx) {
        return this.adapter.get(ctx.params.key)
      }
    },

    remove: {
      params: {
        key: 'string'
      },
      async handler(ctx) {
        return this.adapter.remove(ctx.params.key)
      }
    },

    clear: {
      async handler(ctx) {
        return this.adapter.clear()
      }
    },

    keys: {
      async handler(ctx) {
        return this.adapter.keys()
      }
    },

  },

  methods: {},

  async created() {
    this.adapter = new NDSAdapter()
  },

  async stopped() {}
}