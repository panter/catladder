#!/usr/bin/env bash
set -eo pipefail

function escapeForDotEnv () {
input="${1:-$(cat)}"
 input="${input//$'\n'/\\n}"
  if [[ "$input" == *\\n* ]]; then
    if [[ "$input" == *\"* && "$input" == *\'* && "$input" == *\`* ]]; then
      printf "\"%s\"\n" "$input" 
    elif [[ "$input" == *\"* && "$input" == *\'* ]]; then
      printf "`%s`\n" "$input"
    elif [[ "$input" == *\"* ]]; then
      printf "'%s'\n" "$input"
    else
      printf "\"%s\"\n" "$input"
    fi
  else
    printf "%s\n" "$input"
  fi
}
function collapseable_section_start () {
local section_title="${1}"
  local section_description="${2:-$section_title}"
  echo "::group::${section_description}"
}
function collapseable_section_end () {
echo "::endgroup::"
}
collapseable_section_start "injectvars" "Injecting variables"
export ENV_SHORT="dev"
export APP_DIR="apps/cli"
export ENV_TYPE="dev"
export BUILD_INFO_BUILD_ID="$(git describe --tags 2>/dev/null || git rev-parse HEAD)"
export BUILD_INFO_BUILD_TIME="unknown-build-time"
export BUILD_INFO_CURRENT_VERSION="$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\/tags\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")"
export HOSTNAME="unknown-host.example.com"
export ROOT_URL="https://unknown-host.example.com"
export HOSTNAME_INTERNAL="unknown-host.example.com"
export ROOT_URL_INTERNAL="https://unknown-host.example.com"
export NPM_TOKEN="$CL_dev_cli_NPM_TOKEN"
export _ALL_ENV_VAR_KEYS="[\"ENV_SHORT\",\"APP_DIR\",\"ENV_TYPE\",\"BUILD_INFO_BUILD_ID\",\"BUILD_INFO_BUILD_TIME\",\"BUILD_INFO_CURRENT_VERSION\",\"HOSTNAME\",\"ROOT_URL\",\"HOSTNAME_INTERNAL\",\"ROOT_URL_INTERNAL\",\"NPM_TOKEN\"]"
collapseable_section_end "injectvars"
node .catladder-generated/catci/index.js publish npm --dir apps/cli --env-type dev
echo "url=$ROOT_URL" >> "$GITHUB_OUTPUT"
