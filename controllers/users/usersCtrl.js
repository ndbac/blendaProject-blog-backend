const expressAsyncHandler = require("express-async-handler");
const nodemailer = require("nodemailer");
const fs = require("fs");
const crypto = require("crypto");
const generateToken = require("../../config/token/generateToken");
const User = require("../../model/user/User");
const validateMongodbId = require("../../utils/validateMongodbID");
const cloudinaryUploadImg = require("../../utils/cloudinary");
const blockUser = require("../../utils/blockUser");

//-------------------------------------
//Register
//-------------------------------------

const userRegisterCtrl = expressAsyncHandler(async (req, res) => {
  //Check if user Exist
  const userExists = await User.findOne({ email: req?.body?.email });

  if (userExists) throw new Error("User already exists");
  try {
    //Register user
    const user = await User.create({
      firstName: req?.body?.firstName,
      lastName: req?.body?.lastName,
      email: req?.body?.email,
      password: req?.body?.password,
    });
    res.json(user);
  } catch (error) {
    res.json(error);
  }
});

//-------------------------------
//Login user
//-------------------------------

const loginUserCtrl = expressAsyncHandler(async (req, res) => {
  const { email, password } = req.body;
  //check if user exists
  const userFound = await User.findOne({ email });
  //check if blocked
  if (userFound?.isBlocked && !userFound.isAdmin)
    throw new Error("Access Denied, You have been blocked");
  //Check if password is match
  if (userFound && (await userFound.isPasswordMatched(password))) {
    res.json({
      _id: userFound?._id,
      firstName: userFound?.firstName,
      lastName: userFound?.lastName,
      email: userFound?.email,
      profilePhoto: userFound?.profilePhoto,
      isAdmin: userFound?.isAdmin,
      token: generateToken(userFound?._id),
      isVerified: userFound?.isAccountVerified,
    });
  } else {
    res.status(401);
    throw new Error("Invalid Login Credentials");
  }
});

//------------------------------
//Users
//-------------------------------
const fetchUsersCtrl = expressAsyncHandler(async (req, res) => {
  console.log(req.headers);
  try {
    const users = await User.find({}).populate("posts");
    res.json(users);
  } catch (error) {
    res.json(error);
  }
});

//------------------------------
//Delete user
//------------------------------
const deleteUsersCtrl = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  //check if user id is valid
  validateMongodbId(id);
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    res.json(deletedUser);
  } catch (error) {
    res.json(error);
  }
});

//----------------
//user details
//----------------
const fetchUserDetailsCtrl = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  //check if user id is valid
  validateMongodbId(id);
  try {
    const user = await User.findById(id);
    res.json(user);
  } catch (error) {
    res.json(error);
  }
});

//------------------------------
//User profile
//------------------------------
const userProfileCtrl = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongodbId(id);
  //1.Find the login user
  //2. Check this particular if the login user exists in the array of viewedBy

  //Get the login user
  const loginUserId = req?.user?._id?.toString();
  console.log(typeof loginUserId);
  try {
    const myProfile = await User.findById(id)
      .populate("posts")
      .populate("viewedBy");
    const alreadyViewed = myProfile?.viewedBy?.find((user) => {
      console.log(user);
      return user?._id?.toString() === loginUserId;
    });
    if (alreadyViewed) {
      res.json(myProfile);
    } else {
      const profile = await User.findByIdAndUpdate(myProfile?._id, {
        $push: { viewedBy: loginUserId },
      });
      res.json(profile);
    }
  } catch (error) {
    res.json(error);
  }
});

