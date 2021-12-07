const expressAsyncHandler = require("express-async-handler");
const Post = require("../../model/post/Post");
const validateMongodbId = require("../../utils/validateMongodbID");

const createPostCtrl = expressAsyncHandler(async (req, res) => {
  validateMongodbId(req.body.user);
  try {
    const post = await Post.create(req.body);
    res.json(post);
  } catch (error) {
    res.json(error);
  }
});

module.exports = { createPostCtrl };
