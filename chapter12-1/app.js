"use strict";

var http = require('http');
var express = require('express');
var path = require('path')
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var session = require('express-session')
var bodyparser = require('body-parser');
var mongoose = require('mongoose');
var fileUpload = require('express-fileupload');
var winston = require('winston');
var csrf = require('csurf')

var Message = require('./schema/Message')
var User = require('./schema/User')

var app = express()
/*
var twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};*/
var twitterConfig = {
  consumerKey: "Xo2M7eGctF1epkwoc8beUtiBW",
  consumerSecret:"DP1H62XEx45Hl02KuirY9NRpB7Dum0NDbDuY392D6Z9Bt3sDeU",
  callbackURL:"http://localhost:3000/oauth/twitter/callback"
}
mongoose.connect('mongodb://localhost:27017/chatapp',function(err){
  if(err){
     console.error(err);
  }else{
     console.log("successfully connected to MongoDB.")
  }
})

global.logger = require('./lib/logger')

var csrfProtection = csrf()


app.use(bodyparser())
app.use(session({ secret: 'HogeFuga' }));
app.use(passport.initialize());
app.use(passport.session());

app.use("/image", express.static(path.join(__dirname, 'image')))
app.use("/avatar", express.static(path.join(__dirname, 'avatar')))
app.use("/js", express.static(path.join(__dirname, 'js')))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get("/", function(req, res, next) {
  return res.render('index');
})

app.get("/user", function(req, res, next) {
  return res.json({user: req.session && req.session.user ? req.session.user : null})
})

app.get("/messages",function(req, res, next) {
  Message.find({}, function(err, msgs){
    if(err) throw err;
    return res.json({
      messages: msgs, 
    });
  })
});


app.get("/login", function(req, res, next) {
  return res.render('login')
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
  console.log("serialized: " + user)
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({_id: id}, function(err, user) {
    console.log("deserialized: " + id)
    done(err, user);
  });
});

app.get("/update", csrfProtection, function(req, res, next) {
  return res.json({csrf: req.csrfToken()});
});

app.post("/update", fileUpload(), csrfProtection, function(req, res, next) {
  if(req.files){
    var img = req.files.image
    
    img.mv('./image/' + img.name, function(err){
      if(err) throw err
      
      var newMessage = new Message({
        username: req.body.username,
        message: req.body.message,
        image_path: '/image/' + img.name
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.json({message: newMessage, csrf: req.csrfToken()})
      })
    })
  }else{
      var newMessage = new Message({
        username: req.body.username,
        message: req.body.message,
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.redirect("/")
      })
  }
})

app.use(function(err, req, res, next) {
  logger.warn(err)
  res.status(err.status || 500);
  return res.json({
    message: err.message,
  });
});


const server = http.createServer(app);
server.listen('3000');

