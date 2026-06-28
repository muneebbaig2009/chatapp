import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import callsReducer from "./slices/callSlice";
import statusReducer from "./slices/statusSlice";

export const store = configureStore({
  reducer: { auth: authReducer, chat: chatReducer, calls: callsReducer, status: statusReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