//------------------------------
//Update profile
//------------------------------
const updateUserCtrl = expressAsyncHandler(async (req, res) => {
  const { _id } = req?.user;
  //block user
  blockUser(req?.user);
  validateMongodbId(_id);
  const user = await User.findByIdAndUpdate(
    _id,
    {
      firstName: req?.body?.firstName,
      lastName: req?.body?.lastName,
      email: req?.body?.email,
      bio: req?.body?.bio,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  res.json(user);
});

//------------------------------
//Update password
//------------------------------

const updateUserPasswordCtrl = expressAsyncHandler(async (req, res) => {
  //destructure the login user
  const { _id } = req.user;
  const { password } = req.body;
  validateMongodbId(_id);
  //Find the user by _id
  const user = await User.findById(_id);

  if (password) {
    user.password = password;
    const updatedUser = await user.save();
    res.json(updatedUser);
  } else {
    res.json(user);
  }
});

//------------------------------
//Following
//------------------------------

const followingUserCtrl = expressAsyncHandler(async (req, res) => {
  //1. Find the user you want to follow and updaet it's follwers field
  //2. Update the login user following field
  const { followId } = req.body;
  const loginUserId = req.user.id;

  //Find the target user and check if the login id exist already
  const targetUser = await User.findById(followId);

  const alreadyFollowing = targetUser?.followers?.find(
    (user) => user?.toString() === loginUserId.toString()
  );

  if (alreadyFollowing) throw new Error("You have already followed this user!");

  //1. Find the user you want to follow and updaet it's follwers field
  await User.findByIdAndUpdate(
    followId,
    {
      $push: { followers: loginUserId },
      isFollowing: true,
    },
    { new: true }
  );

  //2. Update the login user following field
  await User.findByIdAndUpdate(
    loginUserId,
    {
      $push: { following: followId },
    },
    { new: true }
  );

  res.json("You have successfully followed this user!");
});

//------------------------------
//Unfollow
//------------------------------

const unfollowUserCtrl = expressAsyncHandler(async (req, res) => {
  const { unFollowId } = req.body;
  const loginUserId = req.user.id;

  await User.findByIdAndUpdate(
    unFollowId,
    {
      $pull: { followers: loginUserId },
      isFollowing: false,
    },
    { new: true }
  );

  await User.findByIdAndUpdate(
    loginUserId,
    { $pull: { following: unFollowId } },
    { new: true }
  );

  res.json("You have successfully unfollowed this user!");
});

//------------------------------
//Block users
//------------------------------

const blockUserCtrl = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongodbId(id);

  const user = await User.findByIdAndUpdate(
    id,
    {
      isBlocked: true,
    },
    { new: true }
  );
  res.json(user);
});

//------------------------------
//unBlock users
//------------------------------

const unBlockUserCtrl = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongodbId(id);

  const user = await User.findByIdAndUpdate(
    id,
    {
      isBlocked: false,
    },
    { new: true }
  );
  res.json(user);
});

//------------------------------
// Generate email verification token
//------------------------------

