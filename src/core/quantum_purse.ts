// QuantumPurse.ts
import { IS_MAIN_NET, SPHINCSPLUS_LOCK } from "./config";
import { Reader } from "ckb-js-toolkit";
import { CKBSphincsPlusHasher } from "./hasher";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";
import { Script, HashType, Address, Transaction, DepType, Cell } from "@ckb-lumos/base";
import { TransactionSkeletonType, TransactionSkeleton, sealTransaction, addressToScript } from "@ckb-lumos/helpers";
import { insertWitnessPlaceHolder, prepareSigningEntries, hexToByteArray } from "./utils";
import __wbg_init, { KeyVault, Util as KeyVaultUtil, SphincsVariant } from "../../key-vault/pkg/key_vault";
import { LightClient, randomSecretKey, LightClientSetScriptsCommand, CellWithBlockNumAndTxIndex, ScriptStatus } from "ckb-light-client-js";
import Worker from "worker-loader!../../light-client/status_worker.js";
import testnetConfig from "../../light-client/network.test.toml";
import mainnetConfig from "../../light-client/network.main.toml";
import { ClientIndexerSearchKeyLike, Hex } from "@ckb-ccc/core";
import { Config, predefined, initializeConfig } from "@ckb-lumos/config-manager";

export { SphincsVariant } from "../../key-vault/pkg/key_vault";

/**
 * Manages a wallet using the SPHINCS+ post-quantum signature scheme (shake-128f simple)
 * on the Nervos CKB blockchain. This class provides functionality for generating accounts, signing transactions,
 * managing seed phrases, and interacting with the blockchain.
 */
