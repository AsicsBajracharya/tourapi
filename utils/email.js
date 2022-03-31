const nodemailer = require("nodemailer");

const catchAsync = require("./catchAsync");

const sendEmail = catchAsync(async (options) => {
  // 1) CREATE A TRANSPORTER
  const transporter = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "ac9cc99d8bddcf",
      pass: "0d9b95987c717d",
    },
  });
  // 2) DEFINE THE EMAIL OPTIONS
  const mailOptions = {
    from: "Ashish Bajracharya <ashish@bajracharya.com>",
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html:
  };
  // 3) SEND THE EMAIL WITH NODEMAILER
  transporter.sendMail(mailOptions);
});

module.exports = sendEmail;
