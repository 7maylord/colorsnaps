#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
artifacts_dir="$repo_root/smart-contracts/out"
output_dir="$repo_root/frontend/src/contracts/abis"

mkdir -p "$output_dir"

export_abi() {
  local source="$1"
  local destination="$2"
  jq '.abi' "$artifacts_dir/$source" > "$output_dir/$destination"
}

export_abi "ColorSnapGame.sol/ColorSnapGame.json" "ColorSnapGame.json"
export_abi "ColorSnapChallenge.sol/ColorSnapChallenge.json" "ColorSnapChallenge.json"
export_abi "ColorSnapDuelEscrow.sol/ColorSnapDuelEscrow.json" "ColorSnapDuelEscrow.json"
export_abi "ColorSnapDuel.sol/ColorSnapDuel.json" "ColorSnapDuel.json"
export_abi "ERC7984Mock.sol/ERC7984Mock.json" "ERC7984Mock.json"
