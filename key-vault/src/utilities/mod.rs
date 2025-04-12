use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use crate::secure_vec::SecureVec;
use scrypt::{scrypt, Params};
use hex::{decode, encode};
use super::types::{CipherPayload, ScryptParam};
use super::constants::{ENC_SCRYPT, SALT_LENGTH, IV_LENGTH};
use zeroize::Zeroize;
#[cfg(test)]
mod tests;

/// Generates random bytes for cryptographic use.
///
/// **Parameters**:
/// - `length: usize` - The number of random bytes to generate.
///
/// **Returns**:
/// - `Result<SecureVec, String>` - A Secure vector of random bytes on success, or an error message on failure.
pub fn get_random_bytes(length: usize) -> Result<SecureVec, getrandom_v03::Error> {
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
pub fn derive_scrypt_key(
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
pub fn encrypt(password: &[u8], input: &[u8]) -> Result<CipherPayload, String> {
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
pub fn decrypt(password: &[u8], payload: CipherPayload) -> Result<SecureVec, String> {
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
