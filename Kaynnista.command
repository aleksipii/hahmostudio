#!/bin/zsh
set -e
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  for task_node_dir in "$HOME"/.nvm/versions/node/v*/bin(N); do
    if [[ -x "$task_node_dir/node" ]]; then
      export PATH="$task_node_dir:$PATH"
    fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  print "Node.js 24 tarvitaan Hahmostudion käynnistämiseen."
  read
  exit 1
fi
print "Avaa selaimessa http://127.0.0.1:4176/"
exec node server/private-server.mjs
