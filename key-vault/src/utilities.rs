use super::secure_vec::SecureVec;
use ckb_fips205_utils::{
    ckb_tx_message_all_from_mock_tx::{generate_ckb_tx_message_all_from_mock_tx, ScriptOrIndex},
    Hasher,
};
use ckb_mock_tx_types::{MockTransaction, ReprMockTransaction};
use wasm_bindgen::prelude::*;
use web_sys::js_sys::Uint8Array;

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
