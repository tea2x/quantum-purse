// QuantumPurse.ts
import { IS_MAIN_NET, SPHINCSPLUS_LOCK, NERVOS_DAO, FEE_RATE } from "./config";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";
import { Address, DepType } from "@ckb-lumos/base";
import { addressToScript } from "@ckb-lumos/helpers";
import __wbg_init, { KeyVault, Util as KeyVaultUtil, SphincsVariant } from "quantum-purse-key-vault";
import { randomSecretKey, LightClientSetScriptsCommand, ScriptStatus } from "ckb-light-client-js";
import Worker from "worker-loader!../../light-client/status_worker.js";
import testnetConfig from "../../light-client/network.test.toml";
import mainnetConfig from "../../light-client/network.main.toml";
import { ClientIndexerSearchKeyLike, Hex, ccc, Cell, HashType, ScriptLike, Script } from "@ckb-ccc/core";
import { Config, predefined, initializeConfig } from "@ckb-lumos/config-manager";
import { getClaimEpoch, getProfit } from "./epoch";
import { QPSigner } from "./ccc-adapter/signer";

export { SphincsVariant } from "quantum-purse-key-vault";

/**
 * Manages a wallet using the SPHINCS+ post-quantum signature scheme on the Nervos CKB blockchain.
 * This class provides functionality for generating accounts, signing transactions,
 * managing cryptographic keys, and interacting with the blockchain.
 */
export default class QuantumPurse extends QPSigner {
  //**************************************************************************************//
  //*********************************** ATRIBUTES ****************************************//
  //**************************************************************************************//
  private static instance?: QuantumPurse;
  private hasClientStarted: boolean = false;
  
