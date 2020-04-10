# DiscordSoundBot
A discord bot for playing sounds locally

## planned features
- [ ] drop file import
- [ ] youtube / url import
- [ ] save file list + bot token
- [ ] configurable keyboard shortcuts for playing specific file
- [ ] group / category???
- [ ] fix logout??

## build haxx

1. run `node install`
2. patch `discord.js/src/client/websocket/handlers/index.js`
```js
import(`./${name}.js`).then(m => {handlers[name] = m.default;});
```
3. patch `discord.js/src/client/voice/util/Secretbox.js`
```js
const { default: lib } = await import(libName);
```
4. patch `prim-media/src/util/loader.js`
```js
      const module = {};
      (async () => {
        const dep = await import(name);
        const fn = reqFn ? reqFn(dep) : dep;
        Object.assign(module, {
          [objMap.module || 'module']: dep,
          [objMap.name || 'name']: name,
          [objMap.fn || 'fn']: fn,
        });
      })();
      return module;
```
5. run `num run make`
