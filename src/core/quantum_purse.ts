// QuantumPurse.ts
import { IS_MAIN_NET, SPHINCSPLUS_LOCK } from "./config";
import { Reader } from "ckb-js-toolkit";
import { CKBSphincsPlusHasher } from "./hasher";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";
import { Script, HashType, Transaction } from "@ckb-lumos/base";
import { TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import { insertWitnessPlaceHolder, prepareSigningEntries, hexToByteArray } from "./utils";
import keyVaultWasmInit, { KeyVault, Util as KeyVaultUtil } from "../../key-vault/pkg/key_vault";
import { LightClient, randomSecretKey, LightClientSetScriptsCommand } from "ckb-light-client-js";
import Worker from "worker-loader!../../light-client/status_worker.js";
import networkConfig from "../../light-client/network.toml";
import { ClientIndexerSearchKeyLike, Hex } from "@ckb-ccc/core";

/**
 * Manages a wallet using the SPHINCS+ post-quantum signature scheme (shake-128f simple)
 * on the Nervos CKB blockchain. This class provides functionality for generating accounts, signing transactions,
 * managing seed phrases, and interacting with the blockchain.
 */
export default class QuantumPurse {
  /* All in one lock script configuration */
  private static readonly MULTISIG_ID = "80";
  private static readonly REQUIRE_FISRT_N = "00";
  private static readonly THRESHOLD = "01";
  private static readonly PUBKEY_NUM = "01";
  private static readonly LOCK_FLAGS = "6d"; // [0110110]|[1]: [shake128f-id]|[signature-flag]
  private static readonly SPX_SIG_LEN: number = 17088;
  private static instance?: QuantumPurse;
  /* CKB light client wasm worker */
  private worker: Worker | undefined;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }
  > = new Map();
  private client?: LightClient;
  private static readonly CLIENT_ID = "ckb-light-client-wasm-secret-key";
  private static readonly START_BLOCK = "ckb-light-client-wasm-start-block";
  /* Account management */
  public accountPointer?: string; // Is a sphincs+ public key
  private sphincsLock: { codeHash: string; hashType: HashType };

  /** Constructor that takes sphincs+ on-chain binary deployment info */
  private constructor(sphincsCodeHash: string, sphincsHashType: HashType) {
    this.sphincsLock = { codeHash: sphincsCodeHash, hashType: sphincsHashType };
  }

  /**
   * Gets the singleton instance of QuantumPurse.
   * @returns The singleton instance of QuantumPurse.
   */
  public static async getInstance(): Promise<QuantumPurse> {
    if (!QuantumPurse.instance) {
      await keyVaultWasmInit(); //todo to be grouped with other init
      QuantumPurse.instance = new QuantumPurse(
        SPHINCSPLUS_LOCK.codeHash,
        SPHINCSPLUS_LOCK.hashType as HashType
      );
    }
    return QuantumPurse.instance;
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

  /** Initialize web worker to poll sync status */
  private startClientSyncStatusWorker() {
    if (this.worker !== undefined) return;
    
    this.worker = new Worker();
    this.worker!.onmessage = (event) => {
      const { command, data, requestId } = event.data;
      if (command === "getSyncStatus") {
        // Worker requests sync status from the client
        this.getSyncStatusInternal().then((status) => {
          this.worker!.postMessage({
            type: "syncStatus",
            data: status,
            requestId,
          });
        });
      } else if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve } = this.pendingRequests.get(requestId)!;
        resolve(data);
        this.pendingRequests.delete(requestId);
      }
    };
    // Start the worker’s polling loop
    this.sendRequest("start");
  }

  /** Request to ckb light client web worker */
  private sendRequest(command: string): Promise<any> {
    if (!this.worker) throw new Error("Worker not initialized");
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7);
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage({ command, requestId });
    });
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

  /* Helper to infer start block based on sphincs+ pub key */
  private async inferStartBlock(storeKey: string): Promise<bigint> {
    let startStr = localStorage.getItem(storeKey);
    let start: bigint = BigInt(0);
    if (startStr === null) {
      const tipHeader = await this.client!.getTipHeader();
      startStr = tipHeader.number.toString();
    }
    start = BigInt(parseInt(startStr));
    return start;
  }

  /**
   * This function tells the light client which account and from what block they start making transactions.
   * @param spxPubKey The sphincs+ publickey representing a sphincs+ account in your DB.
   * @param firstAccount Is this the first account to be generated in your wallet?
   * @param startingBlock The starting block to be set. Inferred as tip/0 block by default. TODO correct
   * @returns The transaction hash(id).
   * @throws Error light client is not initialized.
   */
  public async setSellectiveSyncFilter(
    spxPubKey: string,
    firstAccount: boolean,
    startingBlock?: bigint
  ): Promise<void> {
    if (!this.client) throw new Error("Light client not initialized");

    const lock = this.getLock(spxPubKey);
    const storageKey = QuantumPurse.START_BLOCK + "-" + spxPubKey;
    let start: bigint = BigInt(0);
    if (startingBlock !== undefined) {
      start = startingBlock;
    } else {
      start = await this.inferStartBlock(storageKey);
    }
    
    localStorage.setItem(storageKey, start.toString());
    
    this.client.setScripts(
      [{ blockNumber: start, script: lock, scriptType: "lock" }],
      firstAccount ? LightClientSetScriptsCommand.All : LightClientSetScriptsCommand.Partial
    );
  }

  /* Calculate sync status */
  private async getSyncStatusInternal() {
    if (!this.client) throw new Error("Light client not initialized");

    // accountPointer can be not ready when this pool loop starts
    if (!this.accountPointer) return;
    
    const lock = this.getLock();
    const storeKey = QuantumPurse.START_BLOCK + "-" + this.accountPointer;

    const [localNodeInfo, scripts, tipHeader, startBlockBigint] = await Promise.all([
      this.client.localNodeInfo(),
      this.client.getScripts(),
      this.client.getTipHeader(),
      this.inferStartBlock(storeKey)
    ]);

    const tipBlock = Number(tipHeader.number);
    const startBlock = Number(startBlockBigint);
    const script = scripts.find((script) => script.script.args === lock.args);
    const syncedBlock = Number(script?.blockNumber ?? 0);
    const syncedStatus = ((syncedBlock - startBlock) / (tipBlock - startBlock)) * 100;

    return {
      nodeId: localNodeInfo.nodeId,
      connections: localNodeInfo.connections,
      syncedBlock,
      tipBlock,
      syncedStatus,
      startBlock
    };
  }

  /**
   * This function reads sync status from the status worker
   * @returns The node info and sync status.
   */
  public async getSyncStatusFromWorker() {
    return this.sendRequest("getSyncStatus");
  }

  /* Start light client thread*/
  private async startLightClient() {
    if (this.client !== undefined) return;

    let secretKey = localStorage.getItem(QuantumPurse.CLIENT_ID);
    if (!secretKey) {
      secretKey = randomSecretKey();
      if (secretKey) {
        localStorage.setItem(QuantumPurse.CLIENT_ID, secretKey);
      } else {
        throw new Error("Failed to generate a secret key.");
      }
    }

    this.client = new LightClient();
    const config = await (await fetch(networkConfig)).text();
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
   * Gets the CKB lock script.
   * @param spxPubKey - The sphincs+ public key to get a lock script from.
   * @returns The CKB lock script (an asset lock in CKB blockchain).
   * @throws Error if no account pointer is set by default.
   */
  public getLock(spxPubKey?: string): Script {
    const accPointer =
      spxPubKey !== undefined ? spxPubKey : this.accountPointer;
    if (!accPointer || accPointer === "") {
      throw new Error("Account pointer not available!");
    }

    const hasher = new CKBSphincsPlusHasher();
    hasher.update("0x" + this.spxAllInOneSetupHashInput());
    hasher.update(
      "0x" +
        ((parseInt(QuantumPurse.LOCK_FLAGS, 16) >> 1) << 1)
          .toString(16)
          .padStart(2, "0")
    );
    hasher.update("0x" + accPointer);

    return {
      codeHash: this.sphincsLock.codeHash,
      hashType: this.sphincsLock.hashType,
      args: hasher.digestHex(),
    };
  }

  /**
   * Gets the blockchain address.
   * @param spxPubKey - The sphincs+ public key to get an address from.
   * @returns The CKB address as a string.
   * @throws Error if no account pointer is set by default (see `getLock` for details).
   */
  public getAddress(spxPubKey?: string): string {
    const lock = this.getLock(spxPubKey);
    return scriptToAddress(lock, IS_MAIN_NET);
  }

  /**
   * Gets account balance via light client protocol.
   * @param spxPubKey - The sphincs+ public key to get an address from which balance is retrieved, via light client.
   * @returns The account balance.
   * @throws Error light client is not initialized.
   */
  public async getBalance(spxPubKey?: string): Promise<bigint> {
    if (!this.client) throw new Error("Light client not initialized");

    const lock = this.getLock(spxPubKey);
    const searchKey: ClientIndexerSearchKeyLike = {
      scriptType: "lock",
      script: lock,
      scriptSearchMode: "prefix",
    };
    const capacity = await this.client.getCellsCapacity(searchKey);
    return capacity;
  }

  /**
   * Signs a Nervos CKB transaction using the SPHINCS+ signature scheme.
   * @param tx - The transaction skeleton to sign.
   * @param password - The password to decrypt the private key (will be zeroed out after use).
   * @param spxPubKey - The sphincs+ public key to get a lock script from.
   * @returns A promise resolving to the signed transaction.
   * @throws Error if no account is set or decryption fails.
   * @remark The password is overwritten with zeros after use.
   */
  public async sign(
    tx: TransactionSkeletonType,
    password: Uint8Array,
    spxPubKey?: string
  ): Promise<Transaction> {
    try {
      const accPointer = spxPubKey !== undefined ? spxPubKey : this.accountPointer;
      if (!accPointer || accPointer === "") {
        throw new Error("Account pointer not available!");
      }

      const witnessLen = QuantumPurse.SPX_SIG_LEN + hexToByteArray(accPointer).length;
      tx = insertWitnessPlaceHolder(tx, witnessLen);
      tx = prepareSigningEntries(tx);
      const entry = tx.get("signingEntries").toArray();
      const spxSig = await KeyVault.sign(password, accPointer, hexToByteArray(entry[0].message));
      const spxSigHex = new Reader(spxSig.buffer as ArrayBuffer).serializeJson();
      const fullCkbQrSig =
        this.spxAllInOneSetupHashInput() +
        QuantumPurse.LOCK_FLAGS +
        accPointer +
        spxSigHex.replace(/^0x/, "");

      return sealTransaction(tx, ["0x" + fullCkbQrSig]);
    } finally {
      password.fill(0);
    }
  }

  /* Clears all local data of the wallet. */
  public async deleteWallet(): Promise<void> {
    localStorage.removeItem(QuantumPurse.CLIENT_ID);
    const accList = await this.getAllAccounts();
    accList.forEach((acc) => {
      localStorage.removeItem(QuantumPurse.START_BLOCK + "-" + acc);
    });
    await Promise.all([
      KeyVault.clear_database(),
      this.client!.stop()
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
      const [accList, sphincs_pub] = await Promise.all([
        this.getAllAccounts(),
        KeyVault.gen_new_key_pair(password)
      ]);  
      await this.setSellectiveSyncFilter(sphincs_pub, (accList.length === 0));
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
      await KeyVault.import_seed_phrase(seedPhrase, password);
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

  /* init light client and status worker */
  public async initLightClient(): Promise<void> {
    await this.startLightClient();
    await this.fetchSphincsPlusCellDeps();
    this.startClientSyncStatusWorker();
  }

  /**
   * QuantumPurse wallet initialization for wasm code init, key-vault, light-client and light-client status worker.
   * @param password - The password to encrypt the seed (will be zeroed out) in key-vault initilization.
   * @remark The password is overwritten with zeros after use.
   */
  public async initSeedPhrase(password: Uint8Array): Promise<void> {
    try {
      await KeyVault.key_init(password);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Retrieve all sphincs plus public keys from all child accounts in the indexed DB.
   * @returns An ordered array of all child key's sphincs plus public keys.
   */
  public async getAllAccounts(): Promise<string[]> {
    return await KeyVault.get_all_sphincs_pub();
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
      const list = await KeyVault.gen_account_batch(password, startIndex, count);
      return list;
    } finally {
      password.fill(0);
    }
  }

  /**
   * Retrieve a list of on-the-fly sphincs+ public key for wallet recovery process.
   * @param password - The password to decrypt the master seed (will be zeroed out).
   * @param count - The number of keys to search for.
   * @remark The password is overwritten with zeros after use.
   */
  public async recoverAccounts(
    password: Uint8Array,
    count: number
  ): Promise<void> {
    try {
      await KeyVault.recover_accounts(password, count);
    } finally {
      password.fill(0);
    }
  }
}
