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

import { remote, shell } from "electron";
import { createElement as e, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import "./index.css";
import playSVG from "./ionicons/play.svg";
import pauseSVG from "./ionicons/pause.svg";
import stopSVG from "./ionicons/stop.svg";
import repeatSVG from "./ionicons/repeat.svg";
import repeat1SVG from "./ionicons/repeat-1.svg";
import listSVG from "./ionicons/list.svg";
import trashSVG from "./ionicons/trash.svg";
import createSVG from "./ionicons/create.svg";
import logoutSVG from "./ionicons/log-out.svg";
import personAddSVG from "./ionicons/person-add.svg";

let client = remote.getGlobal("discordClient");

const Sound = ({ sound, queueSound, playSound, deleteSound, ...rest }) => {
  return e(
    "div",
    { className: "sound", ...rest },
    e("div", null, sound.name),
    e("img", {
      className: `symbol ${playSound ? "selectable" : "disabled"}`,
      title: "play",
      src: playSVG,
      onClick: () => playSound(sound),
    }),
    e("img", {
      className: `symbol ${queueSound ? "selectable" : "disabled"}`,
      title: "add to queue",
      src: listSVG,
      onClick: () => queueSound(sound),
    }),
    e("img", {
      className: "symbol selectable",
      title: "remove",
      src: trashSVG,
      onClick: () => deleteSound(sound),
    })
  );
};

let draggedOver, lastPlayed;

const Player = ({ client, channel }) => {
  const [currentFiles, setFiles] = useState([]);
  const [soundQueue, setQueue] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [paused, setPause] = useState(false);
  const [loop, setLoop] = useState(0);
  const inputRef = useRef(null);
  const deleteSound = (f) => setFiles((files) => files.filter((g) => f !== g));
  const queueSound = channel && ((s) => setQueue((sq) => sq.concat([s])));
  const playSound =
    channel &&
    ((s) => {
      setPlaying(null);
      setQueue([s]);
    });

  useEffect(() => {
    if (!channel) {
      if (soundQueue.length) {
        setQueue([]);
      }
      if (playing) {
        playing.stream.destroy();
        setPlaying(null);
      }
      return;
    }
    if (!soundQueue.length || playing) return;

    const next = loop == 1 ? lastPlayed : soundQueue[0];

    client.voice.connections.each((con) => {
      const stream = con.play(next.path);
      lastPlayed = next;
      setPlaying({ stream, name: next.name, path: next.path });
      stream.on("finish", () => setPlaying(null));
    });
    setQueue((q) =>
      loop == 0 ? q.slice(1) : loop == 1 ? q.slice(1).concat([next]) : q
    );
  }, [channel, soundQueue, playing]);

  const addFilesDrop = (ev) => {
    ev.preventDefault();
    const items = new Array(...ev.dataTransfer.items);
    setFiles((files) =>
      files.concat(
        items
          .filter((i) => i.kind === "file")
          .map((i = i.getAsFile()))
          .filter(files.every((g) => g.path !== f.path))
      )
    );
  };
  const addFilesInput = (ev) => {
    const newFiles = new Array(...ev.target.files);
    setFiles((files) =>
      files.concat(
        newFiles.filter((f) => files.every((g) => g.path !== f.path))
      )
    );
  };

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
          onDrop: addFilesDrop,
          onClick: () => inputRef.current.click(),
        },
        "import sounds"
      ),
      !playing &&
        e("img", {
          className: "symbol disabled",
          title: "play",
          src: playSVG,
        }),
      playing &&
        paused &&
        e("img", {
          className: "symbol selectable",
          title: "play",
          src: playSVG,
          onClick: () => {
            playing.stream.resume();
            setPause(false);
          },
        }),
      playing &&
        !paused &&
        e("img", {
          className: "symbol selectable",
          title: "pause",
          src: pauseSVG,
          onClick: () => {
            setPause(true);
            playing.stream.pause();
          },
        }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "stop",
        src: stopSVG,
        onClick: () => {
          setQueue([]);
          if (playing) {
            playing.stream.destroy();
          }
          setPlaying(null);
        },
      }),
      e("img", {
        className: `symbol ${loop ? "selectable" : "disabled"}`,
        title: ["loop off", "loop queue", "loop song"][loop],
        src: loop < 2 ? repeatSVG : repeat1SVG,
        onClick: () => setLoop((l) => (l + 1) % 3),
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
              onClick: () => {
                setQueue((sq) => sq.filter((_, j) => j !== i));
              },
            })
          )
        )
      ),
      e("div", { id: "playing" }, playing && `playing: ${playing.name}`)
    ),
    e("input", {
      ref: inputRef,
      type: "file",
      accept: "audio/*",
      value: "",
      multiple: true,
      hidden: true,
      onChange: addFilesInput,
    }),
    e(
      "div",
      {
        id: "sound-list",
      },
      currentFiles.map((f, i) =>
        e(Sound, {
          key: f.path,
          sound: f,
          deleteSound,
          queueSound,
          playSound,
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
            const files = currentFiles.slice();
            files.splice(to, 0, files.splice(i, 1)[0]);
            setFiles(files);
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

window.onbeforeunload = () => {
  client.destroy();
  client = remote.getGlobal("dicordClient");
};

const Bot = ({ client, logout }) => {
  const [loopOn, setLoop] = useState(false);
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
      })
    /*
    e("img", {
      className: "symbol rs-2 selectable",
      src: logoutSVG,
      title: "log out",
      onClick: logout,
    })
    */
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

const App = () => {
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [guilds, setGuilds] = useState(client.voiceGuilds);
  const [selectedGuild, selectGuild] = useState(null);
  const [selectedChannel, selectChannel] = useState(null);
  const [newUrl, setNewUrl] = useState("");
  useEffect(() => {
    client.on("ready", () => {
      setGuilds(client.voiceGuilds);
    });
    return () => {
      client.destroy();
      client = remote.getGlobal("discordClient");
    };
  }, [client]);
  useEffect(() => {
    if (!selectedChannel) {
      if (!client.voice) return;
      client.voice.connections.each((con) => con.disconnect());
    } else {
      selectedChannel
        .join()
        .then((con) => {
          con.on("closing", () => selectChannel(null));
        })
        .catch((e) => {
          selectChannel(null);
          alert(e.message);
        });
    }
  }, [selectedChannel]);

  const userComponent = client.user
    ? e(Bot, {
        client: client,
        logout: () => {
          client.destroy();
          client = remote.getGlobal("discordClient");
          window.client = client;
          setGuilds([]);
          selectGuild(null);
          selectChannel(null);
        },
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
            onChange: (e) => setToken(e.target.value),
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
            title: "create a new bot",
          }),
          e(
            "button",
            {
              className: "button",
              disabled: connecting,
              onClick: () => {
                if (!navigator.onLine) {
                  alert("No internet connection.");
                  return;
                }
                setConnecting(true);
                client
                  .login(token)
                  .catch((e) => alert(e.message))
                  .finally(() => setConnecting(false));
              },
            },
            "connect"
          )
        )
      );
  const guildComponent = selectedGuild
    ? e(Guild, {
        guild: selectedGuild,
        className: "selected",
        onClick: () => {
          selectGuild(null);
          selectChannel(null);
        },
      })
    : client.user &&
      e(
        "div",
        { id: "select-guild" },
        guilds.map((g) =>
          e(Guild, {
            guild: g,
            key: g.name,
            onClick: () => selectGuild(g),
            className: "selectable",
          })
        )
      );
  const channelComponent = selectedChannel
    ? e(
        "div",
        { className: "selected online", onClick: () => selectChannel(null) },
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
              onClick: () => selectChannel(ch),
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
    e(Player, { client, channel: selectedChannel })
  );
};

ReactDOM.render(e(App), document.getElementById("app"));
