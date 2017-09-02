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
var morgan = require('morgan');
var rfs = require('rotating-file-stream');
var ObjectID = require('mongodb').ObjectID;
var moment = require('moment');

//Config file
var config = require('../config.js');

var csrfProtection = csurf();

var app = express();
//Setting up the static files
app.use(express.static(path.resolve(__dirname, 'web', 'static')));
app.use('/problem-static', express.static(path.resolve(__dirname, '..', 'problem-static')));
// app.use(express.favicon(path.resolve(__dirname, '..', 'web', 'images', 'favicon.ico')));

var logDirectory = path.join(__dirname, 'log')
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
// create a rotating write stream
var accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  path: logDirectory
});
// create a write stream (in append mode)
// var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

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
passport.use(new LocalStrategy({
    passReqToCallback: true
},function(req, username, password, done){
    // return done(null, {id:'wowow',name:'Josh'});
    Users.findOne({username: username}).then((doc) => {
        if(doc == null){
            req.flash('message', {"error": 'Login Failed'});
            return done(null, false);
            // return done(null, false, {message: {"error": 'Login Failed'}});
        }
        var hash = doc.password;
        bcrypt.compare(password, hash).then((res) => {
            if(res == false){
                req.flash('message', {"error": 'Login Failed'});
                return done(null, false);
                // return done(null, false, {message: {"error": 'Login Failed'}});
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
                req.flash('message', {"error": 'User already exists'});
                return done(null, false);
                // return done(null, false, {message: {"error": 'User already exists'}});
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

//================MIDDLEWARE======================
//Passes the passport user object on to the res, allowing it to be rendered by handlebars
app.use(function(req, res, next){
    res.locals.user = req.user;
    if(req.user){
        res.locals.isAdmin = config.adminAccountNames.indexOf(req.user.username) != -1;
    }
    next();
});
//Middleware for checking if logged in
function loggedIn(req, res, next) {
    if(req.user){
        next();
    }else{
        req.flash('message', {"error": 'Login Needed To Access That Resource'});
        res.redirect('/login');
    }
}

function requireTeam(req, res, next){
    if(req.user && req.user.team_id){
        next();
    }else{
        req.flash('message', {'error': "Team needed to Access that Resource"});
        res.redirect('/team');
    }
}

function requireAdmin(req, res, next){
    if(req.user && config.adminAccountNames.indexOf(req.user.username) != -1){
        next();
    }else{
        req.flash('message', {"error": 'Admin Needed To Access That Resource'});
        res.redirect('back');
    }
}

//Only activate route when the competition is in progress
function requireCompetitionActive(req, res, next){
    if(config.competitionStart == -1 || config.competitionEnd == -1){
        next();
    }else{
        let d = Date.now();
        if(d >= config.competitionStart && d <= config.competitionEnd){
            next();
        }else{
            req.flash('message', {'error': 'Competition not in progress'});
            res.redirect('back');
        }
    }
}

//Only activate route once the competition has started
//This stays active even after the competition ends
function requireCompetitionStarted(req, res, next){
    if(config.competitionStart == -1){
        next();
    }else{
        let d = Date.now();
        if(d >= config.competitionStart){
            next();
        }else{
            req.flash('message', {'error': "Competition hasn't started yet."});
            res.redirect('back');
        }
    }
}

//================ROUTERS======================
var adminRoutes = require('./routes/admin.js')(Problems, Teams);
// var errorPage = require('./routes/404.js');
app.use('/admin', requireAdmin, csrfProtection, adminRoutes);

//================ROUTES======================
app.get('/', (req, res) => {
    res.render('index', {messages: req.flash('message')});
});
app.get('/about', (req, res) => {
    res.render('about', {messages: req.flash('message')});
});
app.get('/rules', (req, res) => {
    res.render('rules', {messages: req.flash('message')});
});
app.get('/team', csrfProtection, loggedIn, (req, res) => {
    if(req.user.team_id){
        Teams.findOne({_id: req.user.team_id}, '-teampassword').then((doc) => {
            doc.csrf = req.csrfToken();
            doc.messages = req.flash('message');
            res.render('team', doc);
        }).catch((err) => {
            res.end('Error');
        });
    }else{
        res.render('team', {csrf: req.csrfToken(), messages: req.flash('message')});
    }
});
app.get('/team/:id', loggedIn, (req, res) => {
    let team_id = req.params.id;
    //Get data about the team from Teams, Users, and Submissions collecitons
    Promise.all([
        Teams.findOne({_id: team_id}, '-teampassword'),
        Users.find({'team_id': ObjectID(team_id)}, '-password'),
        Submissions.find({'team_id': ObjectID(team_id), 'correct': true}, 'problem_id username user_id time')
    ]).then(([team,users,subs]) => {
        //Find out the problem names from the Problems collection
        Problems.find({'_id': {$in: subs.map((s) => {return ObjectID(s.problem_id);})}}, '_id name').then((problemNames) => {
            subs = subs.map((s) => {
                return {
                    time: moment(s.time).format("MMMM Do YYYY, h:mm A"),
                    name: problemNames.find((p) => {return p._id == s.problem_id}).name,
                    username: s.username,
                    user_id: s.user_id
                };
            });
            res.render('otherteam', {team: team, members: users, solves: subs, messages: req.flash('message')});
        }).catch((err) => {
            res.end('Error');
        });
    }).catch((err) => {
        res.end('Error');
    });
});
app.get('/problems', loggedIn, requireTeam, csrfProtection, requireCompetitionStarted, (req, res) => {
    Problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs, csrf: req.csrfToken(), messages: req.flash('message')});
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/scoreboard', requireCompetitionStarted, (req, res) => {
    Teams.find({}, {sort: {score: -1}, teampassword: 0}).then((docs) => {
        res.render('scoreboard', {teams: JSON.stringify(docs), messages: req.flash('message'), scripts: ['/scripts/teamlist.bundle.js']});
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/login', csrfProtection, (req, res) => {
    res.render('login', {messages: req.flash('message'), csrf: req.csrfToken()});
});
app.get('/register', csrfProtection, (req, res) => {
    res.render('register', {messages: req.flash('message'), csrf: req.csrfToken()});
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
app.post('/api/login', csrfProtection, passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/team'
}));
app.post('/api/register', csrfProtection, passport.authenticate('local-signup', {
    failureRedirect: '/register',
    successRedirect: '/team'//,
    //failureFlash: true
}));
app.post('/api/submit', csrfProtection, requireCompetitionActive, loggedIn, requireTeam, (req, res) => {
    Submissions.findOne({team_id: req.user.team_id, problem_id: req.body.problemid, correct: true}).then((doc) => {
        if(doc){
            req.flash('message', {"failure": "You already solved this problem."});
            res.redirect('/problems');
        }else{
            Problems.findOne({_id: req.body.problemid}).then((problem) => {
                let grade = require(problem.grader);
                let [correct, message] = grade(null, req.body.flag);
                Submissions.insert({
                    team_id: req.user.team_id,
                    user_id: req.user._id,
                    username: req.user.username,
                    problem_id: req.body.problemid,
                    correct: correct,
                    attempt: req.body.flag,
                    time: Date.now()
                });
                if(correct){
                    req.flash('message', {'success' : message});
                    Teams.update({_id: req.user.team_id}, {$inc: {score: problem.score}});
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
                            Users.findOneAndUpdate({_id: req.user._id}, {$set: {team_id: doc._id}});
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
                        Users.findOneAndUpdate({_id: req.user._id}, {$set: {team_id: team._id}});
                        res.redirect('/team');
                    });
                }
            });
        }
    }
});
app.post('/api/leaveteam', csrfProtection, loggedIn, (req, res) => {
    if(req.user.team_id){
        Teams.findOne({_id: req.user.team_id}).then((doc) => {
            doc.numberOfMembers -= 1;
            if(doc.numberOfMembers < 1){
                Teams.remove({_id: req.user.team_id});
            }else{
                Teams.findOneAndUpdate({_id: req.user.team_id}, doc);
            }
        });
        Users.findOneAndUpdate({_id: req.user._id}, {$unset: {team_id: 1}});
    }
    res.redirect('/team');
});


//================LISTEN======================

if(config.useHTTP){
    http.createServer(app).listen(config.webPort, () => {
        console.log("Running on port: " + config.webPort);
    });
}
if(config.useHTTPS){
    const options = {
        key: fs.readFileSync(config.httpsKeyFile),
        cert: fs.readFileSync(config.httpsCertFile)
    }
    https.createServer(options,app).listen(config.webPortSecure);
}
