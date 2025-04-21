import { expect } from "chai";
import QuantumPurse, { SphincsVariant } from "../src/core/quantum_purse";
import sinon from "sinon";
import { utf8ToBytes, bytesToUtf8 } from "../src/core/utils";
import __wbg_init from "sphincs-plus-key-vault-web";
import { dummyTx } from "./dummy_tx";

describe("Quantum Purse Basics", () => {
  let wallet: QuantumPurse;
  let passwordStr: string = "my password is easy to crack. D0n't use this!";
  let seedPhrase48: string =
    "uncover behind cargo satoshi tail answer liar success snap explain trigger brush cube mountain friend damp empty nose plastic huge pave enter wolf hazard miracle helmet trend connect bench battle diagram person uniform bike bottom negative glove vague diagram never float peace pride ivory banner say safe mesh";
  let seedPhrase72: string =
    "seed boss famous insane stick below swap almost treat suit snake bracket scale kiwi unlock wood repeat cart crawl require duty call fit uncle scale color rhythm please file family example ripple flat embody library usual kind razor erode payment next alpha chapter excuse quote couple easily bus update planet raise treat critic depart river wealth science exchange chief angle wrist second thank razor supply mean nice aware rotate lady repair wine";
  let seedPhraseInvalidLength24: string =
    "multiply supreme one syrup crash pact cinnamon meat foot together group improve assist nuclear vacuum pelican gain rely behind hedgehog arrest firm blossom anxiety";
  let seedPhraseInvalidChecksum: string =
    "seed boss famous insane stick below swap almost treat suit snake bracket scale kiwi unlock wood repeat cart crawl require duty call fit uncle scale color rhythm please file family example ripple flat embody library usual kind razor erode payment next alpha chapter excuse quote couple easily bus update planet raise treat critic depart river wealth science exchange chief angle wrist second thank razor supply mean nice aware rotate lady repair what";
  let seedPhraseContainInvalidWords: string =
    "seed boss famous insane stick below swap almost treat suit snake bracket scale kiwi unlock wood repeat cart crawl require duty call fit uncle scale color rhythm please file family example ripple flat embody library usual kind razor erode payment next alpha chapter excuse quote couple easily bus update planet raise treat critic depart river wealth science exchange chief angle wrist second thank razor supply mean nice aware rotate lady repair thisisnotaword";

  before(async () => {
    // Manually initialize Wasm with Karma-served file
    const wasmResponse = await fetch("/base/node_modules/sphincs-plus-key-vault-web/sphincs_plus_key_vault_web_bg.wasm");
    const wasmBuffer = await wasmResponse.arrayBuffer();
    await __wbg_init(wasmBuffer);
    wallet = await QuantumPurse.getInstance();
    wallet.initKeyVault(SphincsVariant.Shake128F);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("Should export the exact seed imported", async () => {
    await wallet.importSeedPhrase(
      utf8ToBytes(seedPhrase48),
      utf8ToBytes(passwordStr)
    );
    const exportedSeedPhrase = await wallet.exportSeedPhrase(
      utf8ToBytes(passwordStr)
    );
    expect(bytesToUtf8(exportedSeedPhrase)).to.eq(seedPhrase48);
  });

  it("Should zeroize password after wallet init", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.initSeedPhrase(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after generating an account", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.initSeedPhrase(passwordStrHandler);
    // Mocking lightClient related function
    sinon.stub(wallet as any, "setSellectiveSyncFilterInternal").resolves();

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize seed phrase and password after importing a new seed phrase", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhrase48);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
    expect(seedPhraseHandler.every((byte) => byte === 0)).to.be.true;
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after exporting seed phrase", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.initSeedPhrase(passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.exportSeedPhrase(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after signing a transaction", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    const seedPhraseHandler = utf8ToBytes(seedPhrase48);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);

    // Mocking lightClient related function
    sinon.stub(wallet as any, "setSellectiveSyncFilterInternal").resolves();

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    const accountList = await wallet.getAllLockScriptArgs();
    const address0 = wallet.getAddress(accountList[0]);

    // Stub buildTransfer to return a dummy transaction
    sinon.stub(wallet as any, "buildTransfer").resolves(dummyTx);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.setAccountPointer(accountList[0]);
    const signedTx = await wallet.sign(dummyTx, passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after generating account batch", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.initSeedPhrase(passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccountInBatch(passwordStrHandler, 0, 3);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after recovering accounts", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhrase72);
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);

    // Mock `this.client`
    const mockClient = {
      getTransactions: sinon.stub().resolves({
        transactions: [{ blockNumber: BigInt(100) }],
      }),
      setScripts: sinon.stub().resolves(),
    };
    (wallet as any).client = mockClient;

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.recoverAccounts(passwordStrHandler, 3);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after checking password", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await QuantumPurse.checkPassword(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should throw when importing seedphrase that's of different length than 48/72", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhraseInvalidLength24);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    try {
      await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      console.error(error)
      expect(error).to.equal('Mnemonic must have 48 or 72 words');
    }
  });

  it("Should throw when importing seedphrase with invalid check sum", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhraseInvalidChecksum);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    try {
      await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      console.error(error)
      expect(error).to.equal("Invalid mnemonic chunk: the mnemonic has an invalid checksum");
    }
  });

  it("Should throw when importing seedphrase with invalid words", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhraseContainInvalidWords);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    try {
      await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      console.error(error)
      expect(error).to.contain("Invalid mnemonic chunk: mnemonic contains an unknown word");
    }
  });

  it("Should throw when use 48 word seed phrase for 256/(same 192) sphincs+ variants", async () => {
    wallet.initKeyVault(SphincsVariant.Sha2256S);
    const seedPhraseHandler = utf8ToBytes(seedPhrase48);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    try {
      await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      console.error(error)
      expect(error).to.contain("Insufficient entropy: the input seed phrase got");
    }
  });
});