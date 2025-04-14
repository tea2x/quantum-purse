//! # QuantumPurse KeyVault
//!
//! This module provides a secure authentication interface for managing cryptographic keys in
//! QuantumPurse using WebAssembly. It leverages AES-GCM for encryption, Scrypt for key derivation,
//! and the SPHINCS+ signature scheme for post-quantum transaction signing. Sensitive data, including
//! the BIP39 mnemonic and derived SPHINCS+ private keys, is encrypted and stored in the browser via
//! IndexedDB, with access authenticated by user-provided passwords.

use bip39::{Language, Mnemonic};
use ckb_fips205_utils::{
    ckb_tx_message_all_from_mock_tx::{generate_ckb_tx_message_all_from_mock_tx, ScriptOrIndex},
    Hasher,
};
use ckb_mock_tx_types::{MockTransaction, ReprMockTransaction};
use fips205::{
    traits::{KeyGen, SerDes, Signer},
    *,
};
use hex::encode;
use indexed_db_futures::{
    error::Error as DBError, iter::ArrayMapIter, prelude::*, transaction::TransactionMode,
};
// use rand_chacha::rand_core::SeedableRng;
use serde_wasm_bindgen;
use wasm_bindgen::{prelude::*, JsValue};
use web_sys::js_sys::Uint8Array;
use zeroize::Zeroize;

mod constants;
mod db;
mod macros;
mod secure_vec;
mod types;
mod utilities;

use crate::constants::{CHILD_KEYS_STORE, KDF_PATH_PREFIX, SEED_PHRASE_STORE};
use db::*;
use secure_vec::SecureVec;
use types::*;
use utilities::*;

