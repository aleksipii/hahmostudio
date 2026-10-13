#!/bin/zsh
set -e
cd -- "${0:A:h}/native"
if ! command -v cargo >/dev/null 2>&1; then
  print "Asenna Rust-työkalut rustup.rs:stä tai käytä paketoitua Koeta.app-sovellusta."
  read
  exit 1
fi
exec cargo run --locked --release -p hs-app
