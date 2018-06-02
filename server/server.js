const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const session = require('express-session');
// const https = require('https');
// const http = require('http');
const flash = require('express-flash');
const MongoStore = require('connect-mongo')(session);
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const ObjectID = require('mongodb').ObjectID;
const moment = require('moment');
// const http2 = require('http2');
const spdy = require('spdy');

const common = require('./common.js');
const config = common.config;
const passport = common.passport;
const middleware = common.middleware;
const db = common.db;

let app = express();

//Setting up the static files
app.use(express.static(path.resolve(__dirname, 'web', 'static')));
app.use('/problem-static', express.static(path.resolve(__dirname, '..', 'problem-static')));
// app.use(express.favicon(path.resolve(__dirname, '..', 'web', 'images', 'favicon.ico')));

const logDirectory = path.join(__dirname, 'log')
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
// create a rotating write stream
const accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  path: logDirectory
});
// create a write stream (in append mode)
// var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

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
app.set('views', path.resolve(__dirname, 'web', 'views'));

//Passes the passport user object on to the res, allowing it to be rendered by handlebars
app.use(function(req, res, next){
    res.locals.user = req.user;
    if(req.user){
        res.locals.isAdmin = config.adminAccountNames.indexOf(req.user.username) != -1;
    }
    next();
});
//================ROUTERS======================
const adminRoutes = require('./routes/admin.js');
const apiRoutes = require('./routes/api.js');
// var errorPage = require('./routes/404.js');
app.use('/admin', middleware.requireAdmin, middleware.csrfProtection, adminRoutes);
app.use('/api', middleware.csrfProtection, apiRoutes);
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
app.get('/chat', (req, res) => {
    res.render('chat', {messages: req.flash('message')});
});
app.get('/learn', (req, res) => {
    res.render('learn', {messages: req.flash('message')});
});
app.get('/faq', (req, res) => {
    res.render('faq', {messages: req.flash('message')});
});
app.get('/team', middleware.csrfProtection, middleware.loggedIn, (req, res) => {
    if(req.user.team_id){
        Promise.all([
            db.users.findOne({_id: req.user.team_id}, '-teampassword'),
            db.eastereggsubmissions.count({team_id: ObjectID(req.user.team_id), correct: true})
        ]).then(([team, numEggs]) => {
            team.csrf = req.csrfToken();
            team.messages = req.flash('message');
            team.displayEggs = numEggs > 0;
            team.eggCount = numEggs;
            res.render('team', team);
        }).catch((err) => {
            res.end('Error');
        });
    }else{
        res.render('team', {
            csrf: req.csrfToken(),
            messages: req.flash('message')
        });
    }
});
app.get('/team/:id', middleware.loggedIn, (req, res) => {
    let team_id = req.params.id;
    //Get data about the team from Teams, Users, and Submissions collecitons
    Promise.all([
        db.users.findOne({_id: team_id}, '-teampassword'),
        db.users.find({'team_id': ObjectID(team_id)}, '-password'),
        db.submissions.find({'team_id': ObjectID(team_id), 'correct': true}, 'problem_id username user_id time')
    ]).then(([team,users,subs,eggs]) => {
        //Find out the problem names from the Problems collection
        db.problems.find({'_id': {$in: subs.map((s) => {return ObjectID(s.problem_id);})}}, '_id name').then((problemNames) => {
            subs = subs.map((s) => {
                return {
                    time: moment(s.time).format("MMMM Do YYYY, h:mm A"),
                    name: problemNames.find((p) => {return p._id == s.problem_id}).name,
                    username: s.username,
                    user_id: s.user_id
                };
            });
            res.render('otherteam', {
                team: team,
                members: users,
                solves: subs,
                messages: req.flash('message')
            });
        }).catch((err) => {
            res.end('Error');
        });
    }).catch((err) => {
        res.end('Error');
    });
});
app.get('/problems', middleware.loggedIn, middleware.requireTeam, middleware.csrfProtection, middleware.requireCompetitionStarted, (req, res) => {
    db.problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs, csrf: req.csrfToken(), messages: req.flash('message')});
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/scoreboard', middleware.requireCompetitionStarted, (req, res) => {
    db.teams.find({"eligible": true}, {sort: {score: -1, submissionTime: 1}, teampassword: 0, numberOfMembers: 0}).then((docs) => {
        res.render('scoreboard', {
            teams: JSON.stringify(docs),
            messages: req.flash('message'),
            scripts: [
                '/scripts/jquery.min.js',
                'https://www.gstatic.com/charts/loader.js',
                '/scripts/graph.js',
                '/scripts/teamlist.bundle.js'
            ]
        });
    }).catch((err) => {
        res.end("Error");
    });
});
app.get('/login', middleware.csrfProtection, (req, res) => {
    res.render('login', {messages: req.flash('message'), csrf: req.csrfToken()});
});
app.get('/register', middleware.csrfProtection, (req, res) => {
    res.render('register', {messages: req.flash('message'), csrf: req.csrfToken()});
});
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});
app.get(`/${config.easterEggUrl}`, middleware.csrfProtection, (req, res) => {
    res.render("eastereggs", {csrf: req.csrfToken(), messages: req.flash('message')});
});

//Error page
app.get('*', (req, res, next) => {
    res.render('404');
});

//================LISTEN======================

// const server = config.useHTTPS ? http2.createSecureServer({
//         key: fs.readFileSync(config.httpsKeyFile),
//         cert: fs.readFileSync(config.httpsCertFile)
//     },app)
//     : http2.createServer(app);

// if(config.useHTTPS){
//     server.listen(config.webPortSecure);
// }else{
//     server.listen(config.webPort);
// }


// if(config.useHTTP){
//     http.createServer(app).listen(config.webPort, () => {
//         console.log("Running on port: " + config.webPort);
//     });
// }
if(config.useHTTPS){
    const options = {
        key: fs.readFileSync(config.httpsKeyFile),
        cert: fs.readFileSync(config.httpsCertFile)
    }
    // https.createServer(options,app).listen(config.webPortSecure);
    spdy.createServer(options, app).listen(config.webPortSecure);
}