////////////////////////////////////////////////////////////////////////////////
///  Key-vault functions
////////////////////////////////////////////////////////////////////////////////
#[wasm_bindgen]
pub struct KeyVault {
    pub variant: SphincsVariant,
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
            variant: variant,
        }
    }

    /// To derive Sphincs key pair. One master mnemonic seed phrase can derive multiple child index-based sphincs+ key pairs on demand.
    ///
    /// **Parameters**:
    /// - `seed: &[u8]` - The master mnemonic seed phrase from which the child sphincs+ key is derived. MUST carry at least N*3 bytes of entropy.
    /// - `index: u32` - The index of the child sphincs+ key to be derived.
    ///
    /// **Returns**:
    /// - `Result<SecureVec, String>` - Scrypt key on success, or an error message on failure.
    ///
    /// Warning: Proper zeroization of the input seed is the responsibility of the caller.
    fn derive_sphincs_key(&self, seed: &[u8], index: u32) -> Result<(SecureVec, SecureVec), String> {
        match self.variant {
            SphincsVariant::Sha2128S => sphincs_keygen!(slh_dsa_sha2_128s::KG, slh_dsa_sha2_128s::N, seed, index),
            SphincsVariant::Sha2128F => sphincs_keygen!(slh_dsa_sha2_128f::KG, slh_dsa_sha2_128f::N, seed, index),
            SphincsVariant::Sha2192S => sphincs_keygen!(slh_dsa_sha2_192s::KG, slh_dsa_sha2_192s::N, seed, index),
            SphincsVariant::Sha2192F => sphincs_keygen!(slh_dsa_sha2_192f::KG, slh_dsa_sha2_192f::N, seed, index),
            SphincsVariant::Sha2256S => sphincs_keygen!(slh_dsa_sha2_256s::KG, slh_dsa_sha2_256s::N, seed, index),
            SphincsVariant::Sha2256F => sphincs_keygen!(slh_dsa_sha2_256f::KG, slh_dsa_sha2_256f::N, seed, index),
            SphincsVariant::Shake128S => sphincs_keygen!(slh_dsa_shake_128s::KG, slh_dsa_shake_128s::N, seed, index),
            SphincsVariant::Shake128F => sphincs_keygen!(slh_dsa_shake_128f::KG, slh_dsa_shake_128f::N, seed, index),
            SphincsVariant::Shake192S => sphincs_keygen!(slh_dsa_shake_192s::KG, slh_dsa_shake_192s::N, seed, index),
            SphincsVariant::Shake192F => sphincs_keygen!(slh_dsa_shake_192f::KG, slh_dsa_shake_192f::N, seed, index),
            SphincsVariant::Shake256S => sphincs_keygen!(slh_dsa_shake_256s::KG, slh_dsa_shake_256s::N, seed, index),
            SphincsVariant::Shake256F => sphincs_keygen!(slh_dsa_shake_256f::KG, slh_dsa_shake_256f::N, seed, index),
        }
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
    pub async fn init_seed_phrase(&self, password: Uint8Array) -> Result<(), JsValue> {
        let stored_seed = get_encrypted_mnemonic_phrase()
            .await
            .map_err(|e| e.to_jsvalue())?;
        if stored_seed.is_some() {
            debug!("\x1b[37;44m INFO \x1b[0m \x1b[1mkey-vault\x1b[0m: mnemonic phrase exists");
            return Ok(());
        }

        let size = self.variant.entropy_size();
        let entropy = get_random_bytes(size).unwrap();
        let chunks = entropy.chunks(32);
        let mut mnemonics = Vec::new();
        
        for chunk in chunks {
            let mnemonic = Mnemonic::from_entropy_in(Language::English, chunk).unwrap();
            mnemonics.push(mnemonic.to_string());
        }
        let combined_mnemonics = mnemonics.join(" ");
        let password = SecureVec::from_slice(&password.to_vec());
        let encrypted_seed = encrypt(&password, combined_mnemonics.as_bytes())
            .map_err(|e| JsValue::from_str(&format!("Encryption error: {}", e)))?;
    
        set_encrypted_mnemonic_phrase(encrypted_seed)
            .await
            .map_err(|e| e.to_jsvalue())?;
        Ok(())
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
    
        match self.variant {
            SphincsVariant::Sha2128S => sphincs_sign!(slh_dsa_sha2_128s, pri_key, &message_vec),
            SphincsVariant::Sha2128F => sphincs_sign!(slh_dsa_sha2_128f, pri_key, &message_vec),
            SphincsVariant::Shake128S => sphincs_sign!(slh_dsa_shake_128s, pri_key, &message_vec),
            SphincsVariant::Shake128F => sphincs_sign!(slh_dsa_shake_128f, pri_key, &message_vec),
            SphincsVariant::Sha2192S => sphincs_sign!(slh_dsa_sha2_192s, pri_key, &message_vec),
            SphincsVariant::Sha2192F => sphincs_sign!(slh_dsa_sha2_192f, pri_key, &message_vec),
            SphincsVariant::Shake192S => sphincs_sign!(slh_dsa_shake_192s, pri_key, &message_vec),
            SphincsVariant::Shake192F => sphincs_sign!(slh_dsa_shake_192f, pri_key, &message_vec),
            SphincsVariant::Sha2256S => sphincs_sign!(slh_dsa_sha2_256s, pri_key, &message_vec),
            SphincsVariant::Sha2256F => sphincs_sign!(slh_dsa_sha2_256f, pri_key, &message_vec),
            SphincsVariant::Shake256S => sphincs_sign!(slh_dsa_shake_256s, pri_key, &message_vec),
            SphincsVariant::Shake256F => sphincs_sign!(slh_dsa_shake_256f, pri_key, &message_vec),
        }
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

////////////////////////////////////////////////////////////////////////////////
///  Key-vault utility functions
////////////////////////////////////////////////////////////////////////////////
#[wasm_bindgen]
pub struct Util;

#[wasm_bindgen]
impl Util {
    /// https://github.com/xxuejie/rfcs/blob/cighash-all/rfcs/0000-ckb-tx-message-all/0000-ckb-tx-message-all.md.
    ///
    /// **Parameters**:
    /// - `serialized_mock_tx: Uint8Array` - serialized CKB mock transaction.
    ///
    /// **Returns**:
    /// - `Result<Uint8Array, JsValue>` - The CKB transaction message all hash digest as a `Uint8Array` on success,
    ///   or a JavaScript error on failure.
    ///
    /// **Async**: no
    #[wasm_bindgen]
    pub fn get_ckb_tx_message_all(serialized_mock_tx: Uint8Array) -> Result<Uint8Array, JsValue> {
        let serialized_bytes = serialized_mock_tx.to_vec();
        let repr_mock_tx: ReprMockTransaction = serde_json::from_slice(&serialized_bytes)
            .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;
        let mock_tx: MockTransaction = repr_mock_tx.into();
        let mut message_hasher = Hasher::message_hasher();
        let _ = generate_ckb_tx_message_all_from_mock_tx(
            &mock_tx,
            ScriptOrIndex::Index(0),
            &mut message_hasher,
        )
        .map_err(|e| JsValue::from_str(&format!("CKB_TX_MESSAGE_ALL error: {:?}", e)))?;
        let message = message_hasher.hash();
        Ok(Uint8Array::from(message.as_slice()))
    }

    /// Measure bit strength of a password
    ///
    /// **Parameters**:
    /// - `password: Uint8Array` - utf8 serialized password.
    ///
    /// **Returns**:
    /// - `Result<u16, JsValue>` - The strength of the password measured in bit on success,
    ///   or a JavaScript error on failure.
    ///
    /// **Async**: no
    #[wasm_bindgen]
    pub fn password_checker(password: Uint8Array) -> Result<u32, JsValue> {
        let password = SecureVec::from_slice(&password.to_vec());
        let password_str =
            std::str::from_utf8(&password).map_err(|e| JsValue::from_str(&e.to_string()))?;

        if password_str.is_empty() {
            return Ok(0);
        }

        let mut has_lowercase = false;
        let mut has_uppercase = false;
        let mut has_digit = false;
        let mut has_punctuation = false;
        let mut has_space = false;
        let mut has_other = false;

        for c in password_str.chars() {
            if c == ' ' {
                has_space = true;
            } else if c.is_ascii_lowercase() {
                has_lowercase = true;
            } else if c.is_ascii_uppercase() {
                has_uppercase = true;
            } else if c.is_ascii_digit() {
                has_digit = true;
            } else if c.is_ascii_punctuation() {
                has_punctuation = true;
            } else {
                has_other = true;
            }
        }

        if !has_uppercase {
            return Err(JsValue::from_str(
                "Password must contain at least one uppercase letter!",
            ));
        }
        if !has_lowercase {
            return Err(JsValue::from_str(
                "Password must contain at least one lowercase letter!",
            ));
        }
        if !has_digit {
            return Err(JsValue::from_str(
                "Password must contain at least one digit!",
            ));
        }
        if !has_punctuation {
            return Err(JsValue::from_str(
                "Password must contain at least one symbol!",
            ));
        }

        let character_set_size = if has_other {
            256
        } else {
            let mut size = 0;
            if has_lowercase {
                size += 26;
            } // a-z
            if has_uppercase {
                size += 26;
            } // A-Z
            if has_digit {
                size += 10;
            } // 0-9
            if has_punctuation {
                size += 32;
            } // ASCII punctuation
            if has_space {
                size += 1;
            } // Space character
            size
        };

        if character_set_size == 0 {
            return Ok(0);
        }

        let entropy = (password_str.len() as f64) * (character_set_size as f64).log2();
        let rounded_entropy = entropy.round() as u32;

        if rounded_entropy < 256 {
            return Err(JsValue::from_str(
                "Password entropy must be at least 256 bit. Consider lengthening your password!",
            ));
        }
        Ok(rounded_entropy)
    }
}
