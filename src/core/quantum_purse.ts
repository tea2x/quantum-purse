// QuantumPurse.ts
import {
  CKB_INDEXER_URL,
  NODE_URL,
  IS_MAIN_NET,
  SPHINCSPLUS_LOCK,
} from "./config";
import {
  hexToInt,
  insertWitnessPlaceHolder,
  prepareSphincsPlusSigningEntries,
  hexStringToUint8Array,
} from "./utils";
import { Reader } from "ckb-js-toolkit";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";
import { CellCollector, Indexer } from "@ckb-lumos/ckb-indexer";
import { Script, HashType, Transaction } from "@ckb-lumos/base";
import { CKBIndexerQueryOptions } from "@ckb-lumos/ckb-indexer/src/type";
import { TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import __wbg_init, {
  KeyVault,
  Util as KeyVaultUtil,
} from "../../key-vault/pkg/key_vault";
import { CKBSphincsPlusHasher } from "./hasher";

/**
 * Manages a wallet using the SPHINCS+ post-quantum signature scheme (shake-128f simple)
 * on the Nervos CKB blockchain. This class provides functionality for generating accounts, signing transactions,
 * managing seed phrases, and interacting with the blockchain.
 */
export default class QuantumPurse {
  private MULTISIG_ID = "80";
  private REQUIRE_FISRT_N = "00";
  private THRESHOLD = "01";
  private PUBKEY_NUM = "01"; // 1 pubkey (personal lock)
  /*             6d
   *-----------------------------
   *   [0110110]  |      [1]
   *-----------------------------
   * shake128f-id | signature-flag
   */
  private QR_LOCK_FLAGS = "6d";
  private SPX_SIG_LEN: number = 17088;
  private static instance: QuantumPurse | null = null;

  public accountPointer?: string; // a sphincs+ public key
  public sphincsLock: { codeHash: string; hashType: HashType };

  /** Constructor that takes sphincs+ on-chain binary deployment info */
  private constructor(sphincsCodeHash: string, sphincsHashType: HashType) {
    this.sphincsLock = { codeHash: sphincsCodeHash, hashType: sphincsHashType };
  }

  /** Conjugate the first 4 bytes of the witness.lock for the hasher */
  private spxAllInOneSetupHashInput(): string {
    return (
      this.MULTISIG_ID + this.REQUIRE_FISRT_N + this.THRESHOLD + this.PUBKEY_NUM
    );
  }

  /**
   * Gets the singleton instance of QuantumPurse.
   * @returns The singleton instance of QuantumPurse.
   */
  public static async getInstance(): Promise<QuantumPurse> {
    if (!QuantumPurse.instance) {
      await __wbg_init();
      QuantumPurse.instance = new QuantumPurse(
        SPHINCSPLUS_LOCK.codeHash,
        SPHINCSPLUS_LOCK.hashType as HashType
      );
    }
    return QuantumPurse.instance;
  }

  /**
   * Gets the CKB lock script.
   * @param sphincsPlusPubKey - The sphincs+ public key to get a lock script from.
   * @returns The CKB lock script (an asset lock in CKB blockchain).
   * @throws Error if no account pointer is set by default.
   */
  public getLock(sphincsPlusPubKey?: string): Script {
    const accPointer =
      sphincsPlusPubKey !== undefined ? sphincsPlusPubKey : this.accountPointer;
    if (!accPointer || accPointer === "") {
      throw new Error("Account pointer not available!");
    }

    const hasher = new CKBSphincsPlusHasher();
    hasher.update("0x" + this.spxAllInOneSetupHashInput());
    hasher.update(
      "0x" +
        ((parseInt(this.QR_LOCK_FLAGS, 16) >> 1) << 1)
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
   * @param sphincsPlusPubKey - The sphincs+ public key to get an address from.
   * @returns The CKB address as a string.
   * @throws Error if no account pointer is set by default (see `getLock` for details).
   */
  public getAddress(sphincsPlusPubKey?: string): string {
    const lock = this.getLock(sphincsPlusPubKey);
    return scriptToAddress(lock, IS_MAIN_NET);
  }

  /**
   * Calculates the wallet's balance on the Nervos CKB blockchain.
   * @param sphincsPlusPubKey - The sphincs+ public key to get an address from which a balance is retrieved.
   * @returns A promise resolving to the balance in BigInt (in shannons).
   * @throws Error if no account is set (see `getLock` for details).
   */
  public async getBalance(sphincsPlusPubKey?: string): Promise<bigint> {
    const lock =
      sphincsPlusPubKey !== undefined
        ? this.getLock(sphincsPlusPubKey)
        : this.getLock();
    const query: CKBIndexerQueryOptions = {
      lock: lock,
      type: "empty",
    };
    const cellCollector = new CellCollector(
      new Indexer(CKB_INDEXER_URL, NODE_URL),
      query
    );
    let balance = BigInt(0);

    for await (const cell of cellCollector.collect()) {
      balance += hexToInt(cell.cellOutput.capacity);
    }
    return balance;
  }

  /**
   * Signs a Nervos CKB transaction using the SPHINCS+ signature scheme.
   * @param tx - The transaction skeleton to sign.
   * @param password - The password to decrypt the private key (will be zeroed out after use).
   * @param sphincsPlusPubKey - The sphincs+ public key to get a lock script from.
   * @returns A promise resolving to the signed transaction.
   * @throws Error if no account is set or decryption fails.
   * @remark The password and sensitive data are overwritten with zeros after use.
   */
  public async sign(
    tx: TransactionSkeletonType,
    password: Uint8Array,
    sphincsPlusPubKey?: string
  ): Promise<Transaction> {
    const accPointer =
      sphincsPlusPubKey !== undefined ? sphincsPlusPubKey : this.accountPointer;
    if (!accPointer || accPointer === "") {
      password.fill(0);
      throw new Error("Account pointer not available!");
    }

    const witnessLen =
      this.SPX_SIG_LEN + hexStringToUint8Array(accPointer).length;
    tx = insertWitnessPlaceHolder(tx, witnessLen);
    tx = prepareSphincsPlusSigningEntries(tx);

    const signingEntries = tx.get("signingEntries").toArray();

    const spxSig = await KeyVault.sign(
      password,
      accPointer,
      hexStringToUint8Array(signingEntries[0].message)
    );
    const serializedSpxSig = new Reader(spxSig.buffer).serializeJson();

    const fullCkbQrSig =
      "0x" +
      this.spxAllInOneSetupHashInput() +
      this.QR_LOCK_FLAGS +
      accPointer +
      serializedSpxSig.replace(/^0x/, "");

    password.fill(0);
    return sealTransaction(tx, [fullCkbQrSig]);
  }

  /**
   * Clears all data from a specific store in IndexedDB.
   * @returns A promise that resolves when the store is cleared.
   */
  public async dbClear(): Promise<void> {
    await KeyVault.clear_database();
  }

  /**
   * Generates a new account derived from the master seed.
   * @param password - The password to decrypt the master seed and encrypt the child key (will be zeroed out).
   * @returns A promise that resolves when the account is generated and set.
   * @throws Error if the master seed is not found or decryption fails.
   * @remark The password should be overwritten with zeros after use.
   */
  public async genAccount(password: Uint8Array): Promise<void> {
    const sphincs_pub = await KeyVault.gen_new_key_pair(password);
    password.fill(0);
  }

  /**
   * Sets the account pointer (There can be many sub/child accounts in db).
   * @param accPointer - The SPHINCS+ public key (as a pointer to the encrypted privatekey in DB) to set.
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
    return KeyVaultUtil.password_checker(password);
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
    await KeyVault.import_seed_phrase(seedPhrase, password);
    password.fill(0);
    seedPhrase.fill(0);
  }

  /**
   * Exports the wallet's seed phrase.
   * @param password - The password to decrypt the seed (will be zeroed out).
   * @returns A promise resolving to the seed phrase as a Uint8Array.
   * @throws Error if the master seed is not found or decryption fails.
   * @remark The password is overwritten with zeros after use. Handle the returned seed carefully to avoid leakage.
   */
  public async exportSeedPhrase(password: Uint8Array): Promise<Uint8Array> {
    const seed = await KeyVault.export_seed_phrase(password);
    password.fill(0);
    return seed;
  }

  /**
   * QuantumPurse wallet initialization for the master seed phrase.
   * @param password - The password to decrypt the seed (will be zeroed out).
   * @remark The password is overwritten with zeros after use. Handle the returned seed carefully to avoid leakage.
   */
  public async init(password: Uint8Array): Promise<void> {
    await KeyVault.key_init(password);
    password.fill(0);
  }

  /**
   * Retrieve all sphincs plus public keys from all child accounts in the indexed DB.
   * @returns An ordered array of all child key's sphincs plus public keys.
   */
  public async getAllAccounts(): Promise<string[]> {
    return await KeyVault.get_all_sphincs_pub();
  }
}
