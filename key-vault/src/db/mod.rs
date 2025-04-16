mod errors;

use errors::KeyVaultDBError;
use crate::constants::{
    CHILD_KEYS_STORE, DB_NAME, SEED_PHRASE_KEY, SEED_PHRASE_STORE,
};
use super::types::{CipherPayload, SphincsPlusKeyPair};
use indexed_db_futures::{
    database::Database, error::Error as DBError, prelude::*,
    transaction::TransactionMode,
};

/// Opens the IndexedDB database, creating object stores if necessary.
///
/// **Returns**:
/// - `Result<Database, KeyVaultDBError>` - The opened database on success, or an error if the operation fails.
///
/// **Async**: Yes
pub async fn open_db() -> Result<Database, KeyVaultDBError> {
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
        .map_err(|e| KeyVaultDBError::DatabaseError(format!("Failed to open IndexedDB: {}", e)))
}

/// Stores the encrypted mnemonic phrase in the database.
///
/// **Parameters**:
/// - `payload: CipherPayload` - The encrypted mnemonic phrase data to store.
///
/// **Returns**:
/// - `Result<(), KeyVaultDBError>` - Ok on success, or an error if storage fails.
///
/// **Async**: Yes
///
/// **Warning**: This method overwrites the existing mnemonic phrase in the database.
pub async fn set_encrypted_mnemonic_seed(payload: CipherPayload) -> Result<(), KeyVaultDBError> {
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
/// - `Result<Option<CipherPayload>, KeyVaultDBError>` - The encrypted mnemonic phrase if it exists, `None` if not found, or an error if retrieval fails.
///
/// **Async**: Yes
pub async fn get_encrypted_mnemonic_seed() -> Result<Option<CipherPayload>, KeyVaultDBError> {
    let db = open_db().await?;
    let tx = db
        .transaction(SEED_PHRASE_STORE)
        .with_mode(TransactionMode::Readonly)
        .build()?;
    let store = tx.object_store(SEED_PHRASE_STORE)?;

    if let Some(js_value) = store
        .get(SEED_PHRASE_KEY)
        .await
        .map_err(|e| KeyVaultDBError::DatabaseError(e.to_string()))?
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
/// - `Result<(), KeyVaultDBError>` - Ok on success, or an error if storage fails.
///
/// **Async**: Yes
pub async fn add_key_pair(mut pair: SphincsPlusKeyPair) -> Result<(), KeyVaultDBError> {
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
                    Err(KeyVaultDBError::DatabaseError(dom_err.to_string()))
                }
            } else {
                Err(KeyVaultDBError::DatabaseError(e.to_string()))
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
/// - `Result<Option<SphincsPlusKeyPair>, KeyVaultDBError>` - The child key if found, `None` if not found, or an error if retrieval fails.
///
/// **Async**: Yes
pub async fn get_key_pair(pub_key: &str) -> Result<Option<SphincsPlusKeyPair>, KeyVaultDBError> {
    let db = open_db().await?;
    let tx = db
        .transaction(CHILD_KEYS_STORE)
        .with_mode(TransactionMode::Readonly)
        .build()?;
    let store = tx.object_store(CHILD_KEYS_STORE)?;

    if let Some(js_value) = store
        .get(pub_key)
        .await
        .map_err(|e| KeyVaultDBError::DatabaseError(e.to_string()))?
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
/// - `Result<(), KeyVaultDBError>` - Ok on success, or an error if the operation fails.
///
/// **Async**: Yes
pub async fn clear_object_store(db: &Database, store_name: &str) -> Result<(), KeyVaultDBError> {
    let tx = db
        .transaction(store_name)
        .with_mode(TransactionMode::Readwrite)
        .build()
        .map_err(|e| {
            KeyVaultDBError::DatabaseError(format!(
                "Error starting transaction for {}: {}",
                store_name, e
            ))
        })?;
    let store = tx.object_store(store_name).map_err(|e| {
        KeyVaultDBError::DatabaseError(format!("Error getting object store {}: {}", store_name, e))
    })?;
    store.clear().map_err(|e| {
        KeyVaultDBError::DatabaseError(format!("Error clearing object store {}: {}", store_name, e))
    })?;
    tx.commit().await.map_err(|e| {
        KeyVaultDBError::DatabaseError(format!(
            "Error committing transaction for {}: {}",
            store_name, e
        ))
    })?;
    Ok(())
}