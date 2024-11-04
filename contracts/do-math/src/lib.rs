#![no_std]

use soroban_sdk::{contract, contractimpl, Address};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn do_math(source: Address, a: i128, b: i128) -> i128 {
        source.require_auth();
        
        a + b
    }
}
