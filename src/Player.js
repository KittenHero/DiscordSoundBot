const React = require("react");
const { createElement: e, useEffect, useRef, useState } = React;

const Sound = ({ sound, queueSound, playSound, deleteSound, ...rest }) => {
  return e(
    "div",
    { className: "sound", ...rest },
    e("div", null, sound.name),
    e("img", {
      className: `symbol ${playSound ? "selectable" : "disabled"}`,
      title: "play",
      src: "ionicons/play.svg",
      onClick: () => playSound(sound),
    }),
    e("img", {
      className: `symbol ${queueSound ? "selectable" : "disabled"}`,
      title: "add to queue",
      src: "ionicons/list.svg",
      onClick: () => queueSound(sound),
    }),
    e("img", {
      className: "symbol selectable",
      title: "remove",
      src: "ionicons/trash.svg",
      onClick: () => deleteSound(sound),
    })
  );
};

let lastPlayed;

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
    ev.target.files.clear();
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
          src: "ionicons/play.svg",
        }),
      playing &&
        paused &&
        e("img", {
          className: "symbol selectable",
          title: "play",
          src: "ionicons/play.svg",
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
          src: "ionicons/pause.svg",
          onClick: () => {
            setPause(true);
            playing.stream.pause();
          },
        }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "stop",
        src: "ionicons/stop.svg",
        onClick: () => {
          setQueue([]);
          playing.stream.destroy();
          setPlaying(null);
        },
      }),
      e("img", {
        className: `symbol ${loop ? "selectable" : "disabled"}`,
        title: ["loop off", "loop queue", "loop song"][loop],
        src: loop < 2 ? "ionicons/repeat.svg" : "ionicons/repeat-1.svg",
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
              src: "ionicons/trash.svg",
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
      files: null,
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
            this.dragged = e.currentTarget;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/html", e.currentTarget);
          },
          onDragEnd: (e) => {
            let to = +this.over.dataset.id;
            if (i < to) --to;
            if (this.over.classList.contains("insert-after")) ++to;
            const files = currentFiles.slice();
            files.splice(to, 0, files.splice(i, 1)[0]);
            console.log(i, to, currentFiles, files);
            setFiles(files);
          },
          onDragOver: (e) => {
            e.preventDefault();
            if (this.over) {
              this.over.classList.toggle("insert-before", false);
              this.over.classList.toggle("insert-after", false);
            }
            this.over = e.currentTarget;
            const relX = e.clientX - this.over.offsetLeft;
            const width = this.over.offsetWidth / 2;
            if (relX < width) {
              this.over.classList.toggle("insert-before", true);
            } else {
              this.over.classList.toggle("insert-after", true);
            }
          },
        })
      )
    )
  );
};

module.exports = Player;
