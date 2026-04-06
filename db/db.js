const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://sparrowsyntax3210_db_user:Codeitup3210@ac-jikz1zm-shard-00-00.qis5opd.mongodb.net:27017,ac-jikz1zm-shard-00-01.qis5opd.mongodb.net:27017,ac-jikz1zm-shard-00-02.qis5opd.mongodb.net:27017/?ssl=true&replicaSet=atlas-tuoxj7-shard-0&authSource=admin&appName=InterVexa");
    console.log("DB connected Succesfully");
  } catch (err) {
    console.log(err);
  }
};

module.exports = connectDB;
