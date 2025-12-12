import { init, RematchDispatch, RematchRootState } from "@rematch/core";
import loadingPlugin, { ExtraModelsFromLoading } from "@rematch/loading";
import { models, RootModel } from "./models";
import { IS_MAIN_NET } from "../../core/config";

const IS_NATIVE_APP = (process.env.NATIVE_APP === "true");

type FullModel = ExtraModelsFromLoading<RootModel>;

export const store = init<RootModel, FullModel>({
  models,
  plugins: [
    loadingPlugin({
      asNumber: false,
    }),
  ],
  redux: {
    devtoolOptions: {
      disabled: (IS_NATIVE_APP && IS_MAIN_NET),
    },
  },
});

export type Store = typeof store;
export type Dispatch = RematchDispatch<RootModel>;
export type RootState = RematchRootState<RootModel, FullModel>;
