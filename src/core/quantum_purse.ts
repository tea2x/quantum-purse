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
  uint8ArrayToHexString,
} from "./utils";
import { Reader } from "ckb-js-toolkit";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";
import { CellCollector, Indexer } from "@ckb-lumos/ckb-indexer";
import { Script, HashType, utils, Transaction } from "@ckb-lumos/base";
import { CKBIndexerQueryOptions } from "@ckb-lumos/ckb-indexer/src/type";
import { TransactionSkeletonType, sealTransaction } from "@ckb-lumos/helpers";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { slh_dsa_shake_128f } from "@noble/post-quantum/slh-dsa";
import __wbg_init, {
  KeyVault,
} from "../../key-vault/pkg/key_vault";

const { ckbHash } = utils;

/**
 * Manages a wallet using the SPHINCS+ post-quantum signature scheme (shake-128f simple)
 * on the Nervos CKB blockchain. Implements a singleton pattern to ensure a single instance.
 *
 * This class provides functionality for generating accounts, signing transactions,
 * managing seed phrases, and interacting with the blockchain.
 */
export default class QuantumPurse {
  static readonly SPX_SIG_LEN: number = 17088; // SPHINCS+ signature length
  private accountPointer?: string; // sphincs+ public key corresponding to the encrypted private key in DB
  private static instance: QuantumPurse | null = null; // Singleton instance

  public sphincsLock: { codeHash: string; hashType: HashType }; // SPHINCS+ lock script

  /** Constructor that takes sphincs+ on-chain binary deployment info */
  private constructor(sphincsCodeHash: string, sphincsHashType: HashType) {
    this.sphincsLock = { codeHash: sphincsCodeHash, hashType: sphincsHashType };
  }

  /**
   * Gets the singleton instance of QuantumPurse.
   * @returns The singleton instance of QuantumPurse.
   */
  public static async getInstance(): Promise<QuantumPurse> {
    await __wbg_init();
    if (!QuantumPurse.instance) {
      QuantumPurse.instance = new QuantumPurse(
        SPHINCSPLUS_LOCK.codeHash,
        SPHINCSPLUS_LOCK.hashType as HashType
      );
    }
    return QuantumPurse.instance;
  }

  /** Generates the ckb lock script for the current signer. */
  private getLock(): Script {
    if (!this.accountPointer) throw new Error("Signer not available!");
    return {
      codeHash: this.sphincsLock.codeHash,
      hashType: this.sphincsLock.hashType,
      args: ckbHash("0x" + this.accountPointer),
    };
  }

  /**
   * Gets the blockchain address for the current signer.
   * @returns The CKB address as a string.
   * @throws Error if no signer is set (see `getLock` for details).
   */
  public getAddress(): string {
    const lock = this.getLock();
    return scriptToAddress(lock, IS_MAIN_NET);
  }

