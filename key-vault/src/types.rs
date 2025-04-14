use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Scrypt param structure.
pub struct ScryptParam {
    pub log_n: u8,
    pub r: u32,
    pub p: u32,
    pub len: usize,
}

/// Represents an encrypted payload containing salt, IV, and ciphertext, all hex-encoded.
///
/// **Fields**:
/// - `salt: String` - Hex-encoded salt used for key derivation with Scrypt.
/// - `iv: String` - Hex-encoded initialization vector (nonce) for AES-GCM encryption.
/// - `cipher_text: String` - Hex-encoded encrypted data produced by AES-GCM.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CipherPayload {
    pub salt: String,
    pub iv: String,
    pub cipher_text: String,
}

/// Represents a SPHINCS+ key pair with the public key and an encrypted private key.
///
/// **Fields**:
/// - `index: u32` - db addition order
/// - `pub_key: String` - Hex-encoded SPHINCS+ public key.
/// - `pri_enc: CipherPayload` - Encrypted SPHINCS+ private key, stored as a `CipherPayload`.
/// TODO improve size
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SphincsPlusKeyPair {
    pub index: u32,
    pub pub_key: String,
    pub pri_enc: CipherPayload,
}

/// ID of all 12 SPHINCS+ variants.
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum SphincsVariant {
    Sha2128F = 48,
    Sha2128S,
    Sha2192F,
    Sha2192S,
    Sha2256F,
    Sha2256S,
    Shake128F,
    Shake128S,
    Shake192F,
    Shake192S,
    Shake256F,
    Shake256S,
}

impl SphincsVariant {
    pub fn entropy_size(&self) -> usize {
        match self {
            Self::Sha2256F | Self::Sha2256S | Self::Shake256F | Self::Shake256S => 96,
            _ => 64,
        }
    }
}