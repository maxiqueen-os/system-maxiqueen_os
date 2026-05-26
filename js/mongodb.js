const mongoose = require("mongoose");

const DocSchema = new mongoose.Schema({
  text: String,
  embedding: [Number]
});

module.exports = mongoose.model("Doc", DocSchema);