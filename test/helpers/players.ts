import { randomUUID } from "crypto";
import { Socket as ClientSocket, io } from "socket.io-client";

export type { ClientSocket };

export type TestPlayer = {
  socket: ClientSocket;
  id: string;
  name: string;
  email: string;
};

type Identity = { name: string; email: string };

const DEFAULT_TIMEOUT_MS = 3000;

// Every socket connectPlayer() opened, so the server teardown can close them.
const openSockets = new Set<ClientSocket>();

export function disconnectAllPlayers(): void {
  for (const socket of openSockets) {
    socket.disconnect();
  }
  openSockets.clear();
}

let nameCounter = 0;

// A name no other test in this process uses. Lobby and Play keep games in
// module-level maps, so tests must not share game or player names.
export function uniqueName(prefix = "game"): string {
  nameCounter += 1;
  return `${prefix}-${nameCounter}-${randomUUID().slice(0, 8)}`;
}

// Creates the User row the way the client does after Google sign-in
// (Bomberman-2.0 Menu.tsx addUserToDB → POST /api/v1/auth).
export async function createUser(
  url: string,
  { name, email }: Identity,
): Promise<void> {
  const response = await fetch(`${url}/api/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name,
      picture: "",
      locale: "en-US",
      socketID: randomUUID(),
    }),
  });
  if (!response.ok) {
    throw new Error(
      `POST /api/v1/auth failed: ${response.status} ${await response.text()}`,
    );
  }
}

// Connects a socket with the handshake auth the client sends
// (Bomberman-2.0 src/utils/socket.ts). Resolves on "connect".
export function connectPlayer(
  url: string,
  { name, email, socketId }: Identity & { socketId?: string },
): Promise<TestPlayer> {
  const id = socketId ?? randomUUID();
  const socket = io(url, {
    auth: { socketId: id, email, name, picture: "" },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  openSockets.add(socket);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect");
      socket.off("connect_error");
      reject(new Error(`timeout waiting for "connect"`));
    }, DEFAULT_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.off("connect_error");
      resolve({ socket, id, name, email });
    });
    socket.once("connect_error", error => {
      clearTimeout(timer);
      socket.off("connect");
      reject(error);
    });
  });
}

// Resolves with the first argument of the next `event`.
export function waitFor<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for "${event}"`));
    }, timeoutMs);
    socket.once(event, handler);
  });
}

// Resolves if `event` does not arrive within `ms`; rejects if it does.
export function expectNoEvent(
  socket: ClientSocket,
  event: string,
  ms = 500,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer);
      reject(new Error(`unexpected "${event}"`));
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
    socket.once(event, handler);
  });
}

// Emits an event that takes an acknowledgement callback and resolves with the
// acknowledgement. Rejects after 3 s.
export function emitAck<T>(
  socket: ClientSocket,
  event: string,
  ...args: unknown[]
): Promise<T> {
  return socket
    .timeout(DEFAULT_TIMEOUT_MS)
    .emitWithAck(event, ...args) as Promise<T>;
}

type GameOptions = {
  mapName?: "small_map" | "default_map";
  isPortalsEnabled?: boolean;
  isDelaySpoilEnabled?: boolean;
};

type CurrentGamePlayer = { id: string };
type UpdateGamePayload = { current_game: { players: CurrentGamePlayer[] } };

// Drives two players from sign-in to a running game, in the order the client
// sends the events (Menu.tsx, SelectMap.tsx, Pending.tsx):
// POST /api/v1/auth → connect → "create game" → "enter pending game" (each,
// wait for "update game") → "start timer" → "start game" (each) → "launch game".
// Returns the "get current game" acknowledgement.
export async function startTwoPlayerGame(
  url: string,
  opts: GameOptions = {},
): Promise<{
  p1: TestPlayer;
  p2: TestPlayer;
  gameId: string;
  game: unknown;
}> {
  const identities = [uniqueName("p1"), uniqueName("p2")].map(name => ({
    name,
    email: `${name}@example.com`,
  }));
  for (const identity of identities) {
    await createUser(url, identity);
  }
  const [p1, p2] = await Promise.all(
    identities.map(identity => connectPlayer(url, identity)),
  );

  const { game_id: gameId } = await emitAck<{ game_id: string }>(
    p1.socket,
    "create game",
    {
      mapName: opts.mapName ?? "small_map",
      gameName: uniqueName("game"),
      isPortalsEnabled: opts.isPortalsEnabled ?? false,
      isDelaySpoilEnabled: opts.isDelaySpoilEnabled ?? false,
    },
  );

  // addPlayer is async: wait for each "update game" before the next step.
  const p1Entered = waitFor<UpdateGamePayload>(p1.socket, "update game");
  p1.socket.emit("enter pending game", gameId);
  await p1Entered;

  const p2Entered = Promise.all([
    waitFor<UpdateGamePayload>(p1.socket, "update game"),
    waitFor<UpdateGamePayload>(p2.socket, "update game"),
  ]);
  p2.socket.emit("enter pending game", gameId);
  const [update] = await p2Entered;
  if (update.current_game.players.length !== 2) {
    throw new Error(
      `expected 2 players in the pending game, got ${update.current_game.players.length}`,
    );
  }

  const timerStarted = Promise.all([
    waitFor(p1.socket, "start timer"),
    waitFor(p2.socket, "start timer"),
  ]);
  p1.socket.emit("start timer", gameId);
  await timerStarted;

  // Each client sends "start game" when its countdown ends; the first one
  // starts the game, the server ignores the second one.
  const launched = Promise.all([
    waitFor(p1.socket, "launch game"),
    waitFor(p2.socket, "launch game"),
  ]);
  p1.socket.emit("start game", gameId);
  p2.socket.emit("start game", gameId);
  await launched;

  const game = await emitAck<unknown>(p1.socket, "get current game", gameId);
  return { p1, p2, gameId, game };
}
