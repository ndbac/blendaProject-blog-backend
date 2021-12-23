const expressAsyncHandler = require("express-async-handler");
const nodemailer = require("nodemailer");
const Filter = require("bad-words");
const EmailMsg = require("../../model/EmailMessaging/EmailMessaging");

const sendEmailMsgCtrl = expressAsyncHandler(async (req, res) => {
  const { to, subject, message } = req.body;
  //get the message
  const emailMessage = subject + " " + message;
  // prevent profanity words
  const filter = new Filter();

  const isProfane = filter.isProfane(emailMessage);
  if (isProfane)
    throw new Error(`Email sent failed, because it contains profanity words`);

  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_2,
        pass: process.env.PASS_2,
      },
    });

    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: 465,
    //   secure: true,
    //   auth: {
    //     user: process.env.EMAIL,
    //     pass: process.env.PASS
    //   }
    // });

    //build up message
    const msg = {
      from: process.env.EMAIL_2, // Sender email
      to: to, // Receiver email
      subject: subject, // Title email
      text: message, // Html in email
    };
    //send msg
    await transporter.sendMail(msg);
    //save to db
    await EmailMsg.create({
      sentBy: req?.user?._id,
      from: req?.user?.email,
      to,
      message,
      subject,
    });
    res.json("Email sent");
  } catch (error) {
    res.json(error);
  }
});

module.exports = { sendEmailMsgCtrl };