const generateVerificationTokenCtrl = expressAsyncHandler(async (req, res) => {
  const loginUserId = req.user.id;
  const user = await User.findById(loginUserId);
  console.log(user);
  try {
    //Generate token
    const verificationToken = await user?.createAccountVerificationToken();
    //Save the user
    await user.save();
    console.log(verificationToken);

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    //build your message
    // const resetURL = `If you were requested to verify your account, verify now within 10 minutes, otherwise ignore this message <a href="https://blendaproject.netlify.app/verify-account/${verificationToken}">Click to verify your account</a>`;
    const resetURL = `
    <div id=":1aw" class="a3s aiL msg4488850096719810666 adM">
    <div class="HOEnZb">
      <div class="adm">
        <div
          id="q_9"
          class="ajR h4"
          data-tooltip="Ẩn nội dung được mở rộng"
          aria-label="Ẩn nội dung được mở rộng"
          aria-expanded="true"
        >
          <div class="ajT"></div>
        </div>
      </div>
      <div class="im">
        <u></u>
  
        <div style="margin: 0; padding: 0; background-color: #ffffff">
          <table
            bgcolor="#FFFFFF"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="
              table-layout: fixed;
              vertical-align: top;
              min-width: 320px;
              border-spacing: 0;
              border-collapse: collapse;
              background-color: #ffffff;
              width: 100%;
            "
            valign="top"
            width="100%"
          >
            <tbody>
              <tr style="vertical-align: top" valign="top">
                <td
                  style="word-break: break-word; vertical-align: top"
                  valign="top"
                >
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num4
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 164px;
                            width: 166px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                align="center"
                                style="padding-right: 0px; padding-left: 0px"
                              >
                                <img
                                  src="https://i.imgur.com/cuTEYs9.png"
                                  style="
                                    text-decoration: none;
                                    height: auto;
                                    border: 0;
                                    width: 100%;
                                    max-width: 167px;
                                    display: block;
                                  "
                                  width="167"
                                  data-image-whitelisted=""
                                  class="CToWUd"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
  
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num8
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 328px;
                            width: 333px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #555555;
                                  font-family: Arial, Helvetica Neue, Helvetica,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 12px;
                                    line-height: 1.2;
                                    color: #555555;
                                    font-family: Arial, Helvetica Neue, Helvetica,
                                      sans-serif;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 12px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    &nbsp;
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <table
                                border="0"
                                cellpadding="0"
                                cellspacing="0"
                                role="presentation"
                                style="
                                  table-layout: fixed;
                                  vertical-align: top;
                                  border-spacing: 0;
                                  border-collapse: collapse;
                                  min-width: 100%;
                                "
                                valign="top"
                                width="100%"
                              >
                                <tbody>
                                  <tr style="vertical-align: top" valign="top">
                                    <td
                                      style="
                                        word-break: break-word;
                                        vertical-align: top;
                                        min-width: 100%;
                                        padding-top: 10px;
                                        padding-right: 10px;
                                        padding-bottom: 10px;
                                        padding-left: 10px;
                                      "
                                      valign="top"
                                    >
                                      <table
                                        align="center"
                                        border="0"
                                        cellpadding="0"
                                        cellspacing="0"
                                        role="presentation"
                                        style="
                                          table-layout: fixed;
                                          vertical-align: top;
                                          border-spacing: 0;
                                          border-collapse: collapse;
                                          border-top: 1px solid #dee4ed;
                                          width: 100%;
                                        "
                                        valign="top"
                                        width="100%"
                                      >
                                        <tbody>
                                          <tr
                                            style="vertical-align: top"
                                            valign="top"
                                          >
                                            <td
                                              style="
                                                word-break: break-word;
                                                vertical-align: top;
                                              "
                                              valign="top"
                                            >
                                              <span></span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
  
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    Xin chào Blenda-er!
                                  </p>
                                </div>
                              </div>
  
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 16px"
                                      >Nếu bạn không yêu cầu xác minh mật khẩu tại Blenda,
                                      vui lòng bỏ qua email này!</span
                                    >
                                  </p>
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    &nbsp;
                                  </p>
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 16px"
                                      >Để xác minh tài khoản Blenda, vui lòng click vào nút
                                      xác minh dưới đây. Blenda chúc bạn một ngày vui vẻ.</span
                                    >
                                  </p>
                                </div>
                              </div>
  
                              <a
                                align="center"
                                style="
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 0px;
                                  padding-left: 10px;
                                "
                              >
                              </a
                              ><a
                                href="https://blendaproject.netlify.app/verify-account/${verificationToken}"
                                style="
                                  text-decoration: none;
                                  display: block;
                                  color: #ffffff;
                                  background-color: #532bdc;
                                  border-radius: 6px;
                                  width: 100%;
                                  width: calc(100% - 2px);
                                  border-top: 1px solid #532bdc;
                                  border-right: 1px solid #532bdc;
                                  border-bottom: 1px solid #532bdc;
                                  border-left: 1px solid #532bdc;
                                  padding-top: 5px;
                                  padding-bottom: 5px;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  text-align: center;
                                  word-break: keep-all;
                                "
                                target="_blank"
                                data-saferedirecturl="https://www.google.com/url?q=https://blendaproject.netlify.app/verify-account/${verificationToken}&amp;source=gmail&amp;ust=1640332839663000&amp;usg=AOvVaw2unvPduBcrwkM0M5d5iBnd"
                              >
                                <span
                                  style="
                                    padding-left: 60px;
                                    padding-right: 60px;
                                    font-size: 16px;
                                    display: inline-block;
                                    letter-spacing: undefined;
                                  "
                                  ><span
                                    style="
                                      font-size: 16px;
                                      line-height: 1.5;
                                      word-break: break-word;
                                    "
                                    ><div
                                      href="https://blendaproject.netlify.app/verify-account/${verificationToken}"
                                      style="
                                        font-size: 16px;
                                        line-height: 24px;
                                        color: white;
                                        text-decoration: none;
                                      "
                                    >
                                      Xác minh tài khoản
                                    </div></span
                                  ></span
                                >
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #8d9198;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 0px;
                                  padding-right: 0px;
                                  padding-bottom: 0px;
                                  padding-left: 0px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #8d9198;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 12px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      text-align: center;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 12px"
                                      >Vì bất cứ lí do nào mà nút xác nhận bên
                                      trên không hoạt động,
                                      <a
                                        href="https://blendaproject.netlify.app/verify-account/${verificationToken}"
                                      >
                                        vui lòng click vào đây để xác minh tài khoản!</a
                                      >
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="
                        m_4488850096719810666block-grid
                        m_4488850096719810666two-up
                      "
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                        padding-top: 95px;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num8
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 246px;
                            width: 250px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 14px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 14px;
                                      line-height: 1.2;
                                      text-align: left;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <strong
                                      ><span style="font-size: 12px"
                                        >© 2021 Blenda. All rights reserved.</span
                                      ></strong
                                    >
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
  
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num4
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 246px;
                            width: 250px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #8d9198;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 14px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #8d9198;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 14px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      text-align: right;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <a
                                      href="https://blendaproject.netlify.app"
                                      rel="noopener"
                                      style="
                                        text-decoration: none;
                                        color: #8d9198;
                                      "
                                      target="_blank"
                                      data-saferedirecturl="https://www.google.com/url?q=https://blendaproject.netlify.app&amp;source=gmail&amp;ust=1640332839663000&amp;usg=AOvVaw3zE4tSktkGvYuajC94JQAF"
                                      ><span style="font-size: 12px"
                                        >Về chúng tôi</span
                                      ></a
                                    >
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <table
                                cellpadding="0"
                                cellspacing="0"
                                role="presentation"
                                style="
                                  table-layout: fixed;
                                  vertical-align: top;
                                  border-spacing: 0;
                                  border-collapse: collapse;
                                "
                                valign="top"
                                width="100%"
                              >
                                <tbody>
                                  <tr style="vertical-align: top" valign="top">
                                    <td
                                      align="center"
                                      style="
                                        word-break: break-word;
                                        vertical-align: top;
                                        padding-top: 5px;
                                        padding-right: 0px;
                                        padding-bottom: 5px;
                                        padding-left: 0px;
                                        text-align: center;
                                      "
                                      valign="top"
                                    >
                                      <table
                                        cellpadding="0"
                                        cellspacing="0"
                                        class="m_4488850096719810666icons-inner"
                                        role="presentation"
                                        style="
                                          table-layout: fixed;
                                          vertical-align: top;
                                          border-spacing: 0;
                                          border-collapse: collapse;
                                          display: inline-block;
                                          padding-left: 0px;
                                          padding-right: 0px;
                                        "
                                        valign="top"
                                      ></table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
    `;

    let msg = {
      from: "ryannguyen0303@gmail.com", // Sender email
      to: user?.email, // Receiver email
      subject: "Verification your account", // Title email
      html: resetURL, // Html in email
    };

    await transporter.sendMail(msg);

    res.json(resetURL);
  } catch (error) {
    res.json(error);
  }
});

