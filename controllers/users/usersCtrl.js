const expressAsyncHandler = require('express-async-handler');
const User = require("../../model/user/User");

//--------------------------------
//Register
//--------------------------------

const userRegisterCtrl = expressAsyncHandler(async (req, res) => {
  //Check if user is already registered
  const userExists = await User.findOne({ email: req?.body?.email });

  if (userExists) throw new Error("User already registered");
  try {
    // Register user
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


//--------------------------------
//Login user
//--------------------------------


const loginUserCtrl = expressAsyncHandler(async (req, res) => {
  //check if user is already registered
  const user = await User.findOne({ email: req?.body?.email});
  if(!user){
    throw new Error(`Login credentials are not valid`);
  }
  res.json("user login");
});


module.exports = { userRegisterCtrl, loginUserCtrl };
