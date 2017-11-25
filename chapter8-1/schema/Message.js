var mongoose = require('mongoose');

var Message = mongoose.Schema({
  username: String,
  user_id: String,
  message: String,
  date: {type: Date, default: new Date()},
  image_path: String,
  avatar_path: String
});

module.exports = mongoose.model('Message', Message)
