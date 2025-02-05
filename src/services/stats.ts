import { connection } from "../db";
import PlayStats from "@db/models/PlayStats";

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

export const updatePlayerStats = async ({
  userId,
  kills = 0,
  isWin = false,
  points = 0,
  isTop3 = false,
}: updatePlayerArgs) => {
  await connection();
  try {
    const player = await PlayStats.findOne({ userId });
    if (player) {
      await PlayStats.findOneAndUpdate(
        { userId },
        {
          $inc: { games: 1, points, kills },
          $set: {
            wins: isWin ? player.wins + 1 : player.wins,
            top3: isTop3 ? player.top3 + 1 : player.top3,
          },
        }
      );
    } else {
      await PlayStats.create({
        userId,
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
    console.log("total:", total);
    return { stats, total };
  } catch (error) {
    console.log(123);
    console.log(error);
    return { stats: [], total: 0 };
  }
};

export const getByName = async ({ name, skip, limit }: getByNameArgs) => {
  const stats = await PlayStats.find({
    name: new RegExp(name, "i"),
  })
    .select({ __v: 0 })
    .skip(skip)
    .limit(limit)
    .sort({ name: 1 });
  const total = await PlayStats.countDocuments({
    name: new RegExp(name, "i"),
  });
  return { stats, total };
};
