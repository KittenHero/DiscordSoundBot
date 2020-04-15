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
          con.on("closing", () => dispatch({ type: "select-channel" }));
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

const useSoundController = (client, channel, config, saveConfig) => {
  const initialState = {
    sounds: config.sounds || [],
    soundQueue: [],
    playing: null,
    lastPlayed: null,
    paused: false,
    loop: 0,
  };
  const reducer = (state, action) => {
    switch (action.type) {
      case "add-sounds":
        return {
          ...state,
          sounds: state.sounds.concat(
            action.value.filter(
              (f) => !state.sounds.some((g) => f.path === g.path)
            )
          ),
        };
      case "remove-sound":
        return {
          ...state,
          sounds: state.sounds.filter((f) => f !== action.value),
        };
      case "reorder-sound":
        const sounds = state.sounds.slice();
        const [from, to] = action.value;
        sounds.splice(to, 0, sounds.splice(from, 1)[0]);
        return { ...state, sounds };
      case "toggle-loop":
        return {
          ...state,
          loop: (state.loop + 1) % 3,
        };
      case "playing":
        const stream = action.value;
        const { soundQueue, loop, lastPlayed } = state;
        const playing = stream && { stream, source: soundQueue[0] };
        return {
          ...state,
          playing,
          // clears last played when queue is done
          lastPlayed:
            !soundQueue.length && !loop ? playing : playing || lastPlayed,
          soundQueue: playing
            ? soundQueue.slice(1)
            : loop == 0
            ? soundQueue
            : loop == 1
            ? soundQueue.concat([lastPlayed.source])
            : [lastPlayed.source].concat(soundQueue),
        };
      case "queue-sound":
        return {
          ...state,
          soundQueue: [...state.soundQueue, action.value],
        };
      case "unqueue-sound":
        return {
          ...state,
          soundQueue: state.soundQueue.filter((_, i) => i !== action.value),
        };
      case "toggle-pause":
        return {
          ...state,
          paused: !state.paused,
        };
      case "play-sound":
        if (state.lastPlayed) state.lastPlayed.stream.destroy();
        return {
          ...state,
          playing: null,
          lastPlayed: null,
          soundQueue: [action.value],
        };
      case "skip": {
        const { lastPlayed, soundQueue, loop } = state;
        if (lastPlayed) lastPlayed.stream.destroy();
        return {
          ...state,
          lastPlayed: null,
          paused: false,
          playing: null,
          soundQueue:
            loop == 1 && lastPlayed
              ? soundQueue.concat([lastPlayed.source])
              : soundQueue,
        };
      }
      case "stop":
        if (state.lastPlayed) state.lastPlayed.stream.destroy();
        return {
          ...state,
          playing: null,
          lastPlayed: null,
          soundQueue: [],
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const { sounds, soundQueue, playing, paused } = state;

  useEffect(
    () =>
      saveConfig({
        sounds: sounds.map((f) => ({ path: f.path, name: f.name })),
      }),
    [sounds]
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
      if (playing || soundQueue.length) {
        dispatch({ type: "stop" });
      }
      return;
    }
    if (!soundQueue.length || playing) return;

    client.voice.connections.each((con) => {
      const stream = con.play(soundQueue[0].path);
      dispatch({ type: "playing", value: stream });
      stream.on("finish", () => dispatch({ type: "playing" }));
    });
  }, [channel, soundQueue, playing]);

  return [state, dispatch];
};

const Sound = ({ sound, queueSound, playSound, deleteSound, ...rest }) => {
  return e(
    "div",
    { className: "sound", ...rest },
    e("div", null, sound.name),
    e("img", {
      className: `symbol ${playSound ? "selectable" : "disabled"}`,
      title: "play",
      src: playSVG,
      onClick: playSound,
    }),
    e("img", {
      className: `symbol ${queueSound ? "selectable" : "disabled"}`,
      title: "add to queue",
      src: listSVG,
      onClick: queueSound,
    }),
    e("img", {
      className: "symbol selectable",
      title: "remove",
      src: trashSVG,
      onClick: deleteSound,
    })
  );
};

let draggedOver;
const Player = ({ client, channel, config, saveConfig }) => {
  const [
    { loop, playing, paused, sounds, soundQueue },
    dispatch,
  ] = useSoundController(client, channel, config, saveConfig);

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
              type: "add-sounds",
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
              type: "add-sounds",
              value: new Array(...ev.target.files),
            }),
        }),
        "import sounds"
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
        { id: "sound-queue" },
        soundQueue.map((s, i) =>
          e(
            "div",
            { key: i, className: "queue-item" },
            e("span", null, `${i + 1}: ${s.name}`),
            e("img", {
              className: "symbol selectable",
              src: trashSVG,
              onClick: () => dispatch({ type: "unqueue-sound", value: i }),
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
        id: "sound-list",
      },
      sounds.map((f, i) =>
        e(Sound, {
          key: f.path,
          sound: f,
          deleteSound: () => dispatch({ type: "remove-sound", value: f }),
          queueSound:
            channel && (() => dispatch({ type: "queue-sound", value: f })),
          playSound:
            channel && (() => dispatch({ type: "play-sound", value: f })),
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
            dispatch({ type: "reorder-sounds", value: [i, to] });
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
