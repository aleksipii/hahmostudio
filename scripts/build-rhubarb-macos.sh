#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
project_dir="$PWD"
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/hahmostudio-rhubarb.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT
cd "$build_dir"
curl -fsSL https://api.github.com/repos/DanielSWolf/rhubarb-lip-sync/tarball/v1.14.0 -o source.tar.gz
printf '%s\n' 'ea61747eee44c5edab62b70ff3fb071b1108adaabdf0af570bbb75ec4bb62c02  source.tar.gz' | shasum -a 256 -c -
mkdir source
tar -xzf source.tar.gz -C source --strip-components=1
curl -fsSL https://archives.boost.io/release/1.84.0/source/boost_1_84_0.tar.bz2 -o boost.tar.bz2
printf '%s\n' 'cc4b893acf645c9d4b698e9a0f08ca8846aa5d6c68275c14c3e7949c24109454  boost.tar.bz2' | shasum -a 256 -c -
tar -xjf boost.tar.bz2 boost_1_84_0/boost
cmake -S source -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DBoost_INCLUDE_DIR="$build_dir/boost_1_84_0"
cmake --build build --target rhubarb -j 4
mkdir -p "$project_dir/.private-runtime/rhubarb"
cp build/rhubarb/rhubarb "$project_dir/.private-runtime/rhubarb/rhubarb"
cp -R build/rhubarb/res "$project_dir/.private-runtime/rhubarb/"
cp source/LICENSE.md "$project_dir/.private-runtime/rhubarb/LICENSE.md"
chmod +x "$project_dir/.private-runtime/rhubarb/rhubarb"
file "$project_dir/.private-runtime/rhubarb/rhubarb"
