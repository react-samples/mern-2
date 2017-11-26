var mongoose = require('mongoose');

var User = mongoose.Schema({
  username: String,
  password: String,
  date: {type: Date, default: new Date()},
  avatar_path: String,
  twitter_profile_id: String
});

module.exports = mongoose.model('User', User)
