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
collapseable_section_end "injectvars"
collapseable_section_start "nodeinstall" "Ensure node version"
if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; elif [ -f /root/.nvm/nvm.sh ]; then export NVM_DIR=/root/.nvm; source /root/.nvm/nvm.sh; fi
if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi
collapseable_section_end "nodeinstall"
cd .
collapseable_section_start "nodeinstall" "Ensure node version"
if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; elif [ -f /root/.nvm/nvm.sh ]; then export NVM_DIR=/root/.nvm; source /root/.nvm/nvm.sh; fi
if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi
collapseable_section_end "nodeinstall"
collapseable_section_start "pnpminstall" "pnpm install"
if ! command -v pnpm &> /dev/null; then corepack enable pnpm 2>/dev/null || npm install -g pnpm@11.20.0; fi
pnpm install --frozen-lockfile
collapseable_section_end "pnpminstall"
pnpm build
