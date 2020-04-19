/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import { remote, shell, ipcRenderer } from "electron";
import {
  createElement as e,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";

import "./index.css";
import playSVG from "./ionicons/play.svg";
import pauseSVG from "./ionicons/pause.svg";
import skipSVG from "./ionicons/play-skip-forward.svg";
import stopSVG from "./ionicons/stop.svg";
import repeatSVG from "./ionicons/repeat.svg";
import repeat1SVG from "./ionicons/repeat-1.svg";
import listSVG from "./ionicons/list.svg";
import settingsSVG from "./ionicons/settings.svg";
import trashSVG from "./ionicons/trash.svg";
import createSVG from "./ionicons/create.svg";
import logoutSVG from "./ionicons/log-out.svg";
import personAddSVG from "./ionicons/person-add.svg";

window.client = remote.getGlobal("discordClient");
const resetClient = () => {
  window.client.destroy();
  window.client = remote.getGlobal("discordClient");
};
window.onbeforeunload = resetClient;

const useDiscordConnection = (client, config, saveConfig) => {
  const initialState = {
    token: config.token || "",
    connecting: false,
    selectedGuild: undefined,
    selectedChannel: undefined,
    clientUpdated: new Date(),
    error: undefined,
  };
  const reducer = (state, action) => {
    switch (action.type) {
      case "set-token":
        return {
          ...state,
          token: action.value,
        };
      case "connect":
        return {
          ...state,
          connecting: action.value,
          error: action.error,
        };
      case "select-guild":
        return {
          ...state,
          selectedGuild: action.value,
          selectedChannel: undefined,
        };
      case "select-channel":
        return {
          ...state,
          selectedChannel: action.value,
          error: action.error,
        };
      case "error":
        return {
          ...state,
          error: action.value,
        };
      case "update-client":
        return {
          ...state,
          clientUpdated: new Date(),
        };
      case "logout":
        resetClient();
        return {
          ...state,
          clientUpdated: new Date(),
          selectedGuild: undefined,
          selectedChannel: undefined,
        };
      case "save-config":
        Object.assign(config, { token: state.token, ...action.value });
        saveConfig(config);
      default:
        return state;
    }
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  const { error, token, connecting, selectedChannel } = state;

  useEffect(() => {
    if (!error) return;
    alert(error);
    dispatch({ type: "error" });
  }, [error]);

  useEffect(() => {
    if (!connecting) return;
    if (!navigator.onLine) {
      dispatch({
        type: "connect",
        value: false,
        error: "No internet connection.",
      });
    } else {
      client
        .login(token)
        .then(() => dispatch({ type: "save-config" }))
        .catch((e) => e)
        .then((e) =>
          dispatch({ type: "connect", value: false, error: e && e.message })
        );
    }
  }, [token, connecting]);

  useEffect(() => {
    if (!selectedChannel) {
      if (!client.voice) return;
      client.voice.connections.each((con) => con.disconnect());
    } else {
      selectedChannel
        .join()
        .then((con) => {
          const resetChannel = () => dispatch({ type: "select-channel" })
          con.on("disconnect", resetChannel);
          con.on("closing", resetChannel);
        })
        .catch((e) => {
          dispatch({ type: "select-channel", error: e.message });
        });
    }
  }, [selectedChannel]);

  useEffect(() => {
    const updateClient = () => dispatch({ type: "update-client" });
    client.on("ready", updateClient);
    client.on("guildCreate", updateClient);
    client.on("guildDelete", updateClient);
    client.on("channelCreate", updateClient);
    client.on("channelDelete", updateClient);
    client.on("invalidated", () => {
      dispatch({ type: "error", error: "Session invalidated" });
      remote.getCurrentWindow().close();
    });

    return () => {
      resetClient();
      updateClient();
    };
  }, []);

  return [state, dispatch];
};

const useTrackController = (client, channel, config, saveConfig) => {
  const initialState = {
    tracks: config.tracks || [],
    trackQueue: [],
    playing: null,
    lastPlayed: null,
    paused: false,
    loop: 0,
    shortcutModal: undefined,
  };
  const reducer = (state, action) => {
    switch (action.type) {
      case "add-tracks":
        return {
          ...state,
          tracks: state.tracks.concat(
            action.value.filter(
              (f) => !state.tracks.some((g) => f.path === g.path)
            )
          ),
        };
      case "remove-track":
        return {
          ...state,
          tracks: state.tracks.filter((f) => f !== action.value),
        };
      case "reorder-tracks":
        const tracks = state.tracks.slice();
        const [from, to] = action.value;
        tracks.splice(to, 0, tracks.splice(from, 1)[0]);
        return { ...state, tracks };
      case "toggle-loop":
        return {
          ...state,
          loop: (state.loop + 1) % 3,
        };
      case "playing":
        const stream = action.value;
        const { trackQueue, loop, lastPlayed } = state;
        const playing = stream && { stream, source: trackQueue[0] };
        return {
          ...state,
          playing,
          // clears last played when queue is done
          lastPlayed:
            !trackQueue.length && !loop ? playing : playing || lastPlayed,
          trackQueue: playing
            ? trackQueue.slice(1)
            : loop == 0
            ? trackQueue
            : loop == 1
            ? trackQueue.concat([lastPlayed.source])
            : [lastPlayed.source].concat(trackQueue),
        };
      case "queue-track":
        return {
          ...state,
          trackQueue: [...state.trackQueue, action.value],
        };
      case "unqueue-track":
        return {
          ...state,
          trackQueue: state.trackQueue.filter((_, i) => i !== action.value),
        };
      case "toggle-pause":
        return {
          ...state,
          paused: !state.paused,
        };
      case "play-track":
        if (state.lastPlayed) state.lastPlayed.stream.destroy();
        return {
          ...state,
          playing: null,
          lastPlayed: null,
          trackQueue: [action.value],
        };
      case "skip": {
        const { lastPlayed, trackQueue, loop } = state;
        if (lastPlayed) lastPlayed.stream.destroy();
        return {
          ...state,
          lastPlayed: null,
          paused: false,
          playing: null,
          trackQueue:
            loop == 1 && lastPlayed
              ? trackQueue.concat([lastPlayed.source])
              : trackQueue,
        };
      }
      case "stop":
        if (state.lastPlayed) state.lastPlayed.stream.destroy();
        return {
          ...state,
          playing: null,
          lastPlayed: null,
          trackQueue: [],
        };
      case "configure-shortcuts": {
        const { track, key } = action.value || {};
        const keyValid =
          key &&
          !/^(?:(?:Super|Alt|Shift|Control|Already used)\+?)+$/.test(key);
        const tracks =
          track && keyValid
            ? state.tracks.map((t) =>
                t.path == track ? { path: t.path, name: t.name, key } : t
              )
            : state.tracks;
        return { ...state, tracks, shortcutModal: action.value };
      }
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const { tracks, trackQueue, playing, paused, shortcutModal } = state;

  useEffect(() => {
    if (shortcutModal)
      return ipcRenderer.invoke("unregister-shortcuts") && undefined;

    ipcRenderer.invoke(
      "register-shortcuts",
      tracks.filter((f) => f.key)
    );
    const shortcutHandler = (_event, value) =>
      dispatch({ type: "play-track", value });
    ipcRenderer.on("shortcut-triggered", shortcutHandler);
    return () =>
      ipcRenderer.removeListener("shortcut-triggered", shortcutHandler);
  }, [shortcutModal]);

  useEffect(
    () =>
      saveConfig({
        tracks: tracks.map((f) => ({ path: f.path, name: f.name, key: f.key })),
      }),
    [tracks]
  );

  useEffect(() => {
    if (!playing) return;
    if (paused) {
      playing.stream.pause();
    } else if (playing.stream.paused) {
      playing.stream.resume();
    }
  }, [playing, paused]);

  useEffect(() => {
    if (!channel) {
      if (playing || trackQueue.length) {
        dispatch({ type: "stop" });
      }
      return;
    }
    if (!trackQueue.length || playing) return;

    client.voice.connections.each((con) => {
      const stream = con.play(trackQueue[0].path);
      dispatch({ type: "playing", value: stream });
      stream.on("finish", () => dispatch({ type: "playing" }));
    });
  }, [channel, trackQueue, playing]);

  return [state, dispatch];
};

const Track = ({
  track,
  queueTrack,
  playTrack,
  configureShortcuts,
  deleteTrack,
  ...rest
}) => {
  return e(
    "div",
    { className: "track", ...rest },
    e("div", null, track.name),
    e("div", null, track.key),
    e("img", {
      className: `symbol ${playTrack ? "selectable" : "disabled"}`,
      title: "play",
      src: playSVG,
      onClick: playTrack,
    }),
    e("img", {
      className: `symbol ${queueTrack ? "selectable" : "disabled"}`,
      title: "add to queue",
      src: listSVG,
      onClick: queueTrack,
    }),
    e("img", {
      className: "symbol selectable",
      title: "bind shortcuts",
      src: settingsSVG,
      onClick: configureShortcuts,
    }),
    e("img", {
      className: "symbol selectable",
      title: "remove",
      src: trashSVG,
      onClick: deleteTrack,
    })
  );
};

let draggedOver;
const Player = ({ client, channel, config, saveConfig }) => {
  const [
    { loop, playing, paused, tracks, trackQueue, shortcutModal },
    dispatch,
  ] = useTrackController(client, channel, config, saveConfig);

  const inputRef = useRef(null);
  return e(
    "div",
    { className: "flex-column" },
    e(
      "div",
      { id: "sound-controller" },
      e(
        "div",
        {
          id: "file-import",
          className: "selectable",
          onDragOver: (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
          },
          onDrop: (ev) => {
            ev.preventDefault();
            dispatch({
              type: "add-tracks",
              value: new Array(...ev.dataTransfer.items)
                .filter((i) => i.kind === "file" && /audio\/.*/.test(i.type))
                .map((i) => i.getAsFile()),
            });
          },
          onClick: () => inputRef.current.click(),
        },
        e("input", {
          ref: inputRef,
          type: "file",
          accept: "audio/*",
          value: "",
          multiple: true,
          hidden: true,
          onChange: (ev) =>
            dispatch({
              type: "add-tracks",
              value: new Array(...ev.target.files),
            }),
        }),
        "import tracks"
      ),
      !playing &&
        e("img", {
          className: "symbol disabled",
          title: "play",
          src: playSVG,
        }),
      playing &&
        e("img", {
          className: "symbol selectable",
          title: paused ? "play" : "pause",
          src: paused ? playSVG : pauseSVG,
          onClick: () => dispatch({ type: "toggle-pause" }),
        }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "skip",
        src: skipSVG,
        onClick: () => dispatch({ type: "skip" }),
      }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "stop",
        disabled: !playing,
        src: stopSVG,
        onClick: () => dispatch({ type: "stop" }),
      }),
      e("img", {
        className: `symbol ${loop ? "selectable" : "disabled"}`,
        title: ["loop off", "loop queue", "loop song"][loop],
        src: loop < 2 ? repeatSVG : repeat1SVG,
        onClick: () => dispatch({ type: "toggle-loop" }),
      }),
      e(
        "div",
        { id: "track-queue" },
        trackQueue.map((s, i) =>
          e(
            "div",
            { key: i, className: "queue-item" },
            e("span", null, `${i + 1}: ${s.name}`),
            e("img", {
              className: "symbol selectable",
              src: trashSVG,
              onClick: () => dispatch({ type: "unqueue-track", value: i }),
            })
          )
        )
      ),
      e(
        "div",
        { id: "playing" },
        playing && e("span", null, `playing: ${playing.source.name}`)
      )
    ),
    e(
      "div",
      {
        id: "track-list",
      },
      tracks.map((f, i) =>
        e(Track, {
          key: f.path,
          track: f,
          deleteTrack: () => dispatch({ type: "remove-track", value: f }),
          configureShortcuts: () =>
            dispatch({
              type: "configure-shortcuts",
              value: { track: f.path, key: f.key },
            }),
          queueTrack:
            channel && (() => dispatch({ type: "queue-track", value: f })),
          playTrack:
            channel && (() => dispatch({ type: "play-track", value: f })),
          "data-id": i,
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/html", e.currentTarget);
          },
          onDragEnd: (e) => {
            let to = +draggedOver.dataset.id;
            if (i < to) --to;
            if (draggedOver.classList.contains("insert-after")) ++to;
            dispatch({ type: "reorder-tracks", value: [i, to] });
            draggedOver.classList.toggle("insert-before", false);
            draggedOver.classList.toggle("insert-after", false);
          },
          onDragOver: (e) => {
            e.preventDefault();
            if (draggedOver) {
              draggedOver.classList.toggle("insert-before", false);
              draggedOver.classList.toggle("insert-after", false);
            }
            draggedOver = e.currentTarget;
            const relX = e.clientX - draggedOver.offsetLeft;
            const width = draggedOver.offsetWidth / 2;
            if (relX < width) {
              draggedOver.classList.toggle("insert-before", true);
            } else {
              draggedOver.classList.toggle("insert-after", true);
            }
          },
        })
      )
    ),
    shortcutModal &&
      e(
        "div",
        {
          className: "modal",
          id: "shortcut-modal",
          onClick: (e) =>
            e.target === e.currentTarget &&
            dispatch({ type: "configure-shortcuts" }),
        },
        e(
          "select",
          {
            value: shortcutModal.track,
            onChange: (e) =>
              dispatch({
                type: "configure-shortcuts",
                value: tracks
                  .filter((f) => f.path === e.target.value)
                  .map((f) => ({ track: f.path, key: f.key }))[0],
              }),
          },
          tracks.map((f) => e("option", { value: f.path, key: f.path }, f.name))
        ),
        e("input", {
          type: "text",
          placeholder: "enter shortcut",
          value: shortcutModal.key || "",
          onChange: () => {},
          onKeyDown: (e) => {
            if (e.key === "Enter")
              return dispatch({ type: "configure-shortcuts" });
            if (/Esc|Media|Audio|Microphone|Channel/.test(e.key)) return;
            e.preventDefault();
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
              "*": "nummul",
              "/": "numdiv",
              ".": "numdec",
            };
            const keyNames = { "+": "plus", " ": "Space", Meta: "Super" };
            const key =
              e.location === 3
                ? numkeys[e.key] || `num${e.key}`
                : keyNames[e.key] || e.key;
            if (!mods.includes(key)) mods.push(key);
            const fullKey = mods.join("+");
            const used = tracks.some(
              (f) => f.key === fullKey && f.path != shortcutModal.track
            );
            dispatch({
              type: "configure-shortcuts",
              value: {
                ...shortcutModal,
                key: used ? "Already used" : fullKey,
              },
            });
          },
        })
      )
  );
};

