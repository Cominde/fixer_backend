const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cron = require("node-cron");
const axios = require("axios");
const Car=require("./models/Car");

dotenv.config({ path: "config.env" });
const apiError = require("./utils/apiError");
const dbconnection = require("./config/database");
//const categoryRoute = require("./routes/categoryRoutes");
//const SubCategoryRoute = require("./routes/subCategoryRoutes");
const GarageRoute = require("./routes/GarageRoute");
const InvRoute = require("./routes/inventoryRoute");
const userRoute = require("./routes/userRoute");
const authRoute = require("./routes/authRoute");
const repairingRoute = require("./routes/repairingRoute");
const homeRoute = require("./routes/homeRoute");
const workerRoute = require("./routes/WorkersRoute");
const MonthlyReport = require("./routes/monthlyReportRoute");
const CategoryCode = require("./routes/CategoryCodeRoute");
const appVersion = require("./routes/appVersionRoute");
const globalError = require("./middlewares/errorMiddleWare");

//db connection
dbconnection();
// express app
const app = express();
// middlewaers
app.use(express.json());
// eslint-disable-next-line eqeqeq
if (process.env.NODE_ENV == "development") {
  app.use(morgan("dev"));
  console.log(` mode ${process.env.NODE_ENV}`);
}

// Routes
app.use("/api/V1/Inventort", InvRoute);
app.use("/api/V1/Garage", GarageRoute);
app.use("/api/V1/User", userRoute);
app.use("/api/V1/auth", authRoute);
app.use("/api/V1/repairing", repairingRoute);
app.use("/api/V1/Home", homeRoute);
app.use("/api/V1/Worker", workerRoute);
app.use("/api/V1/MonthlyReport", MonthlyReport);
app.use("/api/V1/Category", CategoryCode);
app.use("/api/V1/appVersion", appVersion);
// ping api
app.get("/api/ping", (req, res) => {
  res.status(200).send("Server is alive!");
});

app.all("*", (req, res, next) => {
  //create error and send it to error handling middleware
  // eslint-disable-next-line new-cap
  next(new apiError(`can not find this route ${req.originalUrl}`, 400));
});
//Global error handling middleware
app.use(globalError);

const PORT = process.env.PORT || 4100;
const server = app.listen(PORT, () => {
  console.log(`app running on port ${PORT}`);
});
//handle rejection outside express
process.on("unhandledRejection", (err) => {
  console.error(`unhandledRejection error ${err.name} | ${err.message}`);
  server.close(() => {
    console.error(`Shutting down ......`);
    process.exit(1);
  });
});

//self-ping cron job to keep the server awake
cron.schedule("*/14 * * * *", () => {
  console.log("Pinging the server to keep it alive...");
  axios
    .get(`${process.env.BASE_URL}/api/ping`)

    .then((response) => {
      console.log("Ping successful:", response.data);
    })
    .catch((error) => {
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error(
          "Server responded with an error:",
          error.response.status,
          error.response.data
        );
      } else if (error.request) {
        // No response received
        console.error("No response received:", error.request);
      } else {
        // Error setting up the request
        console.error("Error setting up the request:", error.message);
      }
    });
});

const checkAndUpdateCarStatus = async () => {
  try {
    const currentDate = new Date();

    // Find cars that need maintenance
    const carsToRepair = await Car.find({
      nextRepairDate: { $lte: currentDate },
    });

    if (carsToRepair.length > 0) {
      console.log("Updating status for cars that need maintenance...");

      // Update the status of each car to "Need to check"
      const updateResult = await Car.updateMany(
        { nextRepairDate: { $lte: currentDate } },
        { $set: { State: "Need to check" } }
      );

      console.log(
        `${updateResult.modifiedCount} car(s) updated to "Need to check".`
      );
    } else {
      console.log("No cars need maintenance today.");
    }
  } catch (error) {
    console.error("Error checking and updating car status:", error);
  }
};

// Schedule the job to run daily at 12:30 AM
cron.schedule("30 0 * * *", async () => {
  console.log("Running daily car maintenance check...");
  await checkAndUpdateCarStatus();
});