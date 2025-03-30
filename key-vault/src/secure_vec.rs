use std::ops::{Deref, DerefMut};
use zeroize::Zeroize;
#[cfg(test)]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(test)]
pub static ZEROIZED: AtomicBool = AtomicBool::new(false);

/// A secure vector that zeroizes its contents when dropped.
#[derive(Debug)]
pub struct SecureVec(Vec<u8>);

impl SecureVec {
    pub fn new_with_length(len: usize) -> Self {
        SecureVec(vec![0u8; len])
    }

    pub fn from_slice(slice: &[u8]) -> Self {
      SecureVec(slice.to_vec())
    }
}

impl Zeroize for SecureVec {
    fn zeroize(&mut self) {
        self.0.zeroize();
        #[cfg(test)]
        ZEROIZED.store(true, Ordering::SeqCst);
    }
}

// impl ZeroizeOnDrop for SecureVec {}
impl Drop for SecureVec {
    fn drop(&mut self) {
        self.zeroize();
    }
}

impl Deref for SecureVec {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for SecureVec {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
