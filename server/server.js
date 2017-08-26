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
var csurf = require('csurf');

//Config file
var config = require('../config.json');

var csrfProtection = csurf();

var app = express();
//Setting up the static files
app.use(express.static(path.resolve(__dirname, 'web', 'static')));
app.use('/problem-static', express.static(path.resolve(__dirname, '..', 'problem-static')));
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
    layoutsDir: path.resolve(__dirname,'web','layouts'),
    partialsDir: path.resolve(__dirname,'web','partials')
}));
app.set('view engine', '.hbs');
app.set('views', path.resolve(__dirname, 'web'));
//================PASSPORT=====================
//Passes the passport user object on to the res, allowing it to be rendered by handlebars
app.use(function(req, res, next){
    res.locals.user = req.user;
    // res.locals.error = req.flash('error');
    // res.locals.success = req.flash('success');
    // res.locals.failure = req.flash('failure');
    res.locals.messages = req.flash('message');
    next();
});

passport.use(new LocalStrategy(function(username, password, done){
    // return done(null, {id:'wowow',name:'Josh'});
    Users.findOne({username: username}).then((doc) => {
        if(doc == null){
            return done(null, false, {message: {"error": 'Login Failed'}});
        }
        var hash = doc.password;
        bcrypt.compare(password, hash).then((res) => {
            if(res == false){
                return done(null, false, {message: {"error": 'Login Failed'}});
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
                return done(null, false, {message: {"error": 'User already exists'}});
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

//================MIDDLEWEAR======================
//Middlewear for checking if logged in
function loggedIn(req, res, next) {
    if(req.user){
        next();
    }else{
        req.flash('message', {"error": 'Login Needed To Access That Resource'});
        res.redirect('/login');
    }
}

function requireAdmin(req, res, next){
    if(req.user && config.adminAccountNames.indexOf(req.user.username) != -1){
        next();
    }else{
        req.flash('message', {"error": 'Admin Needed To Access That Resource'});
        res.end('Invalid Access');
    }
}

//================ROUTERS======================
var adminRoutes = require('./routes/admin.js')(Problems);
// var errorPage = require('./routes/404.js');
app.use('/admin', requireAdmin, adminRoutes);

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
app.get('/team', csrfProtection, loggedIn, (req, res) => {
    if(req.user.teamid){
        Teams.findOne({_id: req.user.teamid}, '-teampassword').then((doc) => {
            doc.csrf = req.csrfToken();
            res.render('team', doc);
        }).catch((err) => {
            res.end('Error');
        });
    }else{
        res.render('team', {csrf: req.csrfToken()});
    }
});
app.get('/team/:id', loggedIn, (req, res) => {
    let teamid = req.params.id;
    Promise.all([
        Teams.findOne({_id: teamid}, '-teampassword'),
        Users.find({'teamid': teamid}, '-password'),
        Submissions.find({'teamid': teamid, 'correct': true})
    ]).spread((team, users, subs) => {
        res.render('otherteam', {team: team, members: users, solves: subs});
    }).catch((err) => {
        res.end('Error');
    });
});
app.get('/problems', loggedIn, csrfProtection, (req, res) => {
    Problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs, csrf: req.csrfToken()});
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/scoreboard', (req, res) => {
    Teams.find({}, {sort: {score: -1}, teampassword: 0}).then((docs) => {
        res.render('scoreboard', {teams: JSON.stringify(docs), scripts: ['/scripts/teamlist.bundle.js']});
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/login', csrfProtection, (req, res) => {
    res.render('login', {csrf: req.csrfToken()});
});
app.get('/register', csrfProtection, (req, res) => {
    res.render('register', {csrf: req.csrfToken()});
});
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});
app.get('/test', (req, res) => {
    req.flash('message', {"error": "hi"});
    req.flash('message', {"success": "bye"});
    // console.log(req.flash("message"));
    res.render('404');
});
//Error page
app.get('*', (req, res, next) => {
    res.render('404');
});

//Start of API
app.post('/api/login', csrfProtection, passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/team',
    failureFlash: true
}));
app.post('/api/register', csrfProtection, passport.authenticate('local-signup', {
    failureRedirect: '/register',
    successRedirect: '/team',
    failureFlash: true
}));
app.post('/api/submit', csrfProtection, loggedIn, (req, res) => {
    Submissions.findOne({team: req.user.teamid, problem: req.body.problemid, correct: true}).then((doc) => {
        if(doc){
            req.flash('message', {"failure": "You already solved this problem."});
            res.redirect('/problems');
        }else{
            Problems.findOne({_id: req.body.problemid}).then((problem) => {
                let grade = require(problem.grader);
                let [correct, message] = grade(null, req.body.flag);
                Submissions.insert({team: req.user.teamid, problem: req.body.problemid, correct: correct, attempt: req.body.flag, time: Date.now()});
                Teams.update({_id: req.user.teamid}, {$inc: {score: problem.score}});
                if(correct){
                    req.flash('message', {'success' : message});
                }else{
                    req.flash('message', {'failure' : message});
                }
                res.redirect('/problems');
            }).catch((err) => {
                req.flash('message', {"error": 'Error Submitting Problems'});
                res.redirect('/problems');
            });
        }
    });
});

app.post('/api/jointeam', csrfProtection, loggedIn, (req, res) => {
    if(!req.body.teamname || !req.body.teampassword){
        req.flash('message', {"error": "Invalid teamname/password."});
        res.redirect('/team');
    }else{
        if(req.body.joinTeam){
            //Join existing team
            Teams.findOne({teamname: req.body.teamname}).then((doc) => {
                if(doc == null){
                    req.flash('message', {"error": "Team doesn't exist."});
                    res.redirect('/team');
                }else{
                    if(doc.numberOfMembers < config.maxTeamSize){
                        if(doc.teampassword == req.body.teampassword){
                            Users.findOneAndUpdate({_id: req.user._id}, {$set: {teamid: doc._id}});
                            Teams.findOneAndUpdate({_id: doc._id}, {$set: {numberOfMembers: doc.numberOfMembers + 1}});
                            res.redirect('/team');
                        }else{
                            req.flash('message', {"error": "Invalid team password."});
                            res.redirect('/team');
                        }
                    }else{
                        req.flash('message', {"error": "Team is full."});
                        res.redirect('/team');
                    }
                }
            });
        }else{
            //Create team
            Teams.findOne({teamname: req.body.teamname}).then((doc) => {
                if(doc != null){
                    req.flash('message', {"error": "Team already exists."});
                    res.redirect('/team');
                }else{
                    var newTeam = {
                        teamname: req.body.teamname,
                        teampassword: req.body.teampassword,
                        numberOfMembers: 1,
                        score: 0
                    }
                    Teams.insert(newTeam, function(err, team){
                        Users.findOneAndUpdate({_id: req.user._id}, {$set: {teamid: team._id}});
                        res.redirect('/team');
                    });
                }
            });
        }
    }
});
app.post('/api/leaveteam', csrfProtection, loggedIn, (req, res) => {
    if(req.user.teamid){
        Teams.findOne({_id: req.user.teamid}).then((doc) => {
            doc.numberOfMembers -= 1;
            if(doc.numberOfMembers < 1){
                Teams.remove({_id: req.user.teamid});
            }else{
                Teams.findOneAndUpdate({_id: req.user.teamid}, doc);
            }
        });
        Users.findOneAndUpdate({_id: req.user._id}, {$unset: {teamid: 1}});
    }
    res.redirect('/team');
});


//================LISTEN======================
// const options = {
//     key: fs.readFileSync(config.httpsKeyFile),
//     cert: fs.readFileSync(config.httpsCertFile)
// }
http.createServer(app).listen(config.webPort, () => {
    console.log("Running on port: " + config.webPort);
});
// https.createServer(options,app).listen(config.webPortSecure);
