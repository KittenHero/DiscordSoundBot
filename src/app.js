const React = require("react");
const ReactDOM = require("react-dom");
const Discord = require("discord.js");
const Player = require("./Player.js");

const { createElement: e, useEffect, useState } = React;

let client = new Discord.Client();
window.onbeforeunload = () => client.destroy();

Object.defineProperties(client, {
  voiceGuilds: {
    get: function () {
      return client.guilds.cache
        .filter((g) => g.channels.cache.some((ch) => ch.type === "voice"))
        .array();
    },
  },
});

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
        src: "ionicons/person-add.svg",
        title: "add me to your server",
        onClick: () => nw.Window.open(invite),
      }),
    e("img", {
      className: "symbol rs-2 selectable",
      src: "ionicons/log-out.svg",
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

const App = () => {
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connect = (token) => {};
  const [guilds, setGuilds] = useState(client.voiceGuilds);
  const [selectedGuild, selectGuild] = useState(null);
  const [selectedChannel, selectChannel] = useState(null);
  const [newUrl, setNewUrl] = useState("");
  useEffect(() => {
    client.on("ready", () => {
      setGuilds(client.voiceGuilds);
    });
    return () => client.destroy();
  }, []);
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
          setGuilds([]);
          selectGuild(null);
          selectChannel(null);
          client = new Discord.Client();
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
            src: "ionicons/create.svg",
            onClick: () =>
              nw.Window.open(
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
        selectedGuild.channels.cache
          .filter((ch) => ch.type == "voice" && ch.joinable)
          .map((ch) =>
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

ReactDOM.render(e(App), document.getElementById("content"));
