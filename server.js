const app = require("./src/app");
const connectDB = require("./db/db");

app.listen(4000, () => {
  console.log("server is running at 4000");
});

connectDB();
