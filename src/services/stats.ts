import { connection } from "../db";
import PlayStats from "@db/models/PlayStats";
import User from "@db/models/User";

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
    const playerStats = await PlayStats.findOne({ userId });
    if (playerStats) {
      await PlayStats.findOneAndUpdate(
        { userId },
        {
          $inc: { games: 1, points, kills },
          $set: {
            wins: isWin ? playerStats.wins + 1 : playerStats.wins,
            top3: isTop3 ? playerStats.top3 + 1 : playerStats.top3,
          },
        }
      );
    } else {
      const user = await User.findOne({ socketID: userId });
      await PlayStats.create({
        userId,
        userName: user.name,
        points,
        kills,
        wins: isWin,
        games: 1,
      });
    }
  } catch (error: any) {
    console.log(error);
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

export const getByName = async ({ name, skip, limit }: getByNameArgs) => {
  const stats = await PlayStats.find({
    userName: new RegExp(name, "i"),
  })
    .select({ __v: 0 })
    .skip(skip)
    .limit(limit)
    .sort({ name: 1 });
  const total = await PlayStats.countDocuments({
    userName: new RegExp(name, "i"),
  });
  return { stats, total };
};
