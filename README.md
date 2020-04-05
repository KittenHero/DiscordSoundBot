## Build Instruction

### linux

Make sure dev tools are installed and `/usr/bin/env python` is `python2` (or `nw-gyp` will break)

```
npm install -g nw-builder nw-gyp node-pre-gyp

npm ci --production --arch=x64 --runtime=node-webkit --target=0.44.6 --build_from_source=true --node_gyp=$(which nw-gyp)

sed "s/typeof window !==/typeof process ===/" -i node_modules/discord.js/src/util/Constants.js

npm run build -- -p linux64 -v 0.44.6
```