//------------------------------
// Account verification
//------------------------------

const accountVerificationCtrl = expressAsyncHandler(async (req, res) => {
  const { token } = req.body;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  //find this user by token
  const userFound = await User.findOne({
    accountVerificationToken: hashedToken,
    accountVerificationTokenExpires: { $gt: new Date() },
  });
  if (!userFound) throw new Error("Token expired, try again later");
  //update the property to true
  userFound.isAccountVerified = true;
  userFound.accountVerificationToken = undefined;
  userFound.accountVerificationTokenExpires = undefined;
  await userFound.save();
  res.json(userFound);
});

//------------------------------
// Forget token generator
//------------------------------

const forgetPasswordToken = expressAsyncHandler(async (req, res) => {
  //find  this user by email address
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found!");

  try {
    const token = await user.createPasswordResetToken();
    console.log(token);
    await user.save();

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    //build your message
    // const resetURL = `If you were requested to reset your password, reset now within 10
    //   minutes, otherwise ignore this message <a href="https://blendaproject.netlify.app/reset-password/${token}">Click here to verify</a>`;

    const resetURL = `
    <div id=":1aw" class="a3s aiL msg4488850096719810666 adM">
    <div class="HOEnZb">
      <div class="adm">
        <div
          id="q_9"
          class="ajR h4"
          data-tooltip="Ẩn nội dung được mở rộng"
          aria-label="Ẩn nội dung được mở rộng"
          aria-expanded="true"
        >
          <div class="ajT"></div>
        </div>
      </div>
      <div class="im">
        <u></u>
  
        <div style="margin: 0; padding: 0; background-color: #ffffff">
          <table
            bgcolor="#FFFFFF"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="
              table-layout: fixed;
              vertical-align: top;
              min-width: 320px;
              border-spacing: 0;
              border-collapse: collapse;
              background-color: #ffffff;
              width: 100%;
            "
            valign="top"
            width="100%"
          >
            <tbody>
              <tr style="vertical-align: top" valign="top">
                <td
                  style="word-break: break-word; vertical-align: top"
                  valign="top"
                >
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num4
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 164px;
                            width: 166px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                align="center"
                                style="padding-right: 0px; padding-left: 0px"
                              >
                                <img
                                  src="https://i.imgur.com/cuTEYs9.png"
                                  style="
                                    text-decoration: none;
                                    height: auto;
                                    border: 0;
                                    width: 100%;
                                    max-width: 167px;
                                    display: block;
                                  "
                                  width="167"
                                  data-image-whitelisted=""
                                  class="CToWUd"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
  
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num8
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 328px;
                            width: 333px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #555555;
                                  font-family: Arial, Helvetica Neue, Helvetica,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 12px;
                                    line-height: 1.2;
                                    color: #555555;
                                    font-family: Arial, Helvetica Neue, Helvetica,
                                      sans-serif;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 12px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    &nbsp;
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <table
                                border="0"
                                cellpadding="0"
                                cellspacing="0"
                                role="presentation"
                                style="
                                  table-layout: fixed;
                                  vertical-align: top;
                                  border-spacing: 0;
                                  border-collapse: collapse;
                                  min-width: 100%;
                                "
                                valign="top"
                                width="100%"
                              >
                                <tbody>
                                  <tr style="vertical-align: top" valign="top">
                                    <td
                                      style="
                                        word-break: break-word;
                                        vertical-align: top;
                                        min-width: 100%;
                                        padding-top: 10px;
                                        padding-right: 10px;
                                        padding-bottom: 10px;
                                        padding-left: 10px;
                                      "
                                      valign="top"
                                    >
                                      <table
                                        align="center"
                                        border="0"
                                        cellpadding="0"
                                        cellspacing="0"
                                        role="presentation"
                                        style="
                                          table-layout: fixed;
                                          vertical-align: top;
                                          border-spacing: 0;
                                          border-collapse: collapse;
                                          border-top: 1px solid #dee4ed;
                                          width: 100%;
                                        "
                                        valign="top"
                                        width="100%"
                                      >
                                        <tbody>
                                          <tr
                                            style="vertical-align: top"
                                            valign="top"
                                          >
                                            <td
                                              style="
                                                word-break: break-word;
                                                vertical-align: top;
                                              "
                                              valign="top"
                                            >
                                              <span></span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
  
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    Xin chào Blenda-er!
                                  </p>
                                </div>
                              </div>
  
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 16px"
                                      >Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này!</span
                                    >
                                  </p>
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    &nbsp;
                                  </p>
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 16px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 16px"
                                      >Để khôi phục mật khẩu, bạn hãy ấn vào
                                      nút bên dưới. Blenda chúc bạn một ngày
                                      vui vẻ.</span
                                    >
                                  </p>
                                </div>
                              </div>
  
                              <a
                                align="center"
                                style="
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 0px;
                                  padding-left: 10px;
                                "
                              >
                              </a
                              ><a
                                href="https://blendaproject.netlify.app/reset-password/${token}"
                                style="
                                  text-decoration: none;
                                  display: block;
                                  color: #ffffff;
                                  background-color: #532bdc;
                                  border-radius: 6px;
                                  width: 100%;
                                  width: calc(100% - 2px);
                                  border-top: 1px solid #532bdc;
                                  border-right: 1px solid #532bdc;
                                  border-bottom: 1px solid #532bdc;
                                  border-left: 1px solid #532bdc;
                                  padding-top: 5px;
                                  padding-bottom: 5px;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  text-align: center;
                                  word-break: keep-all;
                                "
                                target="_blank"
                                data-saferedirecturl="https://www.google.com/url?q=https://blendaproject.netlify.app/reset-password/${token}&amp;source=gmail&amp;ust=1640332839663000&amp;usg=AOvVaw2unvPduBcrwkM0M5d5iBnd"
                              >
                                <span
                                  style="
                                    padding-left: 60px;
                                    padding-right: 60px;
                                    font-size: 16px;
                                    display: inline-block;
                                    letter-spacing: undefined;
                                  "
                                  ><span
                                    style="
                                      font-size: 16px;
                                      line-height: 1.5;
                                      word-break: break-word;
                                    "
                                    ><div
                                      href="https://blendaproject.netlify.app/reset-password/${token}"
                                      style="
                                        font-size: 16px;
                                        line-height: 24px;
                                        color: white;
                                        text-decoration: none;
                                      "
                                    >
                                      Khôi phục mật khẩu
                                    </div></span
                                  ></span
                                >
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #8d9198;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 0px;
                                  padding-right: 0px;
                                  padding-bottom: 0px;
                                  padding-left: 0px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 16px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #8d9198;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 12px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      text-align: center;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <span style="font-size: 12px"
                                      >Vì bất cứ lí do nào mà nút xác nhận bên trên không hoạt động,
                                      <a href="https://blendaproject.netlify.app/reset-password/${token}"> vui lòng click vào đây để khôi phục mật khẩu!</a>
                                      </span
                                    >
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="
                        m_4488850096719810666block-grid
                        m_4488850096719810666two-up
                      "
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                        padding-top: 95px;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num8
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 246px;
                            width: 250px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #555555;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 14px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #555555;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 14px;
                                      line-height: 1.2;
                                      text-align: left;
                                      word-break: break-word;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <strong
                                      ><span style="font-size: 12px"
                                        >© 2021 Blenda. All rights
                                        reserved.</span
                                      ></strong
                                    >
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
  
                        <div
                          class="
                            m_4488850096719810666col m_4488850096719810666num4
                          "
                          style="
                            display: table-cell;
                            vertical-align: top;
                            max-width: 320px;
                            min-width: 246px;
                            width: 250px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <div
                                style="
                                  color: #8d9198;
                                  font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                    sans-serif;
                                  line-height: 1.2;
                                  padding-top: 10px;
                                  padding-right: 10px;
                                  padding-bottom: 10px;
                                  padding-left: 10px;
                                "
                              >
                                <div
                                  style="
                                    font-size: 14px;
                                    line-height: 1.2;
                                    font-family: 'Ubuntu', Tahoma, Verdana, Segoe,
                                      sans-serif;
                                    color: #8d9198;
                                  "
                                >
                                  <p
                                    style="
                                      margin: 0;
                                      font-size: 14px;
                                      line-height: 1.2;
                                      word-break: break-word;
                                      text-align: right;
                                      margin-top: 0;
                                      margin-bottom: 0;
                                    "
                                  >
                                    <a
                                      href="https://blendaproject.netlify.app"
                                      rel="noopener"
                                      style="
                                        text-decoration: none;
                                        color: #8d9198;
                                      "
                                      target="_blank"
                                      data-saferedirecturl="https://www.google.com/url?q=https://blendaproject.netlify.app&amp;source=gmail&amp;ust=1640332839663000&amp;usg=AOvVaw3zE4tSktkGvYuajC94JQAF"
                                      ><span style="font-size: 12px"
                                        >Về chúng tôi</span
                                      ></a
                                    >
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="background-color: transparent">
                    <div
                      class="m_4488850096719810666block-grid"
                      style="
                        min-width: 320px;
                        max-width: 500px;
                        word-wrap: break-word;
                        word-break: break-word;
                        margin: 0 auto;
                        background-color: transparent;
                      "
                    >
                      <div
                        style="
                          border-collapse: collapse;
                          display: table;
                          width: 100%;
                          background-color: transparent;
                        "
                      >
                        <div
                          class="m_4488850096719810666col"
                          style="
                            min-width: 320px;
                            max-width: 500px;
                            display: table-cell;
                            vertical-align: top;
                            width: 500px;
                          "
                        >
                          <div
                            class="m_4488850096719810666col_cont"
                            style="width: 100% !important"
                          >
                            <div
                              style="
                                border-top: 0px solid transparent;
                                border-left: 0px solid transparent;
                                border-bottom: 0px solid transparent;
                                border-right: 0px solid transparent;
                                padding-top: 5px;
                                padding-bottom: 5px;
                                padding-right: 0px;
                                padding-left: 0px;
                              "
                            >
                              <table
                                cellpadding="0"
                                cellspacing="0"
                                role="presentation"
                                style="
                                  table-layout: fixed;
                                  vertical-align: top;
                                  border-spacing: 0;
                                  border-collapse: collapse;
                                "
                                valign="top"
                                width="100%"
                              >
                                <tbody>
                                  <tr style="vertical-align: top" valign="top">
                                    <td
                                      align="center"
                                      style="
                                        word-break: break-word;
                                        vertical-align: top;
                                        padding-top: 5px;
                                        padding-right: 0px;
                                        padding-bottom: 5px;
                                        padding-left: 0px;
                                        text-align: center;
                                      "
                                      valign="top"
                                    >
                                      <table
                                        cellpadding="0"
                                        cellspacing="0"
                                        class="m_4488850096719810666icons-inner"
                                        role="presentation"
                                        style="
                                          table-layout: fixed;
                                          vertical-align: top;
                                          border-spacing: 0;
                                          border-collapse: collapse;
                                          display: inline-block;
                                          padding-left: 0px;
                                          padding-right: 0px;
                                        "
                                        valign="top"
                                      ></table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
    `;

    let msg = {
      from: "ryannguyen0303@gmail.com", // Sender email
      to: email, // Receiver email
      subject: "Reset Password", // Title email
      html: resetURL, // Html in email
    };

    await transporter.sendMail(msg);
    res.json(resetURL);
  } catch (error) {
    res.json(error);
  }
});

