"use strict";

const http = require('http');
const express = require('express');
const path = require('path')
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const csrf = require('csurf')
const MongoStore = require('connect-mongo')(session);
const bodyparser = require('body-parser');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const moment = require('moment-timezone');
const Message = require('./schema/Message');
const User = require('./schema/User');

const app = express();
const csrfProtection = csrf();
const log = require('./lib/error_logger');

const twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};

moment.tz.setDefault("Asia/Tokyo");

mongoose.connect(process.env.MONGODB_URI,(err)=>{
  if(err){
     console.error(err);
  }else{
     console.log("successfully connected to MongoDB.");
  }
})

function checkAuth(req, res, next) {
  if(req.isAuthenticated()){
    return next()
  }else{
    return res.redirect('/oauth/twitter')
  }
}

app.use(bodyparser())
app.use(session({
  secret: 'b87ef9fb4a152dbfe4cf4ea630444474',
  resave : false,
  saveUninitialized : false,
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    db: 'session',
    ttl: 14 * 24 * 60 * 60,
  })
}))

app.use(passport.initialize());
app.use(passport.session());

app.use("/image", express.static(path.join(__dirname, 'image')))
app.use("/avatar", express.static(path.join(__dirname, 'avatar')))
app.use("/css", express.static(path.join(__dirname, 'css')))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get("/", (req, res, next)=> {
  Message.find({}, (err, msgs)=> {
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null,
      moment: moment
    });
  })
});

app.get("/logout", (req, res, next)=> {
  req.logout();
  delete req.session.user
  return res.redirect("/");
})

passport.use(new TwitterStrategy(twitterConfig,
  (token, tokenSecret, profile, done)=> {
    User.findOne({ twitter_profile_id: profile.id }, (err, user)=> {
      if (err) {
        return done(err);
      }else if (!user) {
        const _user = {
          username: profile.displayName,
          twitter_profile_id: profile.id,
          avatar_path: profile.photos[0].value
        };
        const newUser = new User(_user);
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
  (req, res, next)=> {

    User.findOne({_id: req.session.passport.user}, (err, user)=> {
      if(err||!req.session) return res.redirect('/oauth/twitter')
      req.session.user = {
        username: user.username,
        avatar_path: user.avatar_path
      };
      return res.redirect("/")
    })
  }
);
passport.serializeUser((user, done)=> {
  done(null, user._id);
});

passport.deserializeUser((id, done)=> {
  User.findOne({_id: id}, (err, user)=> {
    done(err, user);
  });
});

app.get("/update", csrfProtection, (req, res, next)=> {
  return res.render('update', {
    user: req.session && req.session.user ? req.session.user : null,
    csrf: req.csrfToken()
  });
});

app.post("/update", checkAuth, fileUpload(), csrfProtection, (req, res, next)=> {

  const {username, message} = req.body;

  if(req.files && req.files.image){
    const img = req.files.image

    img.mv('./image/' + img.name, (err)=> {
      if(err) throw err

      const newMessage = new Message({
        username: username,
        avatar_path: req.session.user.avatar_path,
        message: message,
        image_path: '/image/' + img.name,
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.redirect("/")
      })
    })
  }else{

      const newMessage = new Message({
        username: username,
        avatar_path: req.session.user.avatar_path,
        message: message,
      })
      newMessage.save((err)=>{
        if(err) throw err
        return res.redirect("/")
      })
  }
})

app.use((req, res, next)=> {
  let err = new Error('Not Found');
  err.status = 404;
  return res.render('error', {
    status: err.status,
  });
});

app.use((err, req, res, next)=> {
  log.error(err);
  if (err.code === 'EBADCSRFTOKEN'){
    res.status(403)
  }else{
    res.status(err.status || 500);
  }
  return res.render('error', {
    message: err.message,
    status: err.status || 500
  });
});

const server = http.createServer(app);
server.listen(process.env.PORT);
