const express = require("express");
const { createPostCtrl } = require("../../controllers/posts/postCtrl");
const authMiddleware = require("../../middlewares/auth/authMiddleware");
const {
  photoUpload,
  postImgResize,
} = require("../../middlewares/upload/photoUpload");

const postRoute = express.Router();

postRoute.post(
  "/",
  authMiddleware,
  photoUpload.single("image"),
  postImgResize,
  createPostCtrl
);

module.exports = postRoute;
