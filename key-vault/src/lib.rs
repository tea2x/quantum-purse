//! # QuantumPurse KeyVault
//!
//! This module provides a secure authentication interface for managing cryptographic keys in
//! QuantumPurse using WebAssembly. It leverages AES-GCM for encryption, Scrypt for key derivation,
//! and the SPHINCS+ signature scheme for post-quantum transaction signing. Sensitive data, including
//! the BIP39 mnemonic and derived SPHINCS+ private keys, is encrypted and stored in the browser via
//! IndexedDB, with access authenticated by user-provided passwords. The module supports generating
//! a BIP39 mnemonic, storing it encrypted, deriving SPHINCS+ child key pairs from the mnemonic using
//! Scrypt with the mnemonic as the password and a derivation path as the salt, and signing messages
//! with the SPHINCS+ private keys.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use bip39::{Language, Mnemonic};
use fips205::slh_dsa_shake_128f;
use fips205::traits::{SerDes, Signer};
use getrandom::getrandom;
use hex::{decode, encode};
use indexed_db_futures::{
    database::Database, error::Error as DBError, iter::ArrayMapIter, prelude::*,
    transaction::TransactionMode,
};
use rand_chacha::rand_core::SeedableRng;
use scrypt::{scrypt, Params};
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen;
use wasm_bindgen::{prelude::*, JsValue};
use web_sys::js_sys::Uint8Array;
use zeroize::Zeroize;

mod errors;
use crate::errors::KeyVaultError;

#[macro_export]
macro_rules! debug {
    ($($arg:tt)*) => {
        web_sys::console::log_1(&format!($($arg)*).into());
    }
}

/// Represents an encrypted payload containing salt, IV, and ciphertext, all hex-encoded.
///
/// **Fields**:
/// - `salt: String` - Hex-encoded salt used for key derivation with Scrypt.
/// - `iv: String` - Hex-encoded initialization vector (nonce) for AES-GCM encryption.
/// - `cipher_text: String` - Hex-encoded encrypted data produced by AES-GCM.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CipherPayload {
    salt: String,
    iv: String,
    cipher_text: String,
}

/// Represents a SPHINCS+ key pair with the public key and an encrypted private key.
///
/// **Fields**:
/// - `pub_key: String` - Hex-encoded SPHINCS+ public key.
/// - `pri_enc: CipherPayload` - Encrypted SPHINCS+ private key, stored as a `CipherPayload`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SphincsPlusKeyPair {
    pub_key: String,
    pri_enc: CipherPayload,
}

/// Main struct for managing authentication keys in WebAssembly.
#[wasm_bindgen]
pub struct KeyVault;

// Constants
const SALT_LENGTH: usize = 16; // 128-bit salt
const IV_LENGTH: usize = 12; // 96-bit IV for AES-GCM
const DB_NAME: &str = "quantum_purse";
const SEED_PHRASE_STORE: &str = "seed_phrase_store";
const CHILD_KEYS_STORE: &str = "child_keys_store";
const SEED_PHRASE_KEY: &str = "seed_phrase";

/// Opens the IndexedDB database, creating object stores if necessary.
///
/// **Returns**:
/// - `Result<Database, KeyVaultError>` - The opened database on success, or an error if the operation fails.
///
/// **Async**: Yes
async fn open_db() -> Result<Database, KeyVaultError> {
    Database::open(DB_NAME)
        .with_version(1u8)
        .with_on_blocked(|_event| Ok(()))
        .with_on_upgrade_needed(|_event, db| {
            if !db
                .object_store_names()
                .any(|name| name == SEED_PHRASE_STORE)
            {
                db.create_object_store(SEED_PHRASE_STORE).build()?;
            }
            if !db.object_store_names().any(|name| name == CHILD_KEYS_STORE) {
                db.create_object_store(CHILD_KEYS_STORE).build()?;
            }
            Ok(())
        })
        .await
        .map_err(|e| KeyVaultError::DatabaseError(format!("Failed to open IndexedDB: {}", e)))
}

/// Stores the encrypted mnemonic phrase in the database.
///
/// **Parameters**:
/// - `payload: CipherPayload` - The encrypted mnemonic phrase data to store.
///
/// **Returns**:
/// - `Result<(), KeyVaultError>` - Ok on success, or an error if storage fails.
///
/// **Async**: Yes
///
/// **Warning**: This method overwrites the existing mnemonic phrase in the database.
async fn set_encrypted_mnemonic_phrase(payload: CipherPayload) -> Result<(), KeyVaultError> {
    let db = open_db().await?;
    let tx = db
        .transaction(SEED_PHRASE_STORE)
        .with_mode(TransactionMode::Readwrite)
        .build()?;
    let store = tx.object_store(SEED_PHRASE_STORE)?;

    let js_value = serde_wasm_bindgen::to_value(&payload)?;

    store.put(&js_value).with_key(SEED_PHRASE_KEY).await?;
    tx.commit().await?;
    Ok(())
}

