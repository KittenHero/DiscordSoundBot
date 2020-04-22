const onClickOrEnter = (fn) => ({
  tabIndex: 0,
  onClick: fn,
  onKeyDown: fn && ((e) => /Enter| /.test(e.key) && fn(e)),
});

const arrayMerge = (key, target, ...sources) =>
  sources.reduce(
    (a, b) =>
      b.reduce((c, y) => {
        const i = c.findIndex((x) => key(x) === key(y));
        if (i !== -1) c.splice(i, 1, y);
        else c.push(y);
        return c;
      }, a.slice()),
    target
  );

const keydownToAccelerator = (e) => {
  // TODO: test in macOS
  const mods = [
    e.ctrlKey && "Control",
    e.shiftKey && "Shift",
    e.altKey && "Alt",
    e.metaKey && "Super",
  ].filter((e) => e);
  const numkeys = {
    "+": "numadd",
    "-": "numsub",
    "*": "nummult",
    "/": "numdiv",
    ".": "numdec",
  };
  const keyNames = { "+": "plus", " ": "Space", Meta: "Super" };
  const key =
    e.location === 3
      ? numkeys[e.key] || `num${e.key}`
      : keyNames[e.key] ||
        (/^[a-z]$/.test(e.key) ? e.key.toUpperCase() : e.key);
  if (!mods.includes(key)) mods.push(key);
  return mods.join("+");
};

export { arrayMerge, keydownToAccelerator, onClickOrEnter };
