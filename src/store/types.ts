import { RematchRootState } from "@rematch/core";
import { RootModel } from "./models";

export type ExtractRematchStateType<M> = M extends { state: infer S }
  ? S
  : never;

export type RuntimeRootState = {
  [K in keyof RematchRootState<RootModel>]: ExtractRematchStateType<
    RootModel[K]
  >;
};

export const useTypedSelector = <T>(selector: (state: RuntimeRootState) => T) =>
  selector as unknown as (state: RematchRootState<RootModel>) => T;
