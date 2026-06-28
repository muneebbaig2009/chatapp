import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Metered's TURN credentials endpoint returns the iceServers array directly.
export async function fetchIceServers(): Promise<unknown[]> {
  if (!env.meteredApiKey || !env.meteredDomain) {
    throw new ApiError(500, "TURN credentials are not configured");
  }
  const url = `https://${env.meteredDomain}/api/v1/turn/credentials?apiKey=${env.meteredApiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, "Failed to fetch ICE servers");
  return res.json();
}
