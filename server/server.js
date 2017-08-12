var express = require('express');
var path = require('path');
var fs = require('fs');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var https = require('https');
var http = require('http');
var flash = require('express-flash');
var MongoStore = require('connect-mongo')(session);
var bcrypt = require('bcryptjs');

//Config file
var config = require('../config.json');
//Routes
// var errorPage = require('./routes/404.js');

var app = express();
//Setting up the static files
app.use(express.static(path.resolve(__dirname, '..', 'web', 'static')));
// app.use(express.favicon(path.resolve(__dirname, '..', 'web', 'images', 'favicon.ico')));

//================DATABASE======================
var db = require('monk')(config.dbLocation);
var Users = db.get('users');
var Teams = db.get('teams');
var Problems = db.get('problems');
var Submissions = db.get('submissions');

//================EXPRESS======================
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(session({
    secret: config.sessionSecret,
    saveUninitialized: false,
    resave: false,
    store: new MongoStore({
        url: config.dbLocation
    })
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
//Setting up handlebars as the templating engine
app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.resolve(__dirname, '..','web','layouts'),
    partialsDir: path.resolve(__dirname, '..','web','partials')
}));
app.set('view engine', '.hbs');
app.set('views', path.resolve(__dirname, '..', 'web'));
//================PASSPORT=====================
//Passes the passport user object on to the res, allowing it to be rendered by handlebars
app.use(function(req, res, next){
    res.locals.user = req.user;
    res.locals.error = req.flash('error');
    next();
});

passport.use(new LocalStrategy(function(username, password, done){
    // return done(null, {id:'wowow',name:'Josh'});
    Users.findOne({username: username}).then((doc) => {
        if(doc == null){
            return done(null, false, {message: 'Login Failed'});
        }
        var hash = doc.password;
        bcrypt.compare(password, hash).then((res) => {
            if(res == false){
                return done(null, false, {message: 'Login Failed'});
            }else{
                delete doc.password; // might not be necessary
                return done(null, doc);
            }
        }).catch((err) => {
            return done(err);
        });
    }).catch((err) => {
        return done(err);
    });
}));

passport.use('local-signup', new LocalStrategy({
    passReqToCallback: true
},
    function(req, username, password, done){
    Users.findOne({username: username}).then((doc) => {
        if(doc != null){
            return done(null, false, {message: 'User already exists'});
        }else{
            bcrypt.hash(password, 8, function(err, hash){
                if(err) return done(err);
                Users.insert({
                    username: username,
                    password: hash,
                    school: req.body.school,
                    country: req.body.country
                }, function(err, user){
                    return done(err, user);
                });
            });
        }
    }).catch((err) => {
        return done(err);
    });
}));

passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  Users.findOne({_id: id}, '-password', function(err, user){
      done(err, user);
  });
});

//Middlewhere for checking if logged in
function loggedIn(req, res, next) {
    if(req.user){
        next();
    }else{
        req.flash('error', 'Login Needed To Access That Resource');
        res.redirect('/login');
    }
}
//================ROUTES======================
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/about', (req, res) => {
    res.render('about');
});
app.get('/rules', (req, res) => {
    res.render('rules');
});
app.get('/team', loggedIn, (req, res) => {
    if(req.user.teamid){
        Teams.findOne({_id: req.user.teamid}).then((doc) => {
            res.render('team', doc);
        }).catch((err) => {
            res.end('Error');
        });
    }else{
        res.render('team');
    }
});
app.get('/problems', loggedIn, (req, res) => {
    res.render('problems');
});
app.get('/scoreboard', (req, res) => {
    res.render('scoreboard');
});
app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/register', (req, res) => {
    res.render('register');
});
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});
//Error page
app.get('*', (req, res, next) => {
    res.render('404');
});

//Start of API
app.post('/api/login', passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/team',
    failureFlash: true
}));
app.post('/api/register', passport.authenticate('local-signup', {
    failureRedirect: '/register',
    successRedirect: '/team',
    failureFlash: true
}));
// app.post('/api/scores', (req, res) => {
//     Teams.find({}, '-teampassword').then((docs) => {
//         res.end(docs);
//     }).catch((err) => {
//
//     });
// });
app.post('/api/jointeam', (req, res) => {
    if(req.body.joinTeam){
        //Join existing team
        Teams.findOne({teamname: req.body.teamname}).then((doc) => {
            if(doc == null){
                req.flash('error', "Team doesn't exist.");
                res.redirect('/team');
            }else{
                if(doc.numberOfMembers < config.maxTeamSize){
                    if(doc.teampassword == req.body.teampassword){
                        Users.findOneAndUpdate({_id: req.user._id}, {$set: {teamid: doc._id}});
                        Teams.findOneAndUpdate({_id: doc._id}, {$set: {numberOfMembers: doc.numberOfMembers + 1}});
                        res.redirect('/team');
                    }else{
                        req.flash('error', "Invalid team password.");
                        res.redirect('/team');
                    }
                }else{
                    req.flash('error', "Team is full.");
                    res.redirect('/team');
                }
            }
        });
    }else{
        //Create team
        Teams.findOne({teamname: req.body.teamname}).then((doc) => {
            if(doc != null){
                req.flash('error', "Team already exists.");
                res.redirect('/team');
            }else{
                var newTeam = {
                    teamname: req.body.teamname,
                    teampassword: req.body.teampassword,
                    numberOfMembers: 1
                }
                Teams.insert(newTeam, function(err, team){
                    Users.findOneAndUpdate({_id: req.user._id}, {$set: {teamid: team._id}});
                    res.redirect('/team');
                });
            }
        });
    }
});
// app.post('/api/leaveteam', (req, res) => {
//
// });


//================LISTEN======================
// const options = {
//     key: fs.readFileSync(config.httpsKeyFile),
//     cert: fs.readFileSync(config.httpsCertFile)
// }
http.createServer(app).listen(config.webPort, () => {
    console.log("Running on port: " + config.webPort);
});
// https.createServer(options,app).listen(config.webPortSecure);
