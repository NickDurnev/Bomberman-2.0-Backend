import { connection } from "@/db";
import PlayStats from "@/db/models/PlayStats";
import User from "@/db/models/User";

type updatePlayerArgs = {
  userId: string;
  kills: number;
  isWin: boolean;
  points: number;
  isTop3: boolean;
};

type getPlayersArgs = {
  skip: number;
  limit: number;
  sort: string;
};

type getByNameArgs = {
  name: string;
  skip: number;
  limit: number;
};

export const deleteAllStats = async () => {
  await connection();
  try {
    const result = await PlayStats.deleteMany({});
    console.log(`Deleted ${result.deletedCount} stats records.`);
  } catch (error) {
    console.error("Error deleting stats records:", error);
  }
};

export const updatePlayerStats = async ({
  userId,
  kills = 0,
  isWin = false,
  points = 0,
  isTop3 = false,
}: updatePlayerArgs) => {
  await connection();
  try {
    const user = await User.findOne({ socketID: userId });
    // Single atomic upsert: read-then-write was racy (lost wins/top3 updates and
    // duplicate-key errors when two game-ends for the same user interleaved).
    // $inc handles both create and update; userName is only set on insert.
    await PlayStats.findOneAndUpdate(
      { userId },
      {
        $inc: {
          games: 1,
          points,
          kills,
          wins: isWin ? 1 : 0,
          top3: isTop3 ? 1 : 0,
        },
        $setOnInsert: { userName: user?.name ?? "Unknown" },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
};

export const get = async ({ skip, limit, sort }: getPlayersArgs) => {
  await connection();
  try {
    const stats = await PlayStats.find({})
      .select({ __v: 0 })
      .skip(skip)
      .limit(limit)
      .sort({ [sort]: -1 });
    const total = await PlayStats.countDocuments();
    return { stats, total };
  } catch (error) {
    console.log(error);
    return { stats: [], total: 0 };
  }
};

// The name is user input: escape it so it matches as plain text.
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getByName = async ({ name, skip, limit }: getByNameArgs) => {
  const filter = { userName: new RegExp(escapeRegExp(name), "i") };
  const stats = await PlayStats.find(filter)
    .select({ __v: 0 })
    .skip(skip)
    .limit(limit)
    .sort({ userName: 1 });
  const total = await PlayStats.countDocuments(filter);
  return { stats, total };
};
