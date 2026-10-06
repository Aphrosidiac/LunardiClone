// Ported from reference module 408155 (chunk 2jq648cstfzyz): zustand's vanilla `createStore`, which
// the reference only ships as a dependency of @react-three/fiber. Kept for any slice that wants a
// tiny external store; R3F itself brings its own copy from npm.

type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;
type Listener<T> = (state: T, previous: T) => void;

export type StoreApi<T> = {
  setState: SetState<T>;
  getState: GetState<T>;
  getInitialState: GetState<T>;
  subscribe: (listener: Listener<T>) => () => boolean;
};

export type StateCreator<T> = (set: SetState<T>, get: GetState<T>, api: StoreApi<T>) => T;

function createStoreImpl<T>(createState: StateCreator<T>): StoreApi<T> {
  let state: T;
  const listeners = new Set<Listener<T>>();
  const setState: SetState<T> = (partial, replace) => {
    const next = typeof partial === 'function' ? (partial as (state: T) => T | Partial<T>)(state) : partial;
    if (Object.is(next, state)) return;
    const previous = state;
    state = (replace ?? (typeof next !== 'object' || next === null)) ? (next as T) : Object.assign({}, state, next);
    listeners.forEach((listener) => listener(state, previous));
  };
  const getState = () => state;
  const api: StoreApi<T> = {
    setState,
    getState,
    getInitialState: () => initialState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const initialState = (state = createState(setState, getState, api));
  return api;
}

export function createStore<T>(createState: StateCreator<T>): StoreApi<T>;
export function createStore<T>(): (createState: StateCreator<T>) => StoreApi<T>;
export function createStore<T>(createState?: StateCreator<T>) {
  return createState ? createStoreImpl(createState) : createStoreImpl;
}