/// Retrieves the encrypted mnemonic phrase from the database.
///
/// **Returns**:
/// - `Result<Option<CipherPayload>, KeyVaultError>` - The encrypted mnemonic phrase if it exists, `None` if not found, or an error if retrieval fails.
///
/// **Async**: Yes
async fn get_encrypted_mnemonic_phrase() -> Result<Option<CipherPayload>, KeyVaultError> {
    let db = open_db().await?;
    let tx = db
        .transaction(SEED_PHRASE_STORE)
        .with_mode(TransactionMode::Readonly)
        .build()?;
    let store = tx.object_store(SEED_PHRASE_STORE)?;

    if let Some(js_value) = store
        .get(SEED_PHRASE_KEY)
        .await
        .map_err(|e| KeyVaultError::DatabaseError(e.to_string()))?
    {
        let payload: CipherPayload = serde_wasm_bindgen::from_value(js_value)?;
        Ok(Some(payload))
    } else {
        Ok(None)
    }
}

/// Stores a child key (SPHINCS+ key pair) in the database.
///
/// **Parameters**:
/// - `pair: SphincsPlusKeyPair` - The SPHINCS+ key pair to store.
///
/// **Returns**:
/// - `Result<(), KeyVaultError>` - Ok on success, or an error if storage fails.
///
/// **Async**: Yes
async fn add_key_pair(pair: SphincsPlusKeyPair) -> Result<(), KeyVaultError> {
    let db = open_db().await?;
    let tx = db
        .transaction(CHILD_KEYS_STORE)
        .with_mode(TransactionMode::Readwrite)
        .build()?;
    let store = tx.object_store(CHILD_KEYS_STORE)?;

    let js_value = serde_wasm_bindgen::to_value(&pair)?;

    match store.add(js_value).with_key(pair.pub_key).build() {
        Ok(_) => {
            tx.commit().await?;
            Ok(())
        }
        Err(e) => {
            if let DBError::DomException(dom_err) = e {
                if dom_err.name() == "ConstraintError" {
                    // Key already exists, skip
                    Ok(())
                } else {
                    Err(KeyVaultError::DatabaseError(dom_err.to_string()))
                }
            } else {
                Err(KeyVaultError::DatabaseError(e.to_string()))
            }
        }
    }
}

/// Retrieves a child key pair by its public key from the database.
///
/// **Parameters**:
/// - `pub_key: &str` - The hex-encoded public key of the child key to retrieve.
///
/// **Returns**:
/// - `Result<Option<SphincsPlusKeyPair>, KeyVaultError>` - The child key if found, `None` if not found, or an error if retrieval fails.
///
/// **Async**: Yes
pub async fn get_key_pair(pub_key: &str) -> Result<Option<SphincsPlusKeyPair>, KeyVaultError> {
    let db = open_db().await?;
    let tx = db
        .transaction(CHILD_KEYS_STORE)
        .with_mode(TransactionMode::Readonly)
        .build()?;
    let store = tx.object_store(CHILD_KEYS_STORE)?;

    if let Some(js_value) = store
        .get(pub_key)
        .await
        .map_err(|e| KeyVaultError::DatabaseError(e.to_string()))?
    {
        let pair: SphincsPlusKeyPair = serde_wasm_bindgen::from_value(js_value)?;
        Ok(Some(pair))
    } else {
        Ok(None)
    }
}

/// Clears a specific object store in the database.
///
/// **Parameters**:
/// - `db: &Database` - The database instance to operate on.
/// - `store_name: &str` - The name of the object store to clear.
///
/// **Returns**:
/// - `Result<(), KeyVaultError>` - Ok on success, or an error if the operation fails.
///
/// **Async**: Yes
async fn clear_object_store(db: &Database, store_name: &str) -> Result<(), KeyVaultError> {
    let tx = db
        .transaction(store_name)
        .with_mode(TransactionMode::Readwrite)
        .build()
        .map_err(|e| {
            KeyVaultError::DatabaseError(format!(
                "Error starting transaction for {}: {}",
                store_name, e
            ))
        })?;
    let store = tx.object_store(store_name).map_err(|e| {
        KeyVaultError::DatabaseError(format!("Error getting object store {}: {}", store_name, e))
    })?;
    store.clear().map_err(|e| {
        KeyVaultError::DatabaseError(format!("Error clearing object store {}: {}", store_name, e))
    })?;
    tx.commit().await.map_err(|e| {
        KeyVaultError::DatabaseError(format!(
            "Error committing transaction for {}: {}",
            store_name, e
        ))
    })?;
    Ok(())
}

