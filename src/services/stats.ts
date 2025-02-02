import { connection } from "../db";
import PlayStats from "@db/models/PlayStats";

type updatePlayerArgs = {
  userId: string;
  kills: number;
  isWin: boolean;
  points: number;
};

type getPlayersArgs = {
  skip: number;
  limit: number;
  filter: {
    [key: string]: string;
  };
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
}: updatePlayerArgs) => {
  connection();
  try {
    const player = await PlayStats.findOne({ userId });
    if (player) {
      await PlayStats.findOneAndUpdate(
        { userId },
        { $inc: { games: 1, points, kills, wins: isWin } }
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

export const get = async ({ skip, limit, filter }: getPlayersArgs) => {
  const stats = await PlayStats.find({ ...filter })
    .select({ __v: 0 })
    .skip(skip)
    .limit(limit)
    .sort({ name: 1 });
  const total = await PlayStats.countDocuments({ ...filter });
  return { stats, total };
};

export const getByName = async ({ name, skip, limit }: getByNameArgs) => {
  const contacts = await PlayStats.find({
    name: new RegExp(name, "i"),
  })
    .select({ __v: 0 })
    .skip(skip)
    .limit(limit)
    .sort({ name: 1 });
  const total = await PlayStats.countDocuments({
    name: new RegExp(name, "i"),
  });
  console.log(contacts);
  console.log(total);
  return { contacts, total };
};
