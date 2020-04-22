import { createElement as e, useEffect, useReducer, useRef } from "react";

import { onClickOrEnter } from "./util.js";
import ShortcutModal from "./shortcuts.js";

import playSVG from "./ionicons/play.svg";
import pauseSVG from "./ionicons/pause.svg";
import skipSVG from "./ionicons/play-skip-forward.svg";
import stopSVG from "./ionicons/stop.svg";
import repeatSVG from "./ionicons/repeat.svg";
import repeat1SVG from "./ionicons/repeat-1.svg";
import listSVG from "./ionicons/list.svg";
import settingsSVG from "./ionicons/settings.svg";
import trashSVG from "./ionicons/trash.svg";

const usePlayerController = (client, channel, config) => {
  const initialState = {
    tracks: config.tracks || [],
    trackQueue: [],
    playing: null,
    lastPlayed: null,
    paused: false,
    loop: 0,
    showShortcutModal: false,
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
      case "toggle-shortcut-modal":
        return { ...state, showShortcutModal: !state.showShortcutModal };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const { tracks, trackQueue, playing, paused, showShortcutModal } = state;

  useEffect(() => {
    const playTrack = (e) =>
      dispatch({
        type: "play-track",
        value: tracks.find((f) => f.path === e.detail),
      });
    const toggleShortcutModal = () =>
      !showShortcutModal && dispatch({ type: "toggle-shortcut-modal" });
    window.addEventListener("Play track", playTrack);
    window.addEventListener("Edit shortcuts", toggleShortcutModal);
    return () => {
      window.removeEventListener("Play track", playTrack);
      window.removeEventListener("Edit shortcuts", toggleShortcutModal);
    };
  }, [showShortcutModal, tracks]);

  useEffect(
    () =>
      config.setConfig((c) => ({
        ...c,
        tracks: tracks.map((f) => ({ path: f.path, name: f.name })),
      })),
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
  shortcut,
  deleteTrack,
  ...rest
}) => {
  return e(
    "div",
    { className: "track", ...rest },
    e("div", null, track.name),
    e("div", null, shortcut),
    e("img", {
      className: `symbol ${playTrack ? "selectable" : "disabled"}`,
      src: playSVG,
      title: "play",
      ...onClickOrEnter(playTrack),
    }),
    e("img", {
      className: `symbol ${queueTrack ? "selectable" : "disabled"}`,
      title: "add to queue",
      src: listSVG,
      ...onClickOrEnter(queueTrack),
    }),
    e("img", {
      className: "symbol selectable",
      title: "remove",
      src: trashSVG,
      ...onClickOrEnter(deleteTrack),
    })
  );
};

let draggedOver;
const Player = ({ client, channel, config }) => {
  const [
    { loop, playing, paused, tracks, trackQueue, showShortcutModal },
    dispatch,
  ] = usePlayerController(client, channel, config);

  const inputRef = useRef(null);
  useEffect(() => {
    const importTracks = () => inputRef.current && inputRef.current.click();
    window.addEventListener("Import tracks", importTracks);
    return () => window.removeEventListener("Import tracks", importTracks);
  }, [inputRef]);

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
          ...onClickOrEnter(() => inputRef.current.click()),
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
          ...onClickOrEnter(() => dispatch({ type: "toggle-pause" })),
        }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "skip",
        src: skipSVG,
        ...onClickOrEnter(() => dispatch({ type: "skip" })),
      }),
      e("img", {
        className: `symbol ${playing ? "selectable" : "disabled"}`,
        title: "stop",
        disabled: !playing,
        src: stopSVG,
        ...onClickOrEnter(() => dispatch({ type: "stop" })),
      }),
      e("img", {
        className: `symbol ${loop ? "selectable" : "disabled"}`,
        title: ["loop off", "loop queue", "loop song"][loop],
        src: loop < 2 ? repeatSVG : repeat1SVG,
        ...onClickOrEnter(() => dispatch({ type: "toggle-loop" })),
      }),
      e("img", {
        className: "symbol selectable",
        title: "Edit shortcuts",
        src: settingsSVG,
        ...onClickOrEnter(() => dispatch({ type: "toggle-shortcut-modal" })),
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
              ...onClickOrEnter(() =>
                dispatch({ type: "unqueue-track", value: i })
              ),
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
          shortcut: (
            (config.globalShortcuts || []).find(
              (s) => s.action === "Play track" && s.value === f.path
            ) || {}
          ).keys,
          deleteTrack: () => dispatch({ type: "remove-track", value: f }),
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
    e(ShortcutModal, {
      config,
      show: showShortcutModal,
      close: () => dispatch({ type: "toggle-shortcut-modal" }),
    })
  );
};

export default Player;
