export function initialState() {
  return { plugged: false, connection: "waiting", alert: null, dismissed: false,
    pending: false, generation: 0, epoch: 0, paused: false };
}

export function transition(state, action, now = 0) {
  switch (action.type) {
    case "toggle":
      if (state.plugged) {
        const newLoss = state.connection === "connected";
        return { ...state, plugged: false, pending: false, generation: state.generation + 1,
          connection: state.connection === "waiting" ? "waiting" : "lost",
          alert: newLoss ? "loss" : state.alert, epoch: newLoss ? now : state.epoch,
          dismissed: newLoss ? false : state.dismissed, paused: false };
      }
      return { ...state, plugged: true, pending: true, generation: state.generation + 1, paused: false };
    case "confirmed":
      if (!state.plugged || !state.pending || action.generation !== state.generation) return state;
      return { ...state, connection: "connected", pending: false, dismissed: false,
        alert: state.connection === "lost" ? "recovery" : null,
        epoch: state.connection === "lost" ? now : 0, paused: false };
    case "dismiss":
      return state.connection === "lost" && state.alert === "loss"
        ? { ...state, alert: null, dismissed: true } : state;
    case "expired":
      return state.alert === "recovery" && action.epoch === state.epoch
        ? { ...state, alert: null } : state;
    case "pause":
      return { ...state, connection: state.plugged ? "connected" : state.connection,
        alert: null, pending: false, dismissed: !state.plugged && state.connection === "lost",
        generation: state.generation + 1, paused: true };
    case "reset":
      return { ...initialState(), generation: state.generation + 1 };
    default:
      return state;
  }
}
