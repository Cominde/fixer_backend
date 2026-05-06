const mongoose = require("mongoose");

const dbconnection = () => {
  // connect to db
  mongoose.connect(process.env.DB_URL).then((conn) => {
    console.log(`data connected ${conn.connection.host}`);
  });
  //.catch((err) => {
  //     console.error(`Dataset error ${err}`);
  //     process.exit(1);
  // })
};

module.exports = dbconnection;