/// Generates random bytes for cryptographic use.
///
/// **Parameters**:
/// - `length: usize` - The number of random bytes to generate.
///
/// **Returns**:
/// - `Result<Vec<u8>, String>` - A vector of random bytes on success, or an error message on failure.
fn get_random_bytes(length: usize) -> Result<Vec<u8>, String> {
    let mut buffer = vec![0u8; length];
    getrandom(buffer.as_mut_slice()).map_err(|e| e.to_string())?;
    Ok(buffer)
}

/// Generates a new BIP39 mnemonic seed phrase.
///
/// **Returns**:
/// - `Mnemonic` - A BIP39 mnemonic phrase generated from 256-bit entropy.
fn gen_seed_phrase() -> Mnemonic {
    let mut entropy = get_random_bytes(32).unwrap(); // 256-bit entropy
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy).unwrap();
    entropy.zeroize();
    mnemonic
}

/// Encrypts data using AES-GCM with a password-derived key.
///
/// **Parameters**:
/// - `password: &[u8]` - The password used to derive the encryption key.
/// - `input: &[u8]` - The plaintext data to encrypt.
///
/// **Returns**:
/// - `Result<CipherPayload, String>` - A `CipherPayload` containing the encrypted data, salt, and IV on success, or an error message on failure.
/// 
/// Warning: Proper zeroization of passwords and inputs is the responsibility of the caller.
fn encrypt(password: &[u8], input: &[u8]) -> Result<CipherPayload, String> {
    let mut salt = vec![0u8; SALT_LENGTH];
    let mut iv = vec![0u8; IV_LENGTH];
    let random_bytes = get_random_bytes(SALT_LENGTH + IV_LENGTH).map_err(|e| e.to_string())?;
    salt.copy_from_slice(&random_bytes[0..SALT_LENGTH]);
    iv.copy_from_slice(&random_bytes[SALT_LENGTH..]);

    let mut scrypt_key = vec![0u8; 32];
    let scrypt_param = Params::new(14, 8, 1, 32).unwrap(); // TODO: Adjust parameters for security/performance
    scrypt(password, &salt, &scrypt_param, &mut scrypt_key)
        .map_err(|e| format!("Scrypt error: {:?}", e))?;

    let aes_key: &Key<Aes256Gcm> = Key::<Aes256Gcm>::from_slice(&scrypt_key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(&iv);
    let cipher_text = cipher
        .encrypt(nonce, input)
        .map_err(|e| format!("Encryption error: {:?}", e))?;

    scrypt_key.zeroize();

    Ok(CipherPayload {
        salt: encode(salt),
        iv: encode(iv),
        cipher_text: encode(cipher_text),
    })
}

/// Decrypts data using AES-GCM with a password-derived key.
///
/// **Parameters**:
/// - `password: &[u8]` - The password used to derive the decryption key.
/// - `payload: CipherPayload` - The encrypted data payload containing salt, IV, and ciphertext.
///
/// **Returns**:
/// - `Result<Vec<u8>, String>` - The decrypted plaintext on success, or an error message on failure.
/// 
/// Warning: Proper zeroization of passwords and inputs is the responsibility of the caller.
fn decrypt(password: &[u8], payload: CipherPayload) -> Result<Vec<u8>, String> {
    let salt = decode(payload.salt).map_err(|e| format!("Salt decode error: {:?}", e))?;
    let iv = decode(payload.iv).map_err(|e| format!("IV decode error: {:?}", e))?;
    let cipher_text =
        decode(payload.cipher_text).map_err(|e| format!("Ciphertext decode error: {:?}", e))?;

    let mut scrypt_key = vec![0u8; 32];
    let scrypt_param = Params::new(14, 8, 1, 32).unwrap(); // TODO: Adjust parameters for security/performance
    scrypt(password, &salt, &scrypt_param, &mut scrypt_key)
        .map_err(|e| format!("Scrypt error: {:?}", e))?;

    let aes_key: &Key<Aes256Gcm> = Key::<Aes256Gcm>::from_slice(&scrypt_key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(&iv);
    let decipher = cipher
        .decrypt(nonce, cipher_text.as_ref())
        .map_err(|e| format!("Decryption error: {:?}", e))?;

    scrypt_key.zeroize();

    Ok(decipher)
}

#[wasm_bindgen]
impl KeyVault {
    /// Constructs a new `KeyVault`. Stateless and serves as a namespace only.
    ///
    /// **Returns**:
    /// - `KeyVault` - A new instance of the struct.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        KeyVault
    }

    /// Clears all data in the `seed_phrase_store` and `child_keys_store` in IndexedDB.
    ///
    /// **Returns**:
    /// - `Result<(), JsValue>` - A JavaScript Promise that resolves to `undefined` on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn clear_database() -> Result<(), JsValue> {
        let db = open_db().await.map_err(|e| e.to_jsvalue())?;
        clear_object_store(&db, SEED_PHRASE_STORE)
            .await
            .map_err(|e| e.to_jsvalue())?;
        clear_object_store(&db, CHILD_KEYS_STORE)
            .await
            .map_err(|e| e.to_jsvalue())?;
        Ok(())
    }

    /// Retrieves all SPHINCS+ public keys from the database.
    ///
    /// **Returns**:
    /// - `Result<Vec<String>, JsValue>` - A JavaScript Promise that resolves to an array of hex-encoded SPHINCS+ public keys on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn get_all_sphincs_pub() -> Result<Vec<String>, JsValue> {
        /// Error conversion helper
        fn map_db_error<T>(result: Result<T, DBError>) -> Result<T, JsValue> {
            result.map_err(|e| JsValue::from_str(&format!("Database error: {}", e)))
        }

        let db = open_db().await.map_err(|e| e.to_jsvalue())?;
        let tx = map_db_error(
            db.transaction(CHILD_KEYS_STORE)
                .with_mode(TransactionMode::Readonly)
                .build(),
        )?;
        let store = map_db_error(tx.object_store(CHILD_KEYS_STORE))?;

        let iter: ArrayMapIter<JsValue> = map_db_error(store.get_all_keys().await)?;
        let mut pub_keys = Vec::new();
        for result in iter {
            let js_value = map_db_error(result)?;
            pub_keys.push(js_value.as_string().unwrap());
        }

        Ok(pub_keys)
    }

    /// Initializes the mnemonic phrase by generating a BIP39 mnemonic, encrypting it with the provided password, and storing it in IndexedDB.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to encrypt the mnemonic.
    ///
    /// **Returns**:
    /// - `Result<(), JsValue>` - A JavaScript Promise that resolves to `undefined` on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    ///
    /// **Note**: Only effective when the mnemonic phrase is not yet set.
    #[wasm_bindgen]
    pub async fn key_init(password: Uint8Array) -> Result<(), JsValue> {
        // TODO try deleting password in js side from here
        let stored_seed = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?;
        if stored_seed.is_some() {
            debug!("[INFO]: Mnemonic phrase exists");
            Ok(())
        } else {
            let mut mnemonic = gen_seed_phrase();
            // let mut seed = mnemonic.to_seed("");
            let mut password = password.to_vec();
            let encrypted_seed = encrypt(&password, mnemonic.to_string().as_bytes())
                .map_err(|e| JsValue::from_str(&format!("Encryption error: {}", e)))?;

            mnemonic.zeroize();
            password.zeroize();
            set_encrypted_mnemonic_phrase(encrypted_seed)
                .await
                .map_err(|e| e.to_jsvalue())?;
            Ok(())
        }
    }

    /// Generates a new SPHINCS+ key pair - a SPHINCS+ child key pair derived from the mnemonic phrase,
    /// encrypts the private key with the password, and stores/appends it in IndexedDB.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to decrypt the mnemonic phrase and encrypt the child private key.
    ///
    /// **Returns**:
    /// - `Result<JsValue, JsValue>` - A JavaScript Promise that resolves to the hex-encoded SPHINCS+ public key on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn gen_new_key_pair(password: Uint8Array) -> Result<JsValue, JsValue> {
        let mut password = password.to_vec();

        let master_seed = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let mut seed = decrypt(&password, master_seed)?.to_vec();

        let path = format!("pq/ckb/{}", Self::get_all_sphincs_pub().await?.len());
        let mut sphincs_seed = vec![0u8; 32];
        let scrypt_param = Params::new(14, 8, 1, 32).unwrap(); // TODO: Adjust parameters for security/performance
        scrypt(&seed, path.as_bytes(), &scrypt_param, &mut sphincs_seed)
            .map_err(|e| JsValue::from_str(&format!("Scrypt error: {:?}", e)))?;

        let mut rng = rand_chacha::ChaCha8Rng::from_seed(
            sphincs_seed
                .try_into()
                .expect("Slice with incorrect length"),
        );
        let (pub_key, pri_key) = slh_dsa_shake_128f::try_keygen_with_rng(&mut rng)?;
        let pub_key_clone = pub_key.clone();
        let mut pri_key_bytes = pri_key.into_bytes();
        let encrypted_pri = encrypt(&password, &pri_key_bytes)?;

        let pair = SphincsPlusKeyPair {
            pub_key: encode(pub_key.into_bytes()),
            pri_enc: encrypted_pri,
        };

        add_key_pair(pair).await.map_err(|e| e.to_jsvalue())?;

        seed.zeroize();
        password.zeroize();
        pri_key_bytes.zeroize();
        // TODO check if can shred rng

        Ok(JsValue::from_str(&encode(pub_key_clone.into_bytes())))
    }

    /// Imports a mnemonic by encrypting it with the provided password and storing it as the mnemonic phrase.
    ///
    /// **Parameters**:
    /// - `seed_phrase: Uint8Array` - The mnemonic phrase as a UTF-8 encoded Uint8Array to import.
    /// - `password: Uint8Array` - The password used to encrypt the mnemonic.
    ///
    /// **Returns**:
    /// - `Result<(), JsValue>` - A JavaScript Promise that resolves to `undefined` on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    ///
    /// **Warning**: This method is not recommended as it may expose the mnemonic in JavaScript.
    #[wasm_bindgen]
    pub async fn import_seed_phrase(
        seed_phrase: Uint8Array,
        password: Uint8Array,
    ) -> Result<(), JsValue> {
        // TODO verify valid seed/ or do it in js side
        let mut password = password.to_vec();
        let mut mnemonic = seed_phrase.to_vec();
        let encrypted_seed = encrypt(&password, &mnemonic)?;
        password.zeroize();
        mnemonic.zeroize();
        set_encrypted_mnemonic_phrase(encrypted_seed)
            .await
            .map_err(|e| e.to_jsvalue())?;
        Ok(())
    }

    /// Exports the mnemonic phrase by decrypting it with the provided password.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to decrypt the mnemonic.
    ///
    /// **Returns**:
    /// - `Result<Uint8Array, JsValue>` - A JavaScript Promise that resolves to the mnemonic as a UTF-8 encoded `Uint8Array` on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    ///
    /// **Warning**: Exporting the mnemonic exposes it in JavaScript, which may pose a security risk.
    #[wasm_bindgen]
    pub async fn export_seed_phrase(password: Uint8Array) -> Result<Uint8Array, JsValue> {
        let mut password = password.to_vec();
        let encrypted_seed = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let mnemonic = decrypt(&password, encrypted_seed)?;
        password.zeroize();
        Ok(Uint8Array::from(mnemonic.as_slice()))
    }

    /// Signs a message using the SPHINCS+ private key after decrypting it with the provided password.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to decrypt the private key.
    /// - `sphincs_plus_pub: String` - The SPHINCS+ public key identifying the private key to use for signing.
    /// - `message: Uint8Array` - The message to be signed.
    ///
    /// **Returns**:
    /// - `Result<Uint8Array, JsValue>` - The signature as a `Uint8Array` on success,
    ///   or a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn sign(
        password: Uint8Array,
        sphincs_plus_pub: String,
        message: Uint8Array,
    ) -> Result<Uint8Array, JsValue> {
        let mut password = password.to_vec();
        let pair = get_key_pair(&sphincs_plus_pub)
            .await
            .map_err(|e| e.to_jsvalue())?
            .unwrap();

        // TODO check to zerolize pri_key_bytes when panic at try_into()
        let pri_key_bytes = decrypt(&password, pair.pri_enc)?.to_vec();
        let mut signing_key = slh_dsa_shake_128f::PrivateKey::try_from_bytes(
            &pri_key_bytes.try_into().expect("Fail to parse private key"),
        )
        .map_err(|e| JsValue::from_str(&format!("Unable to load private key: {:?}", e)))?;
        let signature = signing_key.try_sign(&message.to_vec(), &[], true)?;
        password.zeroize();
        signing_key.zeroize();
        Ok(Uint8Array::from(signature.as_slice()))
    }
}
