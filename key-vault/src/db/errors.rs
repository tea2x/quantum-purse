use indexed_db_futures::error::Error as DBError;
use serde_wasm_bindgen::Error as SerdeError;
use std::fmt;

#[derive(Debug)]
pub enum KeyVaultDBError {
    SerializationError(String),
    DatabaseError(String),
}

impl fmt::Display for KeyVaultDBError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            KeyVaultDBError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            KeyVaultDBError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
        }
    }
}

impl KeyVaultDBError {
    pub fn to_jsvalue(&self) -> wasm_bindgen::JsValue {
        wasm_bindgen::JsValue::from_str(&self.to_string())
    }
}

impl From<DBError> for KeyVaultDBError {
    fn from(e: DBError) -> Self {
        KeyVaultDBError::DatabaseError(e.to_string())
    }
}

impl From<SerdeError> for KeyVaultDBError {
    fn from(e: SerdeError) -> Self {
        KeyVaultDBError::SerializationError(e.to_string())
    }
}
