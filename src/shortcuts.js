import { ipcRenderer, remote } from "electron";
import { createElement as e, useEffect, useState, useRef } from "react";
import { arrayMerge, keydownToAccelerator } from "./util.js";

const dispatchShortcutEvent = (s) =>
  window.dispatchEvent(new CustomEvent(s.action, { detail: s.value }));

const invalidShortcut = (s) =>
  (s.hasOwnProperty("value") && !s.value) ||
  !s.action ||
  !s.keys ||
  /^(?:(?:Super|Alt|Shift|Control|Already used)\+?)*$/.test(s.keys);

window.addEventListener("Quit", () => remote.getCurrentWindow().close());

const useShortcutManager = (show, config) => {
  const defaults = {
    global: [
      { keys: "MediaPlayPause", action: "Toggle pause" },
      { keys: "MediaNextTrack", action: "Skip track" },
      { keys: "MediaStop", action: "Stop player" },
    ],
    local: [
      { keys: "Control+M", action: "Edit shortcuts" },
      { keys: "Control+O", action: "Import tracks" },
      { keys: "Control+Q", action: "Quit" },
    ],
  };
  const [configLocal, setLocal] = useState(config.localShortcuts || []);
  const [configGlobal, setGlobal] = useState(config.globalShortcuts || []);
  const global = arrayMerge(
    (s) => s.action + s.value,
    defaults.global,
    configGlobal || []
  );
  const local = arrayMerge((s) => s.action, defaults.local, configLocal || []);
  const all = local.concat(global);

  const invalidLocal = local.some(invalidShortcut);
  const invalidGlobal = global.some(invalidShortcut);

  useEffect(() => {
    if (show) return;
    if (invalidLocal) setLocal((l) => l.filter((k) => !invalidShortcut(k)));
    if (invalidGlobal) setGlobal((l) => l.filter((k) => !invalidShortcut(k)));
  }, [show]);

  useEffect(
    () =>
      config.setConfig((c) => ({
        ...c,
        globalShortcuts: configGlobal,
        localShortcuts: configLocal,
      })),
    [configGlobal, configLocal]
  );

  useEffect(() => {
    if (show || invalidLocal || invalidGlobal)
      return ipcRenderer.invoke("unregister-shortcuts") && undefined;
    ipcRenderer.invoke("register-shortcuts", global);
    ipcRenderer.on("shortcut-triggered", (_, s) => dispatchShortcutEvent(s));
    return () => ipcRenderer.removeAllListeners("shorcut-triggered");
  }, [show, configGlobal]);

  useEffect(() => {
    if (show) return;
    const interceptKeys = (e) => {
      const shortcut = local.find((s) => s.keys == keydownToAccelerator(e));
      if (!shortcut) return;
      e.preventDefault();
      dispatchShortcutEvent(shortcut);
    };
    window.addEventListener("keydown", interceptKeys, true);
    return () => window.removeEventListener("keydown", interceptKeys, true);
  }, [show, configLocal]);

  return { local, global, all, setLocal, setGlobal };
};

const ShortcutItem = ({
  action,
  keys,
  value,
  tracks,
  all,
  setShortcut,
  close,
}) => {
  return e(
    "label",
    null,
    e("span", null, action),
    action === "Play track" &&
      e(
        "select",
        {
          value,
          key: "value",
          onChange: (e) =>
            setShortcut((s) => ({ ...s, value: e.target.value })),
        },
        e("option"),
        tracks
          .filter(
            (f) => value === f.path || all.every((s) => s.value !== f.path)
          )
          .map((f) => e("option", { value: f.path, key: f.path }, f.name))
      ),
    e("input", {
      key: "keys",
      type: "text",
      placeholder: "enter shortcut",
      value: keys || "",
      onChange: () => {},
      onKeyDown: (e) => {
        if (e.key === "Enter") return close();
        if (/Esc|Tab|Audio|Microphone|Channel/.test(e.key)) return;
        e.preventDefault();
        const fullKey = keydownToAccelerator(e);
        const used = all.some(
          (t) =>
            t.keys === fullKey && !(t.action === action && t.value === value)
        );
        setShortcut((s) => ({ ...s, keys: used ? "Already used" : fullKey }));
      },
    })
  );
};

const ShortcutModal = ({ config, show, close }) => {
  const { local, global, all, setLocal, setGlobal } = useShortcutManager(
    show,
    config
  );
  const modalRef = useRef(null);
  useEffect(() => {
    if (show) modalRef.current.querySelector('input').focus();
  }, [show]);

  if (!show) return null;

  return e(
    "div",
    {
      ref: modalRef,
      id: "shortcut-modal",
      className: "modal",
      onMouseDown: (e) => e.target === e.currentTarget && close(),
    },
    local.map((s) =>
      e(ShortcutItem, {
        ...s,
        key: s.action + s.value,
        all,
        close,
        setShortcut: (f) =>
          setLocal((l) =>
            l.includes(s) ? l.map((t) => (t === s ? f(t) : t)) : [...l, f(s)]
          ),
      })
    ),
    global.map((s) =>
      e(ShortcutItem, {
        ...s,
        key: s.action + s.value,
        all,
        tracks: config.tracks,
        setShortcut: (f) =>
          setGlobal((l) =>
            l.includes(s) ? l.map((t) => (t === s ? f(t) : t)) : [...l, f(s)]
          ),
      })
    ),
    e(
      "button",
      {
        className: "button",
        onClick: () => setGlobal((l) => l.concat([{ action: "Play track" }])),
        disabled: config.tracks.every((f) =>
          global.some((s) => s.value === f.path)
        ),
      },
      "add track shortcut"
    )
  );
};

export default ShortcutModal;