export default class QuantumPurse {
  //**************************************************************************************//
  //*********************************** ATRIBUTES ****************************************//
  //**************************************************************************************//
  /* All in one lock script configuration */
  private static readonly MULTISIG_ID     = "80";
  private static readonly REQUIRE_FISRT_N = "00";
  private static readonly THRESHOLD       = "01";
  private static readonly PUBKEY_NUM      = "01";
  private static instance?: QuantumPurse;
  /* CKB light client status worker */
  private worker: Worker | undefined;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }
  > = new Map();
  private client?: LightClient;
  private syncStatusListeners: Set<(status: any) => void> = new Set();
  private static readonly CLIENT_SECRET = "ckb-light-client-wasm-secret-key";
  private static readonly START_BLOCK   = "ckb-light-client-wasm-start-block";
  /* Account management */
  private keyVault?: KeyVault;
  private sphincsLock: { codeHash: string; hashType: HashType };
  public accountPointer?: string; // Is a sphincs+ public key

  //**************************************************************************************//
  //*************************************** METHODS **************************************//
  //**************************************************************************************//
  /** Constructor that takes sphincs+ on-chain binary deployment info */
  private constructor(sphincsCodeHash: string, sphincsHashType: HashType) {
    this.sphincsLock = { codeHash: sphincsCodeHash, hashType: sphincsHashType };
  }

  /* init code for wasm-bindgen module */
  private async initWasmBindgen(): Promise<void> {
    await __wbg_init();
  }

  /* init light client and status worker */
  private async initLightClient(): Promise<void> {
    await this.startLightClient();
    await this.fetchSphincsPlusCellDeps();
    this.startClientSyncStatusWorker();
  }

  /** Conjugate the first 4 bytes of the witness.lock for the hasher */
  private spxAllInOneSetupHashInput(): string {
    return (
      QuantumPurse.MULTISIG_ID +
      QuantumPurse.REQUIRE_FISRT_N +
      QuantumPurse.THRESHOLD +
      QuantumPurse.PUBKEY_NUM
    );
  }

  /** Initialize web worker to poll the sync status from the ckb light client */
  private startClientSyncStatusWorker() {
    if (this.worker !== undefined) return;

    this.worker = new Worker();
    this.worker!.onmessage = (event) => {
      const { command, data, requestId, type } = event.data;
      if (command === "getSyncStatus") {
        this.getSyncStatusInternal().then((status) => {
          this.worker!.postMessage({
            data: status,
            requestId,
          });
        });
      } else if (type === "syncStatusUpdate") {
        // Notify all listeners of the new sync status
        this.syncStatusListeners.forEach((listener) => listener(data));
      } else if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve } = this.pendingRequests.get(requestId)!;
        resolve(data);
        this.pendingRequests.delete(requestId);
      }
    };
    // Start the worker’s polling loop
    this.sendRequestToWorker("start");
  }

  /** Request to ckb light client web worker */
  private sendRequestToWorker(command: string): Promise<any> {
    if (!this.worker) throw new Error("Worker not initialized");
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7);
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage({ command, requestId });
    });
  }

  /* Helper to infer start block set in the light client
  When querying status, if no data in DB is detected, start is inferred as 0 to not mis relevant data */
  private inferStartBlock(storeKey: string): bigint {
    let startStr = localStorage.getItem(storeKey);
    if (startStr === null) {
      return BigInt(0);
    } else {
      return BigInt(parseInt(startStr));
    }
  }

  /* Helper function for genAccount that tells the light client which account and from what block they start making transactions. 
   * In account generation, each account's lightclient starting block will be set to the tip block, naturally. Designed to be called
   * when accounts are created gradually via genAccount (when users want to create a new account)
  */
  private async setSellectiveSyncFilterInternal(
    spxLockArgs: string,
    firstAccount: boolean
  ): Promise<void> {
    if (!this.client) throw new Error("Light client not initialized");

    const lock = this.getLock(spxLockArgs);
    const storageKey = QuantumPurse.START_BLOCK + "-" + spxLockArgs;
    let startingBlock: bigint = (await this.client!.getTipHeader()).number;

    localStorage.setItem(storageKey, startingBlock.toString());

    await this.client.setScripts(
      [{ blockNumber: startingBlock, script: lock, scriptType: "lock" }],
      firstAccount ? LightClientSetScriptsCommand.All : LightClientSetScriptsCommand.Partial
    );
  }

  /* Calculate sync status */
  private async getSyncStatusInternal() {
    if (!this.client) throw new Error("Light client not initialized");

    const [localNodeInfo, scripts, tipHeader] = await Promise.all([
      this.client.localNodeInfo(),
      this.client.getScripts(),
      this.client.getTipHeader(),
    ]);

    const tipBlock = Number(tipHeader.number);
    /* When wallet/accounts may not be created yet(accountPointer not available),
    light client connection and tipBlock can still be shown to let users know */
    if (!this.accountPointer) return {
      nodeId: localNodeInfo.nodeId,
      connections: localNodeInfo.connections,
      syncedBlock: 0,
      tipBlock: tipBlock,
      syncedStatus: 0,
      startBlock: 0
    };

    const lock = this.getLock();
    const storeKey = QuantumPurse.START_BLOCK + "-" + this.accountPointer;
    const startBlock = Number(this.inferStartBlock(storeKey));
    const script = scripts.find((script) => script.script.args === lock.args);
    const syncedBlock = Number(script?.blockNumber ?? 0);
    const syncedStatus = tipBlock > startBlock
      ? ((syncedBlock - startBlock) / (tipBlock - startBlock)) * 100
      : 0;

    return {
      nodeId: localNodeInfo.nodeId,
      connections: localNodeInfo.connections,
      syncedBlock,
      tipBlock,
      syncedStatus,
      startBlock
    };
  }

  /* Start light client thread*/
  private async startLightClient() {
    if (this.client !== undefined) return;

    let secretKey = localStorage.getItem(QuantumPurse.CLIENT_SECRET);
    if (!secretKey) {
      secretKey = randomSecretKey();
      if (secretKey) {
        localStorage.setItem(QuantumPurse.CLIENT_SECRET, secretKey);
      } else {
        throw new Error("Failed to generate a secret key.");
      }
    }

    this.client = new LightClient();
    const config = IS_MAIN_NET
      ? await (await fetch(mainnetConfig)).text()
      : await (await fetch(testnetConfig)).text();
    await this.client.start(
      { type: IS_MAIN_NET ? "MainNet" : "TestNet", config },
      secretKey as Hex,
      "info"
    );
  }

  /* Fetch the sphincs+ celldeps to the light client in quantumPurse wallet setup */
  private async fetchSphincsPlusCellDeps() {
    if (!this.client) throw new Error("Light client not initialized");
    await this.client.fetchTransaction(SPHINCSPLUS_LOCK.outPoint.txHash);
  }

  /**
   * Gets the singleton instance of QuantumPurse.
   * It seems key-vault initialization should be placed in a different init function.
   * But Keyvault is too fused to QuantumPurse so for convenience, it is placed here.
   * @returns The singleton instance of QuantumPurse.
   */
  public static getInstance() {
    if (!QuantumPurse.instance) {
      QuantumPurse.instance = new QuantumPurse(
        SPHINCSPLUS_LOCK.codeHash,
        SPHINCSPLUS_LOCK.hashType as HashType
      );
    }
    return QuantumPurse.instance;
  }

  /* init background service as wasm code and light client*/
  public async initBackgroundServices(): Promise<void> {
    await this.initWasmBindgen();
    await this.initLightClient();
  }

  /**
   * Fresh start a key-vault instance with a pre-determined SPHINCS variant.
   * @param variant The SPHINCS+ parameter set to start with
   * @returns void.
   */
  public initKeyVault(variant: SphincsVariant) {
    if (this.keyVault) {
      this.keyVault.free();
    }
    this.keyVault = new KeyVault(variant);
  }

  /* get the name of sphincs+ paramset of choice*/
  public getSphincsPlusParamSet(): string {
    if (!this.keyVault) throw new Error("KeyVault not initialized!");
    return SphincsVariant[this.keyVault.variant];
  }

  /* Method to add a listener */
  public addSyncStatusListener(listener: (status: any) => void): void {
    this.syncStatusListeners.add(listener);
  }
  
  /* Method to remove a listener */
  public removeSyncStatusListener(listener: (status: any) => void): void {
    this.syncStatusListeners.delete(listener);
  }

  /**
   * Send the signed transaction via the light client.
   * @param signedTx The signed CKB transaction
   * @returns The transaction hash(id).
   * @throws Error light client is not initialized.
   */
  public async sendTransaction(signedTx: Transaction): Promise<string> {
    if (!this.client) throw new Error("Light client not initialized");
    const txid = this.client.sendTransaction(signedTx);
    return txid;
  }

  /**
   * Helper function tells the light client which account and from what block they start making transactions.
   * @param spxLockArgsArray The sphincs+ lock script arguments array (each correspond to 1 sphincs+ accounts in your DB).
   * @param startingBlocks The starting block array corresponding to the spxLockArgsArray to be set.
   * @param setMode The mode to set the scripts (All, Partial, Delete).
   * @throws Error light client is not initialized.
   */
  public async setSellectiveSyncFilter(spxLockArgsArray: string[], startingBlocks: bigint[], setMode: LightClientSetScriptsCommand) {
    if (!this.client) throw new Error("Light client not initialized");

    if (spxLockArgsArray.length !== startingBlocks.length) {
      throw new Error("Length of spxLockArgsArray and startingBlocks must be the same");
    }

    for (let i = 0; i < spxLockArgsArray.length; i++) {
      const storageKey = QuantumPurse.START_BLOCK + "-" + spxLockArgsArray[i];
      localStorage.setItem(storageKey, startingBlocks[i].toString());
    }

    const filters: ScriptStatus[] = spxLockArgsArray.map((spxLockArgs, index) => ({
      blockNumber: startingBlocks[index],
      script: this.getLock(spxLockArgs),
      scriptType: "lock"
    }));

    await this.client.setScripts(filters, setMode);
  }

  /**
   * Gets the CKB lock script.
   * @param spxLockArgs - The sphincs+ lock script arguments.
   * @returns The CKB lock script (an asset lock in CKB blockchain).
   * @throws Error if no account pointer is set by default.
   */
  public getLock(spxLockArgs?: string): Script {
    const accPointer =
      spxLockArgs !== undefined ? spxLockArgs : this.accountPointer;
    if (!accPointer || accPointer === "") {
      throw new Error("Account pointer not available!");
    }

    if (!this.keyVault) throw new Error("KeyVault not initialized!");

    return {
      codeHash: this.sphincsLock.codeHash,
      hashType: this.sphincsLock.hashType,
      args: "0x" + accPointer,
    };
  }

  /**
   * Gets the blockchain address.
   * @param spxLockArgs - The sphincs+ lock script arguments.
   * @returns The CKB address as a string.
   * @throws Error if no account pointer is set by default (see `getLock` for details).
   */
  public getAddress(spxLockArgs?: string): string {
    const lock = this.getLock(spxLockArgs);
    return scriptToAddress(lock, IS_MAIN_NET);
  }

  /**
   * Gets account balance via light client protocol.
   * @param spxLockArgs - The sphincs+ lock script argument to form an address from which balance is retrieved, via light client.
   * @returns The account balance.
   * @throws Error light client is not initialized.
   */
  public async getBalance(spxLockArgs?: string): Promise<bigint> {
    if (!this.client) throw new Error("Light client not initialized");

    const lock = this.getLock(spxLockArgs);
    const searchKey: ClientIndexerSearchKeyLike = {
      scriptType: "lock",
      script: lock,
      scriptSearchMode: "prefix"
    };
    const capacity = await this.client.getCellsCapacity(searchKey);
    return capacity;
  }

  /**
   * Signs a Nervos CKB transaction using the SPHINCS+ signature scheme.
   * @param tx - The transaction skeleton to sign.
   * @param password - The password to decrypt the private key (will be zeroed out after use).
   * @param spxLockArgs - The sphincs+ lock script arguments.
   * @returns A promise resolving to the signed transaction.
   * @throws Error if no account is set or decryption fails.
   * @remark The password is overwritten with zeros after use.
   */
  public async sign(
    tx: TransactionSkeletonType,
    password: Uint8Array,
    spxLockArgs?: string
  ): Promise<Transaction> {
    try {
      const accPointer = spxLockArgs !== undefined ? spxLockArgs : this.accountPointer;
      if (!accPointer || accPointer === "") {
        throw new Error("Account pointer not available!");
      }

      if (!this.keyVault) {
        throw new Error("KeyVault not initialized!");
      }

      tx = insertWitnessPlaceHolder(tx);
      tx = prepareSigningEntries(tx);
      const entry = tx.get("signingEntries").toArray();
      const spxSig = await this.keyVault.sign(password, accPointer, hexToByteArray(entry[0].message));
      const spxSigHex = new Reader(spxSig.buffer as ArrayBuffer).serializeJson();
      return sealTransaction(tx, [spxSigHex]);
    } finally {
      password.fill(0);
    }
  }

  /* Clears all local data of the wallet. */
  public async deleteWallet(): Promise<void> {
    // localStorage.removeItem(QuantumPurse.CLIENT_SECRET);
    const spxPubKeyList = await this.getAllAccounts();
    spxPubKeyList.forEach((spxPub) => {
      localStorage.removeItem(QuantumPurse.START_BLOCK + "-" + spxPub);
    });
    await Promise.all([
      KeyVault.clear_database(),
      // this.client!.stop();
    ]);
  }

  /**
   * Generates a new account derived from the master seed; Set sellective sync filter for the account on the ckb light client;
   * For the first account generation (index 0), sellectice sync filter will replace the previous sync filters.
   * @param password - The password to decrypt the master seed and encrypt the child key (will be zeroed out).
   * @returns A promise that resolves when the account is generated and set.
   * @throws Error if the master seed is not found or decryption fails.
   * @remark The password is overwritten with zeros after use.
   */
  public async genAccount(password: Uint8Array): Promise<string> {
    try {
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      const [accList, sphincs_pub] = await Promise.all([
        this.getAllAccounts(),
        this.keyVault.gen_new_account(password)
      ]);
      await this.setSellectiveSyncFilterInternal(sphincs_pub, (accList.length === 0));
      return sphincs_pub;
    } finally {
      password.fill(0);
    }
  }

  /**
   * Sets the account pointer (There can be many sub/child accounts in db but at a time Quantum Purse will show just 1).
   * @param accPointer - The SPHINCS+ public key (as a pointer to the encrypted privatekey in DB) to set.
   * @throws Error if the account to be set is not in the DB.
   */
  public async setAccPointer(accPointer: string): Promise<void> {
    const accList = await this.getAllAccounts();
    if (!accList.includes(accPointer)) throw Error("Invalid account pointer");
    this.accountPointer = accPointer;
  }

  /**
   * Calculates the entropy of an alphabetical password in bits.
   * @param password - The password as a Uint8Array (UTF-8 encoded). Will be zeroed out after processing.
   * @returns The entropy in bits (e.g., 1, 2, 128, 256, 444, etc.), or 0 for invalid/empty input.
   * @remark The input password is overwritten with zeros after calculation.
   */
  public static checkPassword(password: Uint8Array): number {
    try {
      return KeyVaultUtil.password_checker(password);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Imports a seed phrase and stores it encrypted in IndexedDB, overwriting any existing seed.
   * @param seedPhrase - The seed phrase as a Uint8Array (UTF-8 encoded).
   * @param password - The password to encrypt the seed phrase (will be zeroed out).
   * @returns A promise that resolves when the seed is imported.
   * @remark SeedPhrase, password and sensitive data are overwritten with zeros after use.
   */
  public async importSeedPhrase(
    seedPhrase: Uint8Array,
    password: Uint8Array
  ): Promise<void> {
    try {
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      await this.keyVault.import_seed_phrase(seedPhrase, password);
    } finally {
      password.fill(0);
      seedPhrase.fill(0);
    }
  }

  /**
   * Exports the wallet's seed phrase.
   * @param password - The password to decrypt the seed (will be zeroed out).
   * @returns A promise resolving to the seed phrase as a Uint8Array.
   * @throws Error if the master seed is not found or decryption fails.
   * @remark The password is overwritten with zeros after use. Handle the returned seed carefully to avoid leakage.
   */
  public async exportSeedPhrase(password: Uint8Array): Promise<Uint8Array> {
    try {
      const seed = await KeyVault.export_seed_phrase(password);
      return seed;
    } finally {
      password.fill(0);
    }
  }

  /**
   * initialize a master seedphrase in DB.
   * @param password - The password to encrypt the master seed phrase.
   * @remark The password is overwritten with zeros after use.
   */
  public async initSeedPhrase(password: Uint8Array): Promise<void> {
    try {
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      await this.keyVault.init_seed_phrase(password);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Retrieve all sphincs plus public keys from all child accounts in the indexed DB.
   * @returns An ordered array of all child key's sphincs plus public keys.
   */
  public async getAllAccounts(): Promise<string[]> {
    return await KeyVault.get_all_sphincs_lock_args();
  }

  /**
   * Retrieve a list of on-the-fly sphincs+ public key for wallet recovery process.
   * @param password - The password to decrypt the master seed (will be zeroed out).
   * @param startIndex - The index to start searching from.
   * @param count - The number of keys to search for.
   * @returns An ordered array of all child key's sphincs plus public keys.
   * @remark The password is overwritten with zeros after use.
   */
  public async genAccountInBatch(
    password: Uint8Array,
    startIndex: number,
    count: number
  ): Promise<string[]> {
    try {
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      const list = await this.keyVault.try_gen_account_batch(password, startIndex, count);
      return list;
    } finally {
      password.fill(0);
    }
  }

  /**
   * Generate and settle accounts to the DB.
   * @param password - The password to decrypt the master seed (will be zeroed out).
   * @param count - The number of keys to search for.
   * @remark The password is overwritten with zeros after use.
   * TODO test set sellective sync
   */
  public async recoverAccounts(password: Uint8Array, count: number): Promise<void> {
    try {
      if (!this.client) throw new Error("Light client not initialized");
      if (!this.keyVault) throw new Error("KeyVault not initialized!");

      const spxPubKeyList = await this.keyVault.recover_accounts(password, count);
      const startBlocksPromises = spxPubKeyList.map(async (spxPub) => {
        const lock = this.getLock(spxPub);
        const searchKey: ClientIndexerSearchKeyLike = {
          scriptType: "lock",
          script: lock,
          scriptSearchMode: "prefix",
        };

        const response = await this.client?.getTransactions(searchKey, "asc", 1);
        let startBlock = BigInt(0);
        if (response && response.transactions && response.transactions.length > 0) {
          startBlock = response.transactions[0].blockNumber;
        }
        return startBlock;
      });

      const startBlocks = await Promise.all(startBlocksPromises);
      await this.setSellectiveSyncFilter(spxPubKeyList, startBlocks, LightClientSetScriptsCommand.All);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Assemble a CKB transfer transaction.
   *
   * @param from - The sender's address.
   * @param to - The recipient's address.
   * @param amount - The amount to transfer in CKB.
   * @returns A Promise that resolves to a TransactionSkeletonType object.
   * @throws Error if Light client is not ready / insufficient balance.
   */
  public async buildTransfer(
    from: Address,
    to: Address,
    amount: string
  ): Promise<TransactionSkeletonType> {
    if (!this.client) throw new Error("Light client not initialized");

    // initialize configuration
    let configuration: Config = IS_MAIN_NET ? predefined.LINA : predefined.AGGRON4;
    initializeConfig(configuration);

    let txSkeleton = new TransactionSkeleton();
    const transactionFee = BigInt(60000); // 60_000 shannons
    const outputCapacity = BigInt(amount) * BigInt(1e8);
    const minimalSphincsPlusCapacity = BigInt(73) * BigInt(1e8);
    const requiredCapacity = transactionFee + outputCapacity + minimalSphincsPlusCapacity;

    // add sphics+ celldep
    txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
      cellDeps.push({
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      })
    );

    // add input cells
    const searchKey: ClientIndexerSearchKeyLike = {
      scriptType: "lock",
      script: addressToScript(from),
      scriptSearchMode: "prefix",
      filter: {
        outputDataLenRange: [0, 1]
      }
    };
    const collectedCells: CellWithBlockNumAndTxIndex[] = [];
    let cursor: Hex | undefined;
    let inputCapacity = BigInt(0);
    cellCollecting: while (true) {
      try {
        const cells = await this.client.getCells(searchKey, "asc", 10, cursor);
        if (cells.cells.length === 0) break cellCollecting;
        cursor = cells.lastCursor as Hex;
        for (const cell of cells.cells) {
          if (inputCapacity >= requiredCapacity) break cellCollecting;
          collectedCells.push(cell);
          inputCapacity += BigInt(cell.cellOutput.capacity as string);
        }
      } catch (error) {
        // error likely from getCells. todo check
        console.error("Failed to fetch cells:", error);
        break cellCollecting;
      }
    }

    if (inputCapacity < requiredCapacity)
      throw new Error("Insufficient balance!");

    let inputCells: Cell[] = collectedCells.map(item => ({
      cellOutput: {
        ...item.cellOutput,
        capacity: "0x" + item.cellOutput.capacity.toString(16)
      },
      data: item.outputData,
      outPoint: {
        ...item.outPoint,
        index: "0x" + item.outPoint.index.toString(16)
      }
    } as Cell));
    txSkeleton = txSkeleton.update("inputs", (i) => i.concat(inputCells));

    // add the output cell
    const output: Cell = {
      cellOutput: {
        capacity: "0x" + outputCapacity.toString(16),
        lock: addressToScript(to),
        type: undefined,
      },
      data: "0x",
    };
    txSkeleton = txSkeleton.update("outputs", (o) => o.push(output));

    // add the change cell
    const changeCapacity = inputCapacity - outputCapacity - transactionFee;
    const changeCell: Cell = {
      cellOutput: {
        capacity: "0x" + changeCapacity.toString(16),
        lock: addressToScript(from),
        type: undefined,
      },
      data: "0x",
    };
    txSkeleton = txSkeleton.update("outputs", (o) => o.push(changeCell));

    return txSkeleton;
  }
}
