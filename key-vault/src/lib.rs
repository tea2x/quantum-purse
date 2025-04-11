//! # QuantumPurse KeyVault
//!
//! This module provides a secure authentication interface for managing cryptographic keys in
//! QuantumPurse using WebAssembly. It leverages AES-GCM for encryption, Scrypt for key derivation,
//! and the SPHINCS+ signature scheme for post-quantum transaction signing. Sensitive data, including
//! the BIP39 mnemonic and derived SPHINCS+ private keys, is encrypted and stored in the browser via
//! IndexedDB, with access authenticated by user-provided passwords.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use bip39::{Language, Mnemonic};
use fips205::{
    traits::{SerDes, Signer},
    *,
};
use getrandom_v03;
use hex::{decode, encode};
use indexed_db_futures::{
    database::Database, error::Error as DBError, iter::ArrayMapIter, prelude::*,
    transaction::TransactionMode,
};
use rand_chacha::rand_core::SeedableRng;
use scrypt::{scrypt, Params};
use serde_wasm_bindgen;
use wasm_bindgen::{prelude::*, JsValue};
use web_sys::js_sys::Uint8Array;
use zeroize::Zeroize;

mod constants;
mod errors;
mod macros;
mod secure_vec;
#[cfg(test)]
mod tests;
mod types;
mod utilities;

use crate::constants::*;
use errors::KeyVaultError;
use secure_vec::SecureVec;
use types::*;

