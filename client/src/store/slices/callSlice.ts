import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CallLogEntry } from "../../types";

interface CallState {
  log: CallLogEntry[];
}

const initialState: CallState = {
  log: [],
};

const callSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    setCallLog(state, action: PayloadAction<CallLogEntry[]>) {
      state.log = action.payload;
    },
    upsertCallLogEntry(state, action: PayloadAction<CallLogEntry>) {
      const i = state.log.findIndex((c) => c.id === action.payload.id);
      if (i >= 0) state.log[i] = action.payload;
      else state.log.unshift(action.payload);
    },
  },
});

export const { setCallLog, upsertCallLogEntry } = callSlice.actions;
export default callSlice.reducer;
