#[macro_export]
macro_rules! debug {
    ($($arg:tt)*) => {
        web_sys::console::log_1(&format!($($arg)*).into());
    }
}

#[macro_export]
macro_rules! sphincs_keygen {
    ($variant:expr, $rng:expr, $($pat:pat, $module:ident),*) => {
        match $variant {
            $(
                $pat => {
                    let (pub_key, pri_key) = $module::try_keygen_with_rng($rng)?;
                    Ok((SecureVec::from_slice(&pub_key.into_bytes()), SecureVec::from_slice(&pri_key.into_bytes())))
                }
            ),*
        }
    };
}

#[macro_export]
macro_rules! sphincs_sign {
    ($variant:expr, $pri_key:expr, $message:expr, $($pat:pat, $module:ident),*) => {
        match $variant {
            $(
                $pat => {
                    let mut signing_key = $module::PrivateKey::try_from_bytes(
                        $pri_key.as_ref().try_into().expect("Fail to parse private key"),
                    )
                    .map_err(|e| JsValue::from_str(&format!("Unable to load private key: {:?}", e)))?;
                    let signature = signing_key.try_sign($message, &[], true)
                        .map_err(|e| JsValue::from_str(&format!("Signing error: {:?}", e)))?;
                    signing_key.zeroize(); // Zeroize the private key
                    Ok(Uint8Array::from(signature.as_slice()))
                }
            ),*
        }
    };
}