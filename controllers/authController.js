const { promisify } = require("util");

const crypto = require("crypto");

const User = require("../models/userModel");

const jwt = require("jsonwebtoken");

const catchAsync = require("../utils/catchAsync");

const AppError = require("../utils/appError");

const sendEmail = require("../utils/email");

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = async (req, res, next) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      passwordChangedAt: req.body.passwordChangedAt,
      role: req.body.role,
    });
    createSendToken(newUser, 201, res);
  } catch (e) {
    res.status(404).json({
      status: "fail",
      message: e,
    });
  }
};

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1) CHECK IF EMAIL AND PASSWORD EXIST

  if (!email || !password) {
    return next(new AppError("please provide email and password", 400));
  }
  //2) CHECK IF USER EXISTS AND PASSWORD IS CORRECT
  const user = await User.findOne({ email }).select("+password");

  //3) IF EVERYTHING IS OK,  SEND TOKEN TO CLIEN
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  //1) GETTING TOKEN AND CHECK IT'S THERE
  let token = "";
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // console.log(token);
  if (!token) {
    return next(
      new AppError("Your are not logged in, please login to get access"),
      401
    );
  }
  //2) VERIFY TOKEN
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //3) CHECK IF USER STILL EXISTS
  const freshUser = await User.findById(decoded.id);
  if (!freshUser)
    return next(
      new AppError("The user belong to the token no longer exist", 401)
    );

  //4) CHECK IF THE USER CHANGED PASSWORD AFTER THE TOKEN WAS ISSUED
  // if (freshUser.changedPasswordAt(decoded.iat)) {
  //   return next(
  //     new AppError(
  //       "user recently changed the password! please log in again",
  //       401
  //     )
  //   );
  // }
  //GRAND ACCES TO PROTECTED ROUTE

  req.user = freshUser;
  next();
});

exports.forgotPassword = async (req, res, next) => {
  // 1) GET USER BASED ON POASTED EMAIL
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("there is no user with this email address", 404));
  }
  //2) GENERATE RANDOM RESET TOKEN
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  //3) SEND IT TO USER'S EMAIL
  const resetURL = `${req.protocol}://${res.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password ? Submit a PATCH request with your new passowrd and passwordConfirm to : ${resetURL}.\nif you didint forget your password please ignore your email`;
  try {
    await sendEmail({
      email: user.email,
      subject: "your password reset token",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "token send to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("there was an error send the email. try again later!", 500)
    );
  }
};
exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) GET USER BASED ON THE TOKEN
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  // 2) CHECK IF TOKEN HAS NOT EXPIRED AND THERE IS A USER

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  // 3) UPDATE CHANGEDPASSWRDAT PROPERTY FOR THE CURRENT USER
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // 4) LOG THE USER IN, SEND JWT

  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) GET USER FORM THE COLLECTION
  const user = await User.findById(req.user.id).select("password");
  if (!user) return next(new AppError("user not found", 401));
  // 2) CHECK IF THE POSTED CURRENT PASSWORD IS CORRECT
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong", 401));
  }
  // 3) UPDATE THE PASSWORD
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save(); // USER.FINDBYIDANDUPDATE WILL NOT WORK AS ITENDED
  // 4) LOG USER IN
  createSendToken(user, 200, res);
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    //roles is an array ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};
