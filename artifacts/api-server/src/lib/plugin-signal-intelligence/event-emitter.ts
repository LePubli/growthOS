import { pluginEventBus } from "../plugin-runtime/event-bus";
import { logger } from "../logger";

export interface SignalReceivedPayload {
  signalId: string;
  accountId: string;
  type: string;
  impactScore: number;
  title: string;
}

export function emitSignalReceived(payload: SignalReceivedPayload): void {
  pluginEventBus
    .emit("signal.received", payload)
    .then(() => logger.debug({ signalId: payload.signalId }, "signal.received event emitted"))
    .catch((err) => logger.error({ err }, "Failed to emit signal.received event"));
}