  /**
   * Calculates the wallet's balance on the Nervos CKB blockchain.
   * @returns A promise resolving to the balance in BigInt (in shannons).
   * @throws Error if no signer is set (see `getLock` for details).
   */
  public async getBalance(): Promise<bigint> {
    const query: CKBIndexerQueryOptions = {
      lock: this.getLock(),
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
   * @returns A promise resolving to the signed transaction.
   * @throws Error if no signer is set or decryption fails.
   * @remark The password and sensitive data are overwritten with zeros after use.
   */
  public async sign(
    tx: TransactionSkeletonType,
    password: Uint8Array
  ): Promise<Transaction> {
    if (!this.accountPointer) throw new Error("Signer not available!");

    const witnessLen =
      QuantumPurse.SPX_SIG_LEN +
      hexStringToUint8Array(this.accountPointer).length;
    tx = insertWitnessPlaceHolder(tx, witnessLen);
    tx = prepareSphincsPlusSigningEntries(tx);

    const signingEntries = tx.get("signingEntries").toArray();

    const signature = await KeyVault.sign(password, this.accountPointer, hexStringToUint8Array(signingEntries[0].message));

    const serializedSignature = new Reader(signature.buffer).serializeJson();

    const witness =
      serializedSignature + this.accountPointer.replace(/^0x/, "");
    return sealTransaction(tx, [witness]);
  }

  /**
   * Generates a 24-word seed phrase with 256-bit security using BIP-39.
   * @returns A mnemonic seed phrase as a string.
   */
  public static generateSeedPhrase(): string {
    return bip39.generateMnemonic(wordlist, 256);
  }

  /**
   * Clears all data from a specific store in IndexedDB.
   * @returns A promise that resolves when the store is cleared.
   */
  public async dbClear(): Promise<void> {
    await KeyVault.clear_database();
  }

  /**
   * Generates a new account derived from the master seed and sets it as the current signer.
   * @param password - The password to decrypt the master seed and encrypt the child key (will be zeroed out).
   * @returns A promise that resolves when the account is generated and set.
   * @throws Error if the master seed is not found or decryption fails.
   * @remark The password should be overwritten with zeros after use.
   */
  public async genAccount(password: Uint8Array): Promise<void> {
    const sphincs_pub = await KeyVault.gen_new_key_pair(password);
    await this.setAccPointer(sphincs_pub);
    password.fill(0);
  }

  /**
   * Sets the account pointer (There can be many sub/child accounts in db).
   * @param accPointer - The SPHINCS+ public key (as a pointer to the encrypted privatekey in DB) to set.
   */
  public async setAccPointer(accPointer: string): Promise<void> {
    const accList = await this.getAllAccounts();
    if (!accList.includes(accPointer))
      throw(Error("Invalid account pointer"));
    this.accountPointer = accPointer;
  }

  /**
   * Calculates the entropy of an alphabetical password in bits.
   * @param password - The password as a Uint8Array (UTF-8 encoded). Will be zeroed out after processing.
   * @returns The entropy in bits (e.g., 1, 2, 128, 256, 444, etc.), or 0 for invalid/empty input.
   * @remark The input password is overwritten with zeros after calculation.
   */
  public static calculateEntropy(password: Uint8Array): number {
    if (!password || password.length === 0) {
      return 0;
    }

    const length = password.length;
    let hasLower = false,
      hasUpper = false,
      hasDigit = false,
      hasSymbol = false,
      hasNonAscii = false;
    for (let i = 0; i < length; i++) {
      const byte = password[i];
      if (byte >= 97 && byte <= 122) hasLower = true; // a-z
      else if (byte >= 65 && byte <= 90) hasUpper = true; // A-Z
      else if (byte >= 48 && byte <= 57) hasDigit = true; // 0-9
      else if (
        (byte >= 33 && byte <= 47) ||
        (byte >= 58 && byte <= 64) ||
        (byte >= 91 && byte <= 96) ||
        (byte >= 123 && byte <= 126)
      )
        hasSymbol = true; // !-/ : @-` {~}
      else if (byte > 127) hasNonAscii = true; // UTF-8 multi-byte
    }

    let poolSize = 0;
    if (hasLower) poolSize += 26; // Lowercase
    if (hasUpper) poolSize += 26; // Uppercase
    if (hasDigit) poolSize += 10; // Digits
    if (hasSymbol) poolSize += 32; // Symbols

    if (poolSize === 0) {
      poolSize = 1; // Minimum pool for all-same or uncategorized bytes (e.g., "aaa")
    }
    if (hasNonAscii) {
      poolSize = Math.max(poolSize, 94); // Minimum for full printable ASCII
      poolSize = Math.min(poolSize, 256); // Cap at byte max for UTF-8
    }

    const entropy = Math.floor(length * Math.log2(poolSize));
    password.fill(0);
    return entropy;
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
  
  public async init(password: Uint8Array) {
    await KeyVault.key_init(password);
    password.fill(0);
  }

  public async getAllAccounts():Promise<string[]> {
    return await KeyVault.get_all_sphincs_pub();
  }
}
