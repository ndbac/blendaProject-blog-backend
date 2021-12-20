const express = require("express");
const { sendEmailMsgCtrl } = require("../../controllers/emailMsg/emailMsgCtrl");
const emailMsgRoute = express.Router();

emailMsgRoute.post("/", sendEmailMsgCtrl);

module.exports = emailMsgRoute;
