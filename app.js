const path = require("path");

const express = require("express");

const morgan = require("morgan");

const rateLimit = require("express-rate-limit");

const helmet = require("helmet");

const mongoSanitize = require("express-mongo-sanitize");

const xss = require("xss-clean");

const hpp = require("hpp");

const AppError = require("./utils/appError");

const globalErrorHandler = require("./controllers/errorController");

const tourRouter = require("./routes/tourRoutes");

const userRouter = require("./routes/userRoutes");

const reviewRouter = require("./routes/reviewRoutes");

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
//GLOBAL MIDDLEWARES

//serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, "public")));
//set security HTTP headers
app.use(helmet());
//development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
//limit request to the api
const limiter = rateLimit({
  max: 300,
  windowMs: 60 * 60 * 1000,
  message: "Too many request from this IP, please try again in an hour!",
});

app.use("/api", limiter);

//body parser
app.use(
  express.json({
    limit: "10kb",
  })
);

//Data sanitization against nosql query injection
app.use(mongoSanitize());

//data sanitization against XSS
app.use(xss());

//prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      "duration",
      "ratingsQuantity",
      "ratingsAverage",
      "maxGroupSize",
      "difficulty",
      "price",
    ],
  })
);

//serving static files
app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  next();
});

//test middleware

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log("HEADERS HEADERS Headers", req.headers);
  next();
});

//ROUTES
app.get("/", (req, res) => {
  res.status(200).render("base");
});

app.use("/api/v1/tours", tourRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/reviews", reviewRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`can't find ${req.originalUrl}`));
});

app.use(globalErrorHandler);
module.exports = app;
