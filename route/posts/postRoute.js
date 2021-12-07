const express = require("express");
const { createPostCtrl } = require("../../controllers/posts/postCtrl");
const authMiddleware = require("../../middlewares/auth/authMiddleware");

const postRoute = express.Router();

postRoute.post("/", authMiddleware, createPostCtrl);

module.exports = postRoute;
