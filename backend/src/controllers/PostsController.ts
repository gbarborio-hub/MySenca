import type { Request, Response } from "express";
import { PostsModel } from "../models/PostsModel.js";

export const PostsController = {
  async list(_req: Request, res: Response) {
    const posts = await PostsModel.list();
    res.json(posts);
  }
};