#[wasm_bindgen]
pub struct KeyVault {
    pub sphincs_plus_variant: SphincsVariant,
}

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
async fn add_key_pair(mut pair: SphincsPlusKeyPair) -> Result<(), KeyVaultError> {
    let db = open_db().await?;
    let tx = db
        .transaction(CHILD_KEYS_STORE)
        .with_mode(TransactionMode::Readwrite)
        .build()?;
    let store = tx.object_store(CHILD_KEYS_STORE)?;
    let count = store.count().await?;
    pair.index = count as u32;
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
/// - `Result<SecureVec, String>` - A Secure vector of random bytes on success, or an error message on failure.
fn get_random_bytes(length: usize) -> Result<SecureVec, getrandom_v03::Error> {
    let mut buffer = SecureVec::new_with_length(length);
    getrandom_v03::fill(&mut buffer)?;
    Ok(buffer)
}

/// Derive scrypt key.
///
/// **Parameters**:
/// - `password: &[u8]` - The password from which the scrypt key is derived.
/// - `salt: &Vec<u8>` - Salt.
///
/// **Returns**:
/// - `Result<SecureVec, String>` - Scrypt key on success, or an error message on failure.
///
/// Warning: Proper zeroization of passwords is the responsibility of the caller.
fn derive_scrypt_key(
    password: &[u8],
    salt: &Vec<u8>,
    param: ScryptParam,
) -> Result<SecureVec, String> {
    let mut scrypt_key = SecureVec::new_with_length(32);
    let scrypt_param = Params::new(param.log_n, param.r, param.p, param.len).unwrap();
    scrypt(password, &salt, &scrypt_param, &mut scrypt_key)
        .map_err(|e| format!("Scrypt error: {:?}", e))?;
    Ok(scrypt_key)
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

    let scrypt_key = derive_scrypt_key(password, &salt, ENC_SCRYPT)?;
    let aes_key: &Key<Aes256Gcm> = Key::<Aes256Gcm>::from_slice(&scrypt_key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(&iv);
    let cipher_text = cipher
        .encrypt(nonce, input)
        .map_err(|e| format!("Encryption error: {:?}", e))?;

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
fn decrypt(password: &[u8], payload: CipherPayload) -> Result<SecureVec, String> {
    let salt = decode(payload.salt).map_err(|e| format!("Salt decode error: {:?}", e))?;
    let iv = decode(payload.iv).map_err(|e| format!("IV decode error: {:?}", e))?;
    let cipher_text =
        decode(payload.cipher_text).map_err(|e| format!("Ciphertext decode error: {:?}", e))?;

    let scrypt_key = derive_scrypt_key(password, &salt, ENC_SCRYPT)?;
    let aes_key: &Key<Aes256Gcm> = Key::<Aes256Gcm>::from_slice(&scrypt_key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(&iv);
    let mut decipher = cipher
        .decrypt(nonce, cipher_text.as_ref())
        .map_err(|e| format!("Decryption error: {:?}", e))?;

    let secure_decipher = SecureVec::from_slice(&decipher);
    decipher.zeroize();
    Ok(secure_decipher)
}

#[wasm_bindgen]
impl KeyVault {
    /// Constructs a new `KeyVault` to serve as a namespace in the output js interface.
    ///
    /// **Returns**:
    /// - `KeyVault` - A new instance of the struct.
    #[wasm_bindgen(constructor)]
    pub fn new(variant: SphincsVariant) -> Self {
        KeyVault {
            sphincs_plus_variant: variant,
        }
    }

    /// To derive Sphincs key pair. One master mnemonic seed phrase can derive multiple child index-based sphincs+ key pairs on demand.
    ///
    /// **Parameters**:
    /// - `seed: &[u8]` - The master mnemonic seed phrase from which the child sphincs+ key is derived.
    /// - `index: u32` - The index of the child sphincs+ key to be derived.
    ///
    /// **Returns**:
    /// - `Result<SecureVec, String>` - Scrypt key on success, or an error message on failure.
    ///
    /// Warning: Proper zeroization of the input seed is the responsibility of the caller.
    fn derive_sphincs_key(
        &self,
        seed: &[u8],
        index: u32,
    ) -> Result<(SecureVec, SecureVec), String> {
        let path = format!("{}{}", KDF_PATH_PREFIX, index);
        let sphincs_seed = derive_scrypt_key(seed, &path.as_bytes().to_vec(), KDF_SCRYPT)?;
        let mut rng = rand_chacha::ChaCha8Rng::from_seed(
            (&*sphincs_seed)
                .try_into()
                .expect("Slice with incorrect length"),
        );

        sphincs_keygen!(
            self.sphincs_plus_variant,
            &mut rng,
            SphincsVariant::Sha2128S,
            slh_dsa_sha2_128s,
            SphincsVariant::Sha2128F,
            slh_dsa_sha2_128f,
            SphincsVariant::Shake128S,
            slh_dsa_shake_128s,
            SphincsVariant::Shake128F,
            slh_dsa_shake_128f,
            SphincsVariant::Sha2192S,
            slh_dsa_sha2_192s,
            SphincsVariant::Sha2192F,
            slh_dsa_sha2_192f,
            SphincsVariant::Shake192S,
            slh_dsa_shake_192s,
            SphincsVariant::Shake192F,
            slh_dsa_shake_192f,
            SphincsVariant::Sha2256S,
            slh_dsa_sha2_256s,
            SphincsVariant::Sha2256F,
            slh_dsa_sha2_256f,
            SphincsVariant::Shake256S,
            slh_dsa_shake_256s,
            SphincsVariant::Shake256F,
            slh_dsa_shake_256f
        )
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

    /// Retrieves all SPHINCS+ public keys from the database in the order they get inserted.
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

        // Retrieve all key pairs
        let iter: ArrayMapIter<JsValue> = map_db_error(store.get_all().await)?;
        let mut key_pairs: Vec<SphincsPlusKeyPair> = Vec::new();
        for result in iter {
            let js_value = map_db_error(result)?;
            let pair: SphincsPlusKeyPair = serde_wasm_bindgen::from_value(js_value)?;
            key_pairs.push(pair);
        }

        // Sort by index
        key_pairs.sort_by_key(|pair| pair.index);

        // Extract public keys in sorted order
        let pub_keys: Vec<String> = key_pairs.into_iter().map(|pair| pair.pub_key).collect();

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
    pub async fn init_seed_phrase(password: Uint8Array) -> Result<(), JsValue> {
        let stored_seed = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?;
        if stored_seed.is_some() {
            debug!("\x1b[37;44m INFO \x1b[0m \x1b[1mkey-vault\x1b[0m: mnemonic phrase exists");
            Ok(())
        } else {
            let entropy = get_random_bytes(32).unwrap(); // 256-bit entropy
            let mut mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy).unwrap();

            // let mut seed = mnemonic.to_seed("");
            let password = SecureVec::from_slice(&password.to_vec());
            let encrypted_seed = encrypt(&password, mnemonic.to_string().as_bytes())
                .map_err(|e| JsValue::from_str(&format!("Encryption error: {}", e)))?;

            mnemonic.zeroize(); // TODO verify zeroize on drop

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
    /// - `Result<String, JsValue>` - A String Promise that resolves to the hex-encoded SPHINCS+ public key from the key pair on success,
    ///   or rejects with a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn gen_new_key_pair(&self, password: Uint8Array) -> Result<String, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());

        // Get and decrypt the mnemonic seed phrase
        let payload = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let seed = decrypt(&password, payload)?;

        let index = Self::get_all_sphincs_pub().await?.len() as u32;
        let (pub_key, pri_key) = self
            .derive_sphincs_key(&seed, index)
            .map_err(|e| JsValue::from_str(&format!("Key derivation error: {}", e)))?;

        let encrypted_pri = encrypt(&password, &pri_key)?;

        // Store to DB
        let pair = SphincsPlusKeyPair {
            index: 0, // Init to 0; Will be set correctly in add_key_pair
            pub_key: encode(pub_key.as_ref()),
            pri_enc: encrypted_pri,
        };

        add_key_pair(pair).await.map_err(|e| e.to_jsvalue())?;

        // TODO check rng

        Ok(encode(pub_key.as_ref()))
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
        let password = SecureVec::from_slice(&password.to_vec());
        let mnemonic = SecureVec::from_slice(&seed_phrase.to_vec());
        let encrypted_seed = encrypt(&password, &mnemonic)?;
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
    /// Proper zeroization of exported seed phrase is the responsibility of the caller.
    #[wasm_bindgen]
    pub async fn export_seed_phrase(password: Uint8Array) -> Result<Uint8Array, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());
        let payload = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let mnemonic = decrypt(&password, payload)?;
        Ok(Uint8Array::from(mnemonic.as_ref()))
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
        &self,
        password: Uint8Array,
        sphincs_plus_pub: String,
        message: Uint8Array,
    ) -> Result<Uint8Array, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());
        let pair = get_key_pair(&sphincs_plus_pub)
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Key pair not found"))?;

        let pri_key = decrypt(&password, pair.pri_enc)?;
        let message_vec = message.to_vec();

        sphincs_sign!(
            self.sphincs_plus_variant,
            pri_key,
            &message_vec,
            SphincsVariant::Sha2128S,
            slh_dsa_sha2_128s,
            SphincsVariant::Sha2128F,
            slh_dsa_sha2_128f,
            SphincsVariant::Shake128S,
            slh_dsa_shake_128s,
            SphincsVariant::Shake128F,
            slh_dsa_shake_128f,
            SphincsVariant::Sha2192S,
            slh_dsa_sha2_192s,
            SphincsVariant::Sha2192F,
            slh_dsa_sha2_192f,
            SphincsVariant::Shake192S,
            slh_dsa_shake_192s,
            SphincsVariant::Shake192F,
            slh_dsa_shake_192f,
            SphincsVariant::Sha2256S,
            slh_dsa_sha2_256s,
            SphincsVariant::Sha2256F,
            slh_dsa_sha2_256f,
            SphincsVariant::Shake256S,
            slh_dsa_shake_256s,
            SphincsVariant::Shake256F,
            slh_dsa_shake_256f
        )
    }

    /// Supporting wallet recovery - derives a list of public keys from the seed phrase starting from a given index.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to decrypt the mnemonic.
    /// - `start_index: u32` - The starting index for derivation.
    /// - `count: u32` - The number of public keys to derive.
    ///
    /// **Returns**:
    /// - `Result<Vec<String>, JsValue>` - A list of public keys as strings on success,
    ///   or a JavaScript error on failure.
    #[wasm_bindgen]
    pub async fn gen_account_batch(
        &self,
        password: Uint8Array,
        start_index: u32,
        count: u32,
    ) -> Result<Vec<String>, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());
        // Get and decrypt the mnemonic seed phrase
        let payload = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let seed = decrypt(&password, payload)?;
        let mut pub_keys: Vec<String> = Vec::new();
        for i in start_index..(start_index + count) {
            let (pub_key, _) = self
                .derive_sphincs_key(&seed, i)
                .map_err(|e| JsValue::from_str(&format!("Key derivation error: {}", e)))?;
            pub_keys.push(encode(pub_key.as_ref()));
        }
        Ok(pub_keys)
    }

    /// Supporting wallet recovery - Recovers the wallet by deriving and storing private keys for the first N accounts.
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - The password used to decrypt the seed phrase.
    /// - `count: u32` - The number of accounts to recover (from index 0 to count-1).
    ///
    /// **Returns**:
    /// - `Result<(), JsValue>` - A list of newly generated sphincs+ public keys on success, or a JavaScript error on failure.
    ///
    /// **Async**: Yes
    #[wasm_bindgen]
    pub async fn recover_accounts(
        &self,
        password: Uint8Array,
        count: u32,
    ) -> Result<Vec<String>, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());
        // Get and decrypt the mnemonic seed phrase
        let payload = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?
            .ok_or_else(|| JsValue::from_str("Mnemonic phrase not found"))?;
        let mut pub_keys: Vec<String> = Vec::new();
        let seed = decrypt(&password, payload)?;
        for i in 0..count {
            let (pub_key, pri_key) = self
                .derive_sphincs_key(&seed, i)
                .map_err(|e| JsValue::from_str(&format!("Key derivation error: {}", e)))?;

            // let pub_key_clone = pub_key.clone();
            let encrypted_pri = encrypt(&password, &pri_key)?;
            // Store to DB
            let pair = SphincsPlusKeyPair {
                index: 0, // Init to 0; Will be set correctly in add_key_pair
                pub_key: encode(pub_key.as_ref()),
                pri_enc: encrypted_pri,
            };
            pub_keys.push(encode(pub_key.as_ref()));

            add_key_pair(pair).await.map_err(|e| e.to_jsvalue())?;
        }
        Ok(pub_keys)
    }
}
