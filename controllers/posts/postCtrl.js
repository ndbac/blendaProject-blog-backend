const expressAsyncHandler = require("express-async-handler");
const Filter = require("bad-words");
const Post = require("../../model/post/Post");
const validateMongodbId = require("../../utils/validateMongodbID");
const User = require("../../model/user/User");
const cloudinaryUploadImg = require("../../utils/cloudinary");

const createPostCtrl = expressAsyncHandler(async (req, res) => {
  console.log(req.file);
  const { _id } = req.user;
  // validateMongodbId(req.body.user);

  //Check for bad words
  const filter = new Filter();
  const isProfane = filter.isProfane(req.body.title, req.body.description);
  console.log(isProfane);
  //Block user
  if (isProfane) {
    const user = await User.findByIdAndUpdate(_id, {
      isBlocked: true,
    });
    throw new Error(
      "Creating failed because it contains profane words and you have been blocked"
    );
  }

  //1. Get the path to the image
  const locallPath = `public/images/posts/${req.file.filename}`;
  //2. Upload to cloudinary
  const imgUploaded = await cloudinaryUploadImg(locallPath);

  try {
    const post = await Post.create({
      ...req.body,
      image: imgUploaded?.url,
      user: _id,
    });
    res.json(post);
  } catch (error) {
    res.json(error);
  }
});

module.exports = { createPostCtrl };