//------------------------------
// Password reset
//------------------------------

const passwordResetCtrl = expressAsyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  //find this user by token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new Error("Token expired, try again later");

  //Update/change password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json(user);
});

//------------------------------
// Profile photo upload
//------------------------------

const profilePhotoUploadCtrl = expressAsyncHandler(async (req, res) => {
  //Find the login user
  const { _id } = req.user;
  //block user
  blockUser(req?.user);
  //1. Get the path to the image
  const locallPath = `public/images/profile/${req.file.filename}`;
  //2. Upload to cloudinary
  const imgUploaded = await cloudinaryUploadImg(locallPath);

  const fooundUser = await User.findByIdAndUpdate(
    _id,
    {
      profilePhoto: imgUploaded?.url,
    },
    { new: true }
  );
  //Remove the uploaded photo
  fs.unlinkSync(locallPath);
  res.json(imgUploaded);
});

module.exports = {
  profilePhotoUploadCtrl,
  forgetPasswordToken,
  generateVerificationTokenCtrl,
  userRegisterCtrl,
  loginUserCtrl,
  fetchUsersCtrl,
  deleteUsersCtrl,
  fetchUserDetailsCtrl,
  userProfileCtrl,
  updateUserCtrl,
  updateUserPasswordCtrl,
  followingUserCtrl,
  unfollowUserCtrl,
  blockUserCtrl,
  unBlockUserCtrl,
  accountVerificationCtrl,
  passwordResetCtrl,
};
