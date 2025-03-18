use super::*;
use std::sync::atomic::Ordering;

#[test]
fn test_pass_encrypt_decrypt() {
  let password = vec![1, 2, 3];
  let data = b"test";
  let payload = encrypt(&password, data).unwrap();
  let decrypted = decrypt(&password, payload).unwrap();
  assert_eq!(decrypted.as_ref(), data);
}

#[test]
fn test_fail_encrypt_decrypt() {
  let password = vec![1, 2, 3];
  let data = b"test";
  let payload = encrypt(&password, data).unwrap();
  let password1 = vec![2, 2, 3];
  let result = decrypt(&password1, payload);
  assert!(result.is_err());
}


#[test]
fn test_zeroize_on_drop_decrypt_output() {
  use super::secure_vec::ZEROIZED;
  ZEROIZED.store(false, Ordering::SeqCst);
  let password = vec![1, 2, 3];
  let data = b"test";
  let payload = encrypt(&password, data).unwrap();
  {
      let _decrypted = decrypt(&password, payload).unwrap();
  } // decrypted is dropped here
  assert!(ZEROIZED.load(Ordering::SeqCst));
}