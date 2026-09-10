const cors = require("cors");
const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cron = require("node-cron");
const axios = require("axios");

dotenv.config({ path: "config.env" });
const apiError = require("./utils/apiError");
const dbconnection = require("./config/database");
const { resetSalaryFieldsOnFirstDay } = require("./services/WorksServices");

const { runBackup } = require("./utils/for_backup/backup");
///swagger
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
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
const ClearCarData = require("./routes/ClearCarDataRoute");
const Notification = require("./routes/notificationRoute");
const SSERoute = require("./utils/sse/sseRoute");
const Booking = require("./routes/bookingRoute");
const issueRoute = require("./routes/issueRoute");
const measurementRoute = require("./routes/measurementRoute");
const permissionRoute = require("./routes/permissionRoute");

//db connection
dbconnection();
// express app
const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.options("*", cors());
// middlewaers
app.use(express.json());
// eslint-disable-next-line eqeqeq
if (process.env.NODE_ENV == "development") {
  app.use(morgan("dev"));
  console.log(` mode ${process.env.NODE_ENV}`);
}
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Fixer API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }),
);
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
app.use("/api/V1/ClearCarData", ClearCarData);
app.use("/api/V1/Notification", Notification);
app.use("/api/V1/SSE", SSERoute);
app.use("/api/V1/Booking", Booking);
app.use("/api/V1/issues", issueRoute);
app.use("/api/V1/measurement", measurementRoute);
app.use("/api/V1/permissions", permissionRoute);
// ping api
app.get("/api/ping", (req, res) => {
  res.status(200).send("Server is alive!");
});
const path = require("path");
const { PROJECT_ROOT } = require("./config/paths");

// Must be served at exactly this URL path — browser looks for it here automatically
app.get("/firebase-messaging-sw.js", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "firebase-messaging-sw.js"));
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
process.on("unhandledRejection", (err: any) => {
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
          error.response.data,
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

// Reset salary fields on first day of each month at midnight
cron.schedule("0 0 1 * *", async () => {
  console.log("Running monthly salary reset cron job...");
  try {
    // Create a mock request and response object
    const req = {};
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`Salary reset completed: ${JSON.stringify(data)}`);
        }
      })
    };
    const next = (error) => {
      console.error("Salary reset error:", error);
    };
    
    await resetSalaryFieldsOnFirstDay(req, res, next);
    console.log("Monthly salary reset completed successfully");
  } catch (error) {
    console.error("Error in monthly salary reset cron job:", error);
  }
});

export {};
