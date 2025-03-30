import { expect } from "chai";
import { NODE_URL } from "../src/core/config";
import QuantumPurse from "../src/core/quantum_purse";
import { transfer, buildDummyTx } from "../src/core/transaction_builder";
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
  let seedPhrase: string =
    /* The first account from this seed is preloaded on testnet */
    "ball slush siren skirt local odor gather settle green remind orphan keep vapor comfort hen wave conduct phrase torch address hungry clerk caught vessel";

  before(async () => {
    // Manually initialize Wasm with Karma-served file
    const wasmResponse = await fetch("/base/key-vault/pkg/key_vault_bg.wasm");
    const wasmBuffer = await wasmResponse.arrayBuffer();
    await __wbg_init(wasmBuffer);
    wallet = await QuantumPurse.getInstance();
  });

  it("Should export the exact seed imported", async () => {
    await wallet.importSeedPhrase(
      utf8ToBytes(seedPhrase),
      utf8ToBytes(passwordStr)
    );
    const exportedSeedPhrase = await wallet.exportSeedPhrase(
      utf8ToBytes(passwordStr)
    );
    expect(bytesToUtf8(exportedSeedPhrase)).to.eq(seedPhrase);
  });

  it("Should zeroize password after wallet init", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.init(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after generating an account", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.init(passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize seed phrase and password after importing a new seed phrase", async () => {
    const seedPhraseHandler = utf8ToBytes(seedPhrase);
    const passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);
    expect(seedPhraseHandler.every((byte) => byte === 0)).to.be.true;
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it("Should zeroize password after exporting seed phrase", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.init(passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.exportSeedPhrase(passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;
  });

  it.skip("Should conduct a transaction successfully and zeroize password after", async () => {
    let passwordStrHandler = utf8ToBytes(passwordStr);
    const seedPhraseHandler = utf8ToBytes(seedPhrase);
    await wallet.importSeedPhrase(seedPhraseHandler, passwordStrHandler);

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.genAccount(passwordStrHandler);
    const accountList = await wallet.getAllAccounts();
    const address0 = wallet.getAddress(accountList[0]);
    const tx = await transfer(address0, address0, "333");

    passwordStrHandler = utf8ToBytes(passwordStr);
    await wallet.setAccPointer(accountList[0]);
    const signedTx = await wallet.sign(tx, passwordStrHandler);
    expect(passwordStrHandler.every((byte) => byte === 0)).to.be.true;

    const txId = await sendTransaction(NODE_URL, signedTx);
    await waitForTransactionConfirmation(NODE_URL, txId);
  });
});
