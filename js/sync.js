(() => {
  const CHANNEL_NAME = "birthday_quiz_channel_v2";
  let channel = null;
  const listeners = new Set();

  function init() {
    if (!("BroadcastChannel" in window)) return false;

    if (!channel) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        listeners.forEach(listener => listener(event.data));
      };
    }
    return true;
  }

  function send(message) {
    if (!channel) init();
    if (channel) channel.postMessage(message);
  }

  function broadcastState(state) {
    send({ type: "state", payload: state });
  }

  function requestState() {
    send({ type: "request-state" });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.QuizSync = {
    init,
    send,
    broadcastState,
    requestState,
    subscribe
  };
})();
