// To customize jest test env with webcrypto and indexedDB
const NodeEnvironment = require('jest-environment-node').default || require('jest-environment-node');
const { Crypto } = require('@peculiar/webcrypto');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

class WebCryptoEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.crypto = new Crypto();
    this.global.indexedDB = new FDBFactory();
  }

  async setup() {
    await super.setup();
  }

  async teardown() {
    // Clean up globals for test isolation
    delete this.global.crypto;
    delete this.global.indexedDB;
    await super.teardown();
  }

  getVmContext() {
    const context = super.getVmContext();
    return context;
  }
}

module.exports = WebCryptoEnvironment;