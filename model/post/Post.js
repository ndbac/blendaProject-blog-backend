const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
    },
    //Created by only category
    category: {
      type: String,
      required: [true, "Post category is required"],
      default: "All",
    },
    isLike: {
      type: Boolean,
      default: false,
    },
    isDisLike: {
      type: Boolean,
      default: false,
    },
    numViews: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    disLikes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please Author is required"],
    },
    description: {
      type: String,
      required: [true, "Post description is required"],
    },
    image: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2021/12/03/21/56/lamps-6843881_960_720.jpg",
    },
  },
  {
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
    timestamps: true,
  }
);

//compile
const Post = mongoose.model("Post", postSchema);

module.exports = Post;