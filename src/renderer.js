import { remote, shell, ipcRenderer } from "electron";
import {
  createElement as e,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";

import { onClickOrEnter } from "./util.js";
import Player from "./player.js";

import "./index.css";
import createSVG from "./ionicons/create.svg";
import logoutSVG from "./ionicons/log-out.svg";
import personAddSVG from "./ionicons/person-add.svg";

window.client = remote.getGlobal("discordClient");
const resetClient = () => {
  window.client.destroy();
  window.client = remote.getGlobal("discordClient");
};
window.onbeforeunload = resetClient;

const useConfig = (config, saveConfig) => {
  var [config, setConfig] = useState(config);
  useEffect(() => {
    saveConfig(config);
  }, [config]);
  return { ...config, setConfig };
};

const useDiscordConnection = (client, config) => {
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
        .then((token) => config.setConfig((c) => ({ ...c, token })))
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
          const resetChannel = () => dispatch({ type: "select-channel" });
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
        ...onClickOrEnter(() => shell.openExternal(invite)),
      }),
    e("img", {
      className: "symbol rs-2 selectable",
      src: logoutSVG,
      title: "log out",
      ...onClickOrEnter(logout),
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
  config = useConfig(config, saveConfig);
  const [
    { token, connecting, selectedGuild, selectedChannel, clientUpdated },
    dispatch,
  ] = useDiscordConnection(client, config);
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.click();
  }, [clientUpdated]);

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
            ref: inputRef,
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
            ...onClickOrEnter(() =>
              shell.openExternal(
                "https://discordapp.com/developers/docs/intro#bots-and-apps"
              )
            ),
            title: "Create a new bot",
          }),
          e(
            "button",
            {
              className: "button",
              disabled: connecting,
              ...onClickOrEnter(() =>
                dispatch({ type: "connect", value: true })
              ),
            },
            "connect"
          )
        )
      );
  const guildComponent = selectedGuild
    ? e(Guild, {
        guild: selectedGuild,
        className: "selected",
        ...onClickOrEnter(() => dispatch({ type: "select-guild" })),
      })
    : client.readyAt &&
      e(
        "div",
        { id: "select-guild" },
        client.voiceGuilds.map((g) =>
          e(Guild, {
            guild: g,
            key: g.name,
            className: "selectable",
            ...onClickOrEnter(() =>
              dispatch({ type: "select-guild", value: g })
            ),
          })
        )
      );
  const channelComponent = selectedChannel
    ? e(
        "div",
        {
          className: "selected online",
          ...onClickOrEnter(() => dispatch({ type: "select-channel" })),
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
              ...onClickOrEnter(() =>
                dispatch({ type: "select-channel", value: ch })
              ),
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
