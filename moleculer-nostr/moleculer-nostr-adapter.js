'use strict'

const nostr = require('nostr-tools')
const crypto = require('crypto')
const secp = require('@noble/secp256k1')

const {
  Kind,
  SimplePool,
  generatePrivateKey,
  getPublicKey,
  validateEvent,
  verifySignature,
  signEvent,
  getEventHash,
  relayInit,
  nip19,
} = nostr

class NostrClientAdapter {

  #sk
  pk
  npub
  nsec
  relays
  options
  transmitted = false

  constructor(options) {
    this.#sk = options?.sk || generatePrivateKey()
    this.pk = getPublicKey(this.#sk)
    this.npub = nip19.npubEncode(this.pk)
    this.nsec = nip19.nsecEncode(this.#sk)
    this.relays = options?.relays || process.env.NOSTR_RELAYS.split(',') || []
    this.options = options || {}
    this.pool = new SimplePool()
    return this
  }

  static createNewKeyPair() {
    const sk = generatePrivateKey()
    const pk = getPublicKey(sk)
    return {
      sk,
      pk
    }
  }

  encryptDM(recepientPublicKey, message) {
    const sharedPoint = secp.getSharedSecret(this.#sk, '02' + recepientPublicKey)
    const sharedX = sharedPoint.slice(1, 33)

    const iv = crypto.randomFillSync(new Uint8Array(16))
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(sharedX),
      iv
    )
    let encryptedMessage = cipher.update(message, 'utf8', 'base64')
    encryptedMessage += cipher.final('base64')
    const ivBase64 = Buffer.from(iv.buffer).toString('base64')
    return encryptedMessage + '?iv=' + ivBase64
  }

  async createEncryptedDirectMessage(recipient, content) {
    const enc = this.encryptDM(recipient, content)
    const event = this.createEvent(Kind.EncryptedDirectMessage, enc, [['p', recipient]])
    return await this.transmitEvent(event)
  }

  async createProfile(profile) {

    const profileEvent = this.createEvent(Kind.Metadata, JSON.stringify(profile))
    if (profileEvent) {
      await this.transmitEvent(profileEvent)
      const nprofile = nip19.nprofileEncode({ pubkey: this.pk, relays: this.relays })
      return {
        profileEvent,
        nprofile,
        npub: this.npub,
      } 
    } else {
      throw new Error('Failed to create profile')
    }
  }

  createEvent(kind, content, tags = []) {
    let event = {
      kind,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: this.pk
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, this.#sk)
    if (validateEvent(event) && verifySignature(event)) {
      return event
    } else {
      return null
    }
  }

  createPost(content) {
    return this.createEvent(Kind.Text, content)
  }

  getZapNotes(filter = {}) {
    return this.pool.sub(this.relays, [{
      ...filter,
      kinds: [Kind.Zap],
      '#p': [this.pk],
    }])
  }

  async getFeed(filter = {}) {
    return this.pool.sub(this.relays, [{
      ...filter,
      kinds: [Kind.Text],
      'authors': [this.pk],
    }])
  }

  async getProfile() {
    return this.pool.sub(this.relays, [{
      kinds: [Kind.Metadata],
      'authors': [this.pk],
    }])
  }

  async transmitEvent(event) {
    this.transmitted = false
    this.pool.publish(this.relays, event)
    return await this.pool.get(this.relays, { id: event.id })
  }

  // SINGLE RELAY methods

  async connectRelay() {
    const relay = relayInit(this.relays[0])
    relay.on('connect', () => {
      console.log(`connected to ${relay.url}`)
    })
    relay.on('error', () => {
      console.log(`failed to connect to ${relay.url}`)
      return false
    })
    await relay.connect()
    this.relay = relay
    return true
  }

  subToEvent(filter) {
    return this.relay.sub([
      filter
    ])
  }

  async waitForTransmission() {
    return new Promise((resolve, reject) => {
      if (!this.transmitted) {
        setTimeout(() => {
          this.waitForTransmission().then(resolve).catch(reject)
        }, 1000)
      } else {
        resolve()
      }
    })
  }

  closeConnectionToRelay() {
    this.relay.close()
  }

}

module.exports = NostrClientAdapter