const BotUser = ({ client, logout }) => {
  const [invite, setInvite] = useState("");
  useEffect(() => {
    client
      .generateInvite(["VIEW_CHANNEL", "CONNECT", "SPEAK"])
      .then((link) => setInvite(link));
  }, []);
  return e(
    "div",
    { className: "user-label" },
    e(
      "div",
      {
        className: "online rs-2",
      },
      e("img", {
        className: "icon",
        src: client.user.displayAvatarURL(),
      })
    ),
    e("strong", null, client.user.username),
    e("div", null, "#", client.user.discriminator),
    invite &&
      e("img", {
        className: "symbol rs-2 selectable",
        src: personAddSVG,
        title: "add me to your server",
        onClick: () => shell.openExternal(invite),
      }),
    e("img", {
      className: "symbol rs-2 selectable",
      src: logoutSVG,
      title: "log out",
      onClick: logout,
    })
  );
};

const Guild = ({ guild, className, children, ...rest }) => {
  return e(
    "div",
    { className: `list-item ${className}`, ...rest },
    e("img", { className: "icon rs-2", src: guild.iconURL() }),
    e("strong", null, guild.name),
    children
  );
};

const App = ({ config, saveConfig }) => {
  const client = window.client;
  const [
    { token, connecting, selectedGuild, selectedChannel },
    dispatch,
  ] = useDiscordConnection(client, config, saveConfig);

  const userComponent = client.readyAt
    ? e(BotUser, {
        client: client,
        logout: () => dispatch({ type: "logout" }),
      })
    : e(
        "div",
        { id: "token-form" },
        e(
          "label",
          {},
          "Bot Token:",
          e("input", {
            value: token,
            onChange: (e) =>
              dispatch({ type: "set-token", value: e.target.value }),
            type: "text",
          })
        ),
        e(
          "div",
          { className: "stretch-left" },
          e("img", {
            className: "symbol selectable",
            src: createSVG,
            onClick: () =>
              shell.openExternal(
                "https://discordapp.com/developers/docs/intro#bots-and-apps"
              ),
            title: "Create a new bot",
          }),
          e(
            "button",
            {
              className: "button",
              disabled: connecting,
              onClick: () => dispatch({ type: "connect", value: true }),
            },
            "connect"
          )
        )
      );
  const guildComponent = selectedGuild
    ? e(Guild, {
        guild: selectedGuild,
        className: "selected",
        onClick: () => dispatch({ type: "select-guild" }),
      })
    : client.readyAt &&
      e(
        "div",
        { id: "select-guild" },
        client.voiceGuilds.map((g) =>
          e(Guild, {
            guild: g,
            key: g.name,
            onClick: () => dispatch({ type: "select-guild", value: g }),
            className: "selectable",
          })
        )
      );
  const channelComponent = selectedChannel
    ? e(
        "div",
        {
          className: "selected online",
          onClick: () => dispatch({ type: "select-channel" }),
        },
        selectedChannel.name
      )
    : selectedGuild &&
      e(
        "div",
        { id: "select-channel" },
        client.voiceChannelsIn(selectedGuild).map((ch) =>
          e(
            "div",
            {
              className: "selectable",
              key: ch.name,
              onClick: () => dispatch({ type: "select-channel", value: ch }),
            },
            ch.name
          )
        )
      );

  return e(
    "div",
    null,
    e(
      "div",
      { className: "flex-column" },
      userComponent,
      guildComponent,
      channelComponent
    ),
    e(Player, {
      client,
      channel: selectedChannel,
      config,
      saveConfig: (value) => dispatch({ type: "save-config", value }),
    })
  );
};

(async () => {
  const config = await ipcRenderer.invoke("read-config");
  ReactDOM.render(
    e(App, {
      config,
      saveConfig: (c) => ipcRenderer.invoke("save-config", c),
    }),
    document.getElementById("app")
  );
})();
