import { useCall } from "../hooks/CallContext";
import { OutgoingCallScreen } from "./OutgoingCallScreen";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { InCallScreen } from "./InCallScreen";

// Mounted once near the app root so an incoming call can interrupt
// whichever chat is currently open.
export function CallOverlay() {
  const call = useCall();
  const { status } = call.callState;

  if (status === "idle") return null;
  if (status === "incoming") return <IncomingCallScreen call={call} />;
  if (status === "outgoing") return <OutgoingCallScreen call={call} />;
  return <InCallScreen call={call} />;
}