  /* CKB light client status worker */
  private worker: Worker | undefined;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }
  > = new Map();
  private syncStatusListeners: Set<(status: any) => void> = new Set();
  private static readonly CLIENT_SECRET = "ckb-light-client-wasm-secret-key";
  private static readonly START_BLOCK = "ckb-light-client-wasm-start-block";
  /* Account management */
  public static accountPointer?: string; // Is a sphincs+ lock script argument

  //**************************************************************************************//
  //*************************************** METHODS **************************************//
  //**************************************************************************************//
  /** Constructor that takes sphincs+ on-chain binary deployment info */
  private constructor(
    getPassword: () => Uint8Array,
    scriptInfo: ScriptLike
  ) {
    super(getPassword, scriptInfo);
  }

  /* init light client and status worker */
  private async initLightClient(): Promise<void> {
    await this.startLightClient();
    await this.fetchSphincsPlusCellDeps();
    this.startClientSyncStatusWorker();
  }

  /** Initialize web worker to poll the sync status from the ckb light client */
  private startClientSyncStatusWorker() {
    if (this.worker !== undefined) return;

    this.worker = new Worker();
    this.worker!.onmessage = (event) => {
      const { command, data, requestId, type } = event.data;
      if (command === "getSyncStatus") {
        this.getSyncStatus().then((status) => {
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
    spxLockArgs: Hex,
    firstAccount: boolean
  ): Promise<void> {
    if (!this.hasClientStarted) {
      console.error("Light client has not initialized");
      return Promise.resolve();
    }

    const lock = this.getLockScript(spxLockArgs);
    const storageKey = QuantumPurse.START_BLOCK + "-" + spxLockArgs;
    let startingBlock: bigint = (await this.client!.getTipHeader()).number;

    localStorage.setItem(storageKey, startingBlock.toString());

    await this.client.setScripts(
      [{ blockNumber: startingBlock, script: lock, scriptType: "lock" }],
      firstAccount ? LightClientSetScriptsCommand.All : LightClientSetScriptsCommand.Partial
    );
  }

  /* Calculate sync status */
  private async getSyncStatus() {
    if (!this.hasClientStarted) {
      console.error("Light client has not initialized");
      return {
        nodeId: "NULL",
        connections: 0,
        syncedBlock: 0,
        tipBlock: 0,
        syncedStatus: 0,
        startBlock: 0
      };
    }

    const [localNodeInfo, scripts, tipHeader] = await Promise.all([
      this.client.localNodeInfo(),
      this.client.getScripts(),
      this.client.getTipHeader(),
    ]);

    const tipBlock = Number(tipHeader.number);
    /* When wallet/accounts may not be created yet(accountPointer not available),
    light client connection and tipBlock can still be shown to let users know */
    if (!QuantumPurse.accountPointer) return {
      nodeId: localNodeInfo.nodeId,
      connections: localNodeInfo.connections,
      syncedBlock: 0,
      tipBlock: tipBlock,
      syncedStatus: 0,
      startBlock: 0
    };

    const lock = this.getLockScript();
    const storeKey = QuantumPurse.START_BLOCK + "-" + QuantumPurse.accountPointer;
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
    if (this.hasClientStarted) return;

    let secretKey = localStorage.getItem(QuantumPurse.CLIENT_SECRET);
    if (!secretKey) {
      secretKey = randomSecretKey();
      if (secretKey) {
        localStorage.setItem(QuantumPurse.CLIENT_SECRET, secretKey);
      } else {
        throw new Error("Failed to generate a secret key.");
      }
    }

    try {
      const config = IS_MAIN_NET
        ? await (await fetch(mainnetConfig)).text()
        : await (await fetch(testnetConfig)).text();
      await this.client.start(
        { type: IS_MAIN_NET ? "MainNet" : "TestNet", config },
        secretKey as Hex,
        "info",
        "wss"
      );
      this.hasClientStarted = true;
    } catch (error) {
      console.error("Failed to start light client:", error);
    }
  }

  /* Fetch the sphincs+ celldeps to the light client in quantumPurse wallet setup */
  private async fetchSphincsPlusCellDeps() {
    if (!this.hasClientStarted) {
      console.error("Light client has not initialized");
      return;
    }
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
        () => new Uint8Array(0), // dummy password getter, to be updated
        {
          codeHash: SPHINCSPLUS_LOCK.codeHash,
          hashType: SPHINCSPLUS_LOCK.hashType,
          args: this.accountPointer as string 
        } as ScriptLike
      );
    }
    return QuantumPurse.instance;
  }

  /* init background service such as wasm bind-gen init code and light client*/
  public async initBackgroundServices(): Promise<void> {
    await this.initKeyVaultWBG();
    await this.initLightClient();
  }

  /**
   * Init(and reinit) the Key Vault from QPSigner with a pre-determined SPHINCS variant.
   * @param variant The SPHINCS+ parameter set to start with
   * @returns void.
   */
  public initKeyVault(variant: SphincsVariant) {
    this.initKeyVaultCore(variant);
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
   * Helper function tells the light client which account and from what block they start making transactions.
   * @param spxLockArgsArray The sphincs+ lock script arguments array (each correspond to 1 sphincs+ accounts in your DB).
   * @param startingBlocks The starting block array corresponding to the spxLockArgsArray to be set.
   * @param setMode The mode to set the scripts (All, Partial, Delete).
   * @throws Error light client is not initialized.
   */
  public async setSellectiveSyncFilter(spxLockArgsArray: Hex[], startingBlocks: bigint[], setMode: LightClientSetScriptsCommand) {
    if (!this.hasClientStarted) throw new Error("Light client has not initialized");

    if (spxLockArgsArray.length !== startingBlocks.length) {
      throw new Error("Length of spxLockArgsArray and startingBlocks must be the same");
    }

    for (let i = 0; i < spxLockArgsArray.length; i++) {
      const storageKey = QuantumPurse.START_BLOCK + "-" + spxLockArgsArray[i];
      localStorage.setItem(storageKey, startingBlocks[i].toString());
    }

    const filters: ScriptStatus[] = spxLockArgsArray.map((spxLockArgs, index) => ({
      blockNumber: startingBlocks[index],
      script: this.getLockScript(spxLockArgs),
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
  public getLockScript(spxLockArgs?: Hex): ScriptLike {
    const accPointer =
      spxLockArgs !== undefined ? spxLockArgs : QuantumPurse.accountPointer;
    if (!accPointer || accPointer === "") {
      throw new Error("Account pointer not available!");
    }

    if (!this.keyVault) throw new Error("KeyVault not initialized!");

    return {
      codeHash: this.account.codeHash,
      hashType: this.account.hashType,
      args: "0x" + accPointer,
    };
  }

  /**
   * Gets the blockchain address.
   * @param spxLockArgs - The sphincs+ lock script arguments.
   * @returns The CKB address as a string.
   * @throws Error if no account pointer is set by default (see `getLockScript` for details).
   */
  public getAddress(spxLockArgs?: Hex): string {
    const lock = this.getLockScript(spxLockArgs);
    return scriptToAddress(Script.from(lock), IS_MAIN_NET);
  }

  /**
   * Gets account balance via light client protocol.
   * @param spxLockArgs - The sphincs+ lock script argument to form an address from which balance is retrieved, via light client.
   * @returns The account balance.
   * @throws Error light client is not initialized.
   */
  public async getBalance(spxLockArgs?: Hex): Promise<bigint> {
    if (!this.hasClientStarted) {
      console.error("Light client has not initialized");
      return Promise.resolve(BigInt(0));
    }

    const lock = this.getLockScript(spxLockArgs);
    const searchKey: ClientIndexerSearchKeyLike = {
      scriptType: "lock",
      script: lock,
      scriptSearchMode: "prefix"
    };
    const capacity = await this.client.getCellsCapacity(searchKey);
    return capacity;
  }

  /* Clears all local data of the wallet. */
  public async deleteWallet(): Promise<void> {
    const spxLockArgsList = await this.getAllLockScriptArgs();
    spxLockArgsList.forEach((lockArgs) => {
      localStorage.removeItem(QuantumPurse.START_BLOCK + "-" + lockArgs);
    });
    QuantumPurse.accountPointer = undefined;
    await KeyVault.clear_database();
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
      const [lockArgsList, lockArgs] = await Promise.all([
        this.getAllLockScriptArgs(),
        this.keyVault.gen_new_account(password)
      ]);
      await this.setSellectiveSyncFilterInternal(lockArgs as Hex, (lockArgsList.length === 0));
      return lockArgs;
    } finally {
      password.fill(0);
    }
  }

  /**
   * Sets the account pointer (There can be many sub/child accounts in db but at a time Quantum Purse will show just 1).
   * @param accPointer - The SPHINCS+ lock script argument (as a pointer to the encrypted privatekey in DB) to set.
   * @throws Error if the account to be set is not in the DB.
   */
  public async setAccountPointer(accPointer: string): Promise<void> {
    const lockArgsList = await this.getAllLockScriptArgs();
    if (!lockArgsList.includes(accPointer)) throw Error("Invalid account pointer");
    QuantumPurse.accountPointer = accPointer;
  }

  /**
   * Calculates the entropy of an alphabetical password in bits.
   * @param password - The password as a Uint8Array (UTF-8 encoded). Will be zeroed out after processing.
   * @param threshold - The lower bound entropy threshold in bit security.
   * @returns The entropy in bits (e.g., 1, 2, 128, 256, 444, etc.), or 0 for invalid/empty input.
   * @remark The input password is overwritten with zeros after calculation.
   */
  public static checkPassword(password: Uint8Array, threshold: number): number {
    try {
      return KeyVaultUtil.password_checker(password, threshold);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Imports a seed phrase and stores the encrypted seed in IndexedDB, overwriting any existing seed.
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
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      const mnemonic = await this.keyVault.export_seed_phrase(password);
      return mnemonic;
    } finally {
      password.fill(0);
    }
  }

  /**
   * generate a master seed in DB.
   * @param password - The password to encrypt the master seed phrase.
   * @remark The password is overwritten with zeros after use.
   */
  public async generateMasterSeed(password: Uint8Array): Promise<void> {
    try {
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      await this.keyVault.generate_master_seed(password);
    } finally {
      password.fill(0);
    }
  }

  /**
   * Retrieve all sphincs+ lock script arguments from all child accounts in the indexed DB.
   * @returns An ordered array of all child key's sphincs+ lock script argument.
   */
  public async getAllLockScriptArgs(): Promise<string[]> {
    return await KeyVault.get_all_sphincs_lock_args();
  }

  /**
   * Retrieve a list of on-the-fly sphincs+ lock script arguments for wallet recovery process.
   * @param password - The password to decrypt the master seed (will be zeroed out).
   * @param startIndex - The index to start searching from.
   * @param count - The number of keys to search for.
   * @returns An ordered array of all child key's sphincs+ lock script arguments.
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
      if (!this.keyVault) throw new Error("KeyVault not initialized!");
      const spxLockArgsList = await this.keyVault.recover_accounts(password, count) as Hex[];

      if (!this.hasClientStarted) {
        console.error("Light client has not initialized");
        return Promise.resolve();
      }

      const startBlocksPromises = spxLockArgsList.map(async (lockArgs) => {
        const lock = this.getLockScript(lockArgs);
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
      await this.setSellectiveSyncFilter(spxLockArgsList, startBlocks, LightClientSetScriptsCommand.All);
    } finally {
      password.fill(0);
    }
  }

  /**
   * CKB transfer.
   *
   * @param from - The sender's address.
   * @param to - The recipient's address.
   * @param amount - The amount to transfer in CKB.
   * @returns A Promise that resolves to a transaction hash when successful.
   * @throws Error if Light client is not ready / insufficient balance.
   */
  public async transfer(
    from: Address,
    to: Address,
    amount: string
  ): Promise<Hex> {
    if (!this.hasClientStarted) throw new Error("Light client has not initialized");

    const tx = ccc.Transaction.from({
      outputs: [{ lock: (await ccc.Address.fromString(to, this.client)).script, capacity: ccc.fixedPointFrom(amount) }],
    });
    
    // cell deps
    tx.addCellDeps([
      {
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      }
    ]);

    await tx.completeInputsByCapacity(this);
    await tx.completeFeeBy(this, FEE_RATE);
    const hash = await this.sendTransaction(tx);
    return hash;
  }

  /**
   * Nervos DAO deposit.
   * See https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md#deposit
   * Reusing codes from NERVDAO project https://github.com/ckb-devrel/nervdao.
   *
   * @param from - The sender's address.
   * @param to - The recipient's address.
   * @param amount - The amount to deposit in CKB.
   * @returns A Promise that resolves to a transaction hash when successful.
   * @throws Error if Light client is not ready / insufficient balance.
   */
  public async daoDeposit(
    from: Address,
    to: Address,
    amount: string
  ): Promise<Hex> {
    if (!this.hasClientStarted) throw new Error("Light client has not initialized");

    // initialize configuration
    let configuration: Config = IS_MAIN_NET ? predefined.LINA : predefined.AGGRON4;
    initializeConfig(configuration);

    const tx = ccc.Transaction.from({
      outputs: [
        {
          lock: addressToScript(to),
          type: {
            codeHash: NERVOS_DAO.codeHash,
            hashType: NERVOS_DAO.hashType as HashType,
            args: "0x",
          },
        },
      ],
      outputsData: ["00".repeat(8)],
    });

    if (tx.outputs[0].capacity > ccc.fixedPointFrom(amount)) {
      throw(Error("Minimal deposit amount is " + ccc.fixedPointToString(tx.outputs[0].capacity)));
    }
    tx.outputs[0].capacity = ccc.fixedPointFrom(amount);

    // cell deps
    tx.addCellDeps([
      {
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      },
      {
        outPoint: NERVOS_DAO.outPoint,
        depType: NERVOS_DAO.depType as DepType,
      }
    ]);

    await tx.completeInputsByCapacity(this);
    await tx.completeFeeBy(this, FEE_RATE);
    const hash = await this.sendTransaction(tx);
    return hash;
  }

  /**
   * Nervos DAO withdraw request.
   * See https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md#withdraw-phase-1
   * Reusing codes from NERVDAO project https://github.com/ckb-devrel/nervdao.
   *
   * @param depositCell - The Nervos DAO deposit cell to make a withdraw request from.
   * @returns A Promise that resolves to a transaction hash when successful.
   * @throws Error if Light client is not ready / insufficient balance.
   * @notice This transaction has no transaction fee
   */
  public async daoWithdrawRequest(
    depositCell: Cell,
    depositBlockNumber: bigint,
    depositCellBlockHash: Hex
  ): Promise<Hex> {
    if (!this.hasClientStarted) throw new Error("Light client has not initialized");

    // initialize configuration
    let configuration: Config = IS_MAIN_NET ? predefined.LINA : predefined.AGGRON4;
    initializeConfig(configuration);

    const tx = ccc.Transaction.from({
      headerDeps: [depositCellBlockHash],
      inputs: [{ previousOutput: depositCell.outPoint }],
      outputs: [depositCell.cellOutput],
      outputsData: [ccc.numLeToBytes(depositBlockNumber, 8)],
    });

    // cell deps
    tx.addCellDeps([
      {
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      },
      {
        outPoint: NERVOS_DAO.outPoint,
        depType: NERVOS_DAO.depType as DepType,
      }
    ]);

    await tx.completeInputsByCapacity(this);
    await tx.completeFeeBy(this, FEE_RATE);
    const hash = await this.sendTransaction(tx);
    return hash;
  }

  /**
   * Nervos DAO unlock (withdraw phase2).
   * See https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md#withdraw-phase-2
   * Reusing codes from NERVDAO project https://github.com/ckb-devrel/nervdao.
   *
   * @param withdrawingCell - The Nervos DAO wightdrawing cell to be unlocked.
   * @param to - The recipient's address.
   * @param depositBlockHash - The block hash of the deposit cell.
   * @param withdrawingBlockHash - The block hash of the withdrawing cell.
   * @returns A Promise that resolves to a transaction hash when successful.
   * @throws Error if Light client is not ready / insufficient balance.
   * @notice This transaction has no transaction fee
   */
  public async daoUnlock(
    withdrawingCell: Cell,
    to: Address,
    depositBlockHash: Hex,
    withdrawingBlockHash: Hex
  ): Promise<Hex> {
    if (!this.hasClientStarted) throw new Error("Light client has not initialized");

    // initialize configuration
    let configuration: Config = IS_MAIN_NET ? predefined.LINA : predefined.AGGRON4;
    initializeConfig(configuration);

    const [depositBlockHeader, withdrawBlockHeader] = await Promise.all([
      this.client.getHeader(depositBlockHash),
      this.client.getHeader(withdrawingBlockHash),
    ]);

    const tx = ccc.Transaction.from({
      headerDeps: [withdrawingBlockHash, depositBlockHash],
      inputs: [
        {
          previousOutput: withdrawingCell.outPoint,
          since: {
            relative: "absolute",
            metric: "epoch",
            value: ccc.epochToHex(getClaimEpoch(depositBlockHeader!, withdrawBlockHeader!)),
          },
        },
      ],
      outputs: [
        {
          lock: addressToScript(to),
        },
      ],
      witnesses: [
        ccc.WitnessArgs.from({
          inputType: ccc.numLeToBytes(1, 8),
        }).toBytes(),
      ],
    });

    // cell deps
    tx.addCellDeps([
      {
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      },
      {
        outPoint: NERVOS_DAO.outPoint,
        depType: NERVOS_DAO.depType as DepType,
      }
    ]);

    await tx.completeInputsByCapacity(this);
    await tx.completeFeeChangeToOutput(this, 0, FEE_RATE);

    // adding output
    const outputCapacity = getProfit(withdrawingCell, depositBlockHeader!, withdrawBlockHeader!);
    tx.outputs[0].capacity += outputCapacity;

    const hash = await this.sendTransaction(tx);
    return hash;
  }
}
