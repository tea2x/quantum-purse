use serde::{Deserialize, Serialize};
use std::fmt;
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
    /// BIP39 accepts entropy level that is a multiple of 32 bytes.
    /// Here're the entropy level Quantum Purse chooses for all SPHINCS+ param sets that's BIP39 compatible:
    ///     - For 128* variant, 48 bytes entropy required so 64(2*32) bytes is chosen (~ 48 words).
    ///     - For 192* variant, 72 bytes entropy required so 96(3*32) bytes is chosen (~ 72 words).
    ///     - For 256* variant, 96 bytes entropy required so 96(3*32) bytes is chosen (~ 72 words).
    /// Extra bytes are truncated in case of 128* and 192* variants.
    ///
    pub fn bip39_compatible_entropy_size(&self) -> usize {
        match self {
            Self::Sha2128F | Self::Sha2128S | Self::Shake128F | Self::Shake128S => 2 * 32,
            _ => 3 * 32,
        }
    }
}

impl fmt::Display for SphincsVariant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            SphincsVariant::Sha2128F => "Sha2128F",
            SphincsVariant::Sha2128S => "Sha2128S",
            SphincsVariant::Sha2192F => "Sha2192F",
            SphincsVariant::Sha2192S => "Sha2192S",
            SphincsVariant::Sha2256F => "Sha2256F",
            SphincsVariant::Sha2256S => "Sha2256S",
            SphincsVariant::Shake128F => "Shake128F",
            SphincsVariant::Shake128S => "Shake128S",
            SphincsVariant::Shake192F => "Shake192F",
            SphincsVariant::Shake192S => "Shake192S",
            SphincsVariant::Shake256F => "Shake256F",
            SphincsVariant::Shake256S => "Shake256S",
        };
        write!(f, "{}", s)
    }
}
