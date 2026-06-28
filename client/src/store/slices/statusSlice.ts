import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StatusFeed, StatusGroup } from "../../types";

interface StatusState {
  mine: StatusGroup | null;
  others: StatusGroup[];
}

const initialState: StatusState = {
  mine: null,
  others: [],
};

const statusSlice = createSlice({
  name: "status",
  initialState,
  reducers: {
    setStatusFeed(state, action: PayloadAction<StatusFeed>) {
      state.mine = action.payload.mine;
      state.others = action.payload.others;
    },
  },
});

export const { setStatusFeed } = statusSlice.actions;
export default statusSlice.reducer;
