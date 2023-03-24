require('websocket-polyfill')
const NDSAdapter = require('./moleculer-nostr-adapter')
const { nip19, nip57 } = require('nostr-tools')

module.exports = {
  name: '',
  metadata: {
    $category: 'nost',
    $description: 'Moleculer NOSTR Service',
    $official: false,
    $package: {
      name: 'moleculer-nostr-service',
      version: '0.0.1',
      repo: null
    }
  },
  settings: {},
  actions: {

    createProfile: {
      params: {
        name: 'string|required',
        display_name: 'string|required',
        website: 'string|optional',
        about: 'string|optional',
        picture: 'string|optional',
        nip05: 'string|optional',
        lud16: 'string|optional',
        banner: 'string|optional'
      },
      async handler(ctx) {
        const ndsAdapter = new NDSAdapter()
        const { profileEvent, nprofile, npub } = await ndsAdapter.createProfile(ctx.params)
        return { profileEvent, nprofile, npub, nsec: ndsAdapter.nsec }
      }
    },

    createPost: {
      params: {
        sk: 'string|required',
        text: 'string|required'
      },
      async handler(ctx) {
        const { sk, text } = ctx.params
        const ndsAdapter = new NDSAdapter({ sk })
        const post = ndsAdapter.createPost(text)
        await ndsAdapter.transmitEvent(post)
        return post
      }
    },

    createDM: {
      params: {
        sk: 'string|required',
        recipientPK: 'string|required',
        text: 'string|required'
      },
      async handler(ctx) {
        const { sk, recipientPK, text } = ctx.params
        const ndsAdapter = new NDSAdapter({ sk })
        return await ndsAdapter.createEncryptedDirectMessage(recipientPK, text)
      }
    },

    getZapRequests: {
      params: {
        sk: 'string|required',
        filter: 'object|optional',
      },
      async handler(ctx) {
        const { sk, filter } = ctx.params;
        const requests = []
        const zaps = []
        const ndsAdapter = new NDSAdapter({ sk, filter })
        const sub = ndsAdapter.getZapNotes()
        const processZapNote = (event) => {
          const description = event.tags.find(tagPair => tagPair[0] === 'description')[1]
          const validateRequestError = nip57.validateZapRequest(description)
          if (validateRequestError) {
            throw new Error(validateRequestError)
          }
          const zapTagMap = new Map(event.tags)
          const zapRequest = JSON.parse(zapTagMap.get('description'))
          const zapRequestTagMap = new Map(zapRequest.tags)
          const request = {
            zapId: event.id,
            npub: this.npub,
            invoice: zapTagMap.get('bolt11'),
            zapperPubkey: zapRequest.pubkey,
            amount: zapRequestTagMap.get('amount'),
            preimage: zapTagMap.get('preimage'),
            createdAd: zapRequest.created_at
          }
          requests.push(request)
        }

        async function waitForEvents() {
          return new Promise((resolve) => {
            sub.on('event', (event) => {
              zaps.push(event)
            });

            sub.on('eose', async () => {
              await Promise.all(zaps.map(processZapNote))
              resolve(requests)
            });
          })
        }

        return await waitForEvents()
      }
    },


    getFeed: {
      params: {
        sk: 'string|required',
        filter: 'object|optional',
      },
      async handler(ctx) {
        const { sk, filter } = ctx.params
        const ndsAdapter = new NDSAdapter({ sk })
        const sub = await ndsAdapter.getFeed(filter)
        const posts = []

        const processPost = (event) => {
          event.noteid = nip19.noteEncode(event.id)
          return event
        }

        async function waitForEvents() {
          return new Promise((resolve) => {
            sub.on('event', (event) => {
              posts.push(event);
            })

            sub.on('eose', async () => {
              await Promise.all(posts.map(processPost))
              resolve(posts)
            })
          })
        }

        return await waitForEvents()
      }
    },

    getProfile: {
      params: {
        npub: 'string|optional',
        pubkey: 'string|optional',
      },
      async handler(ctx) {
        const { npub, pubkey } = ctx.params
        let pk
        if (npub) {
          pk = (nip19.decode(userNpub)).data
        } else {
          pk = pubkey
        }
        const ndsAdapter = new NDSAdapter()
        const sub = ndsAdapter.getUserProfile(pk)
        const metadata = []
        const processMetadata = (event) => {

          if (event) {
            const nprofile = nip19.nprofileEncode({ pubkey: pk, relays: [this.relay] })
            return {
              profileEvent,
              nprofile,
              npub: this.npub,
            }
          } else {
            throw new Error('Failed to create profile')
          }
        }

        async function waitForEvents() {
          return new Promise((resolve) => {
            sub.on('event', (event) => {
              metadata.push(event);
            })

            sub.on('eose', async () => {
              await Promise.all(posts.map(processMetadata))
              resolve(metadata)
            })
          })
        }

        return await waitForEvents()
      }
    }

  },

  methods: {},

  async created() { },

  async stopped() { }
}