const { NodeDiskStorage } = require('node-disk-storage')

class NodeDiskStorageAdapter {
  constructor (options) {
    this.nds = new NodeDiskStorage()
    this.options = options
  }

  async get (key) {
    return this.nds.get(key)
  }

  async set (key, value) {
    return this.nds.set(key, value)
  }

  async remove (key) {
    return this.nds.remove(key)
  }

  async clear () {
    return this.nds.clear()
  }

  async keys () {
    return this.nds.keys()
  }
}

module.exports = NodeDiskStorageAdapter
  
