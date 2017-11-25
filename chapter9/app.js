"use strict";

var http = require('http');
var express = require('express');
var path = require('path')
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var session = require('express-session');
var csrf = require('csurf')
var MongoStore = require('connect-mongo')(session);
var bodyparser = require('body-parser');
var mongoose = require('mongoose');
var fileUpload = require('express-fileupload');

var Message = require('./schema/Message');
var User = require('./schema/User');

var app = express();
var csrfProtection = csrf();
var log = require('./lib/error_logger');

var twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};

mongoose.connect('mongodb://localhost:27017/chatapp',function(err){
  if(err){
     console.error(err);
  }else{
     console.log("successfully connected to MongoDB.")
  }
})


app.use(bodyparser())
app.use(session({
  secret: 'b87ef9fb4a152dbfe4cf4ea630444474',
  resave : false,
  saveUninitialized : false,
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    db: 'session',
    ttl: 14 * 24 * 60 * 60,
  }),

}));
app.use(passport.initialize());
app.use(passport.session());

app.use("/image", express.static(path.join(__dirname, 'image')))
app.use("/avatar", express.static(path.join(__dirname, 'avatar')))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get("/",function(req, res, next) {
  Message.find({}, function(err, msgs){
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null
    });
  })
});

passport.use(new TwitterStrategy(twitterConfig,
  function(token, tokenSecret, profile, done){
    User.findOne({ twitter_profile_id: profile.id }, function (err, user) {
      if (err) {
        return done(err);
      }else if (!user) {
        var _user = {
          username: profile.displayName,
          twitter_profile_id: profile.id,
          avatar_path: profile.photos[0].value
        };
        var newUser = new User(_user);
        newUser.save((err)=>{
          if(err) throw err
          return done(null, newUser);
        });
      }else{
        return done(null, user);
      }
    });
  }
));
app.get('/oauth/twitter', passport.authenticate('twitter'));

app.get('/oauth/twitter/callback', passport.authenticate('twitter'),
  function(req, res, next) {

    User.findOne({_id: req.session.passport.user}, function(err, user){
      if(err||!req.session) return res.redirect('/login')
      req.session.user = {
        username: user.username,
        avatar_path: user.avatar_path
      };
      return res.redirect("/")
    })
  }
);
passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({_id: id}, function(err, user) {
    done(err, user);
  });
});

app.get("/update", csrfProtection, function(req, res, next) {
  return res.render('update',{csrf: req.csrfToken()});
});

app.post("/update", fileUpload(), csrfProtection, function(req, res, next) {
  if(req.files && req.files.image){
    var img = req.files.image

    img.mv('./image/' + img.name, function(err){
      if(err) throw err

      var newMessage = new Message({
        username: req.body.username,
        avatar_path: req.session.user.avatar_path,
        message: req.body.message,
        image_path: '/image/' + img.name
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.redirect("/")
      })
    })
  }else{
      var newMessage = new Message({
        username: req.body.username,
        avatar_path: req.session.user.avatar_path,
        message: req.body.message,
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.redirect("/")
      })
  }
})

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  return res.render('error', {
    status: err.status,
  });
});

app.use(function(err, req, res, next) {
  log.error(err);
  if (err.code === 'EBADCSRFTOKEN'){
    res.status(403)
  }else{
    res.status(err.status || 500);
  }
  res.status(err.status || 500);
  return res.render('error', {
    message: err.message,
    status: err.status || 500
  });
});

const server = http.createServer(app);
server.listen('3000');
