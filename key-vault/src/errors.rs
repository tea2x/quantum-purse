use indexed_db_futures::error::Error as DBError;
use serde_wasm_bindgen::Error as SerdeError;
use std::fmt;

#[derive(Debug)]
pub enum KeyVaultError {
    SerializationError(String),
    DatabaseError(String),
}

impl fmt::Display for KeyVaultError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            KeyVaultError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            KeyVaultError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
        }
    }
}

impl KeyVaultError {
    pub fn to_jsvalue(&self) -> wasm_bindgen::JsValue {
        wasm_bindgen::JsValue::from_str(&self.to_string())
    }
}

impl From<DBError> for KeyVaultError {
    fn from(e: DBError) -> Self {
        KeyVaultError::DatabaseError(e.to_string())
    }
}

impl From<SerdeError> for KeyVaultError {
    fn from(e: SerdeError) -> Self {
        KeyVaultError::SerializationError(e.to_string())
    }
}
