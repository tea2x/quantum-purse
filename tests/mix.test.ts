import { expect } from "chai";
import { NODE_URL } from "../src/core/config";
import QuantumPurse from "../src/core/quantum_purse";
import { transfer } from "../src/core/transaction_builder";
import sinon from "sinon";
import {
  utf8ToBytes,
  bytesToUtf8,
  sendTransaction,
  waitForTransactionConfirmation,
} from "../src/core/utils";
import __wbg_init from "../key-vault/pkg/key_vault";

describe("Quantum Purse Basics", () => {
  let wallet: QuantumPurse;
  let passwordStr: string = "my password is easy to crack. D0n't use this!";
  let seedPhrase1: string =
    "ball slush siren skirt local odor gather settle green remind orphan keep vapor comfort hen wave conduct phrase torch address hungry clerk caught vessel";
  let seedPhrase2: string =
    "multiply supreme one syrup crash pact cinnamon meat foot together group improve assist nuclear vacuum pelican gain rely behind hedgehog arrest firm blossom anxiety";

  before(async () => {
    // Manually initialize Wasm with Karma-served file
    const wasmResponse = await fetch("/base/key-vault/pkg/key_vault_bg.wasm");
    const wasmBuffer = await wasmResponse.arrayBuffer();
    await __wbg_init(wasmBuffer);
    wallet = await QuantumPurse.getInstance();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("Should export the exact seed imported", async () => {
    await wallet.importSeedPhrase(
      utf8ToBytes(seedPhrase1),
      utf8ToBytes(passwordStr)
    );
    const exportedSeedPhrase = await wallet.exportSeedPhrase(
      utf8ToBytes(passwordStr)
    );
    expect(bytesToUtf8(exportedSeedPhrase)).to.eq(seedPhrase1);
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
    sinon.stub(wallet, 'setSellectiveSyncFilter').resolves();

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize seed phrase and password after importing a new seed phrase", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhrase1);
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
    const seedPhraseHandler = utf8ToBytes(seedPhrase1);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);

    // Mocking lightClient related function
    sinon.stub(wallet, 'setSellectiveSyncFilter').resolves();

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    const accountList = await wallet.getAllAccounts();
    const address0 = wallet.getAddress(accountList[0]);
    const tx = await transfer(address0, address0, "333");

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.setAccPointer(accountList[0]);
    const signedTx = await wallet.sign(tx, passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;

    // const txId = await sendTransaction(NODE_URL, signedTx);
    // await waitForTransactionConfirmation(NODE_URL, txId);
  });

  it("Should zeroize password after generating account batch", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.initSeedPhrase(passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccountInBatch(passwordStrHandler, 0, 3);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after recovering accounts", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhrase2);
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.recoverAccounts(passwordStrHandler, 3);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after checking password", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await QuantumPurse.checkPassword(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });
});
