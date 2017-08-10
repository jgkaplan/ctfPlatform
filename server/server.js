var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
//Config file
var config = require('./apiConfig.json');
//Routes
// var errorPage = require('./routes/404.js');

var app = express();
//Setting up the static files
app.use(express.static(path.resolve(__dirname, '..', 'web', 'static')));
// app.use(express.favicon(path.resolve(__dirname, '..', 'web', 'images', 'favicon.ico')));
//================PASSPORT=====================
//Passes the passport user object on to the res, allowing it to be rendered by handlebars
app.use(function(req, res, next){
    res.locals.user = req.user;
    next();
});
//================EXPRESS======================
app.use(bodyParser.urlencoded({extended: true}));
//Setting up handlebars as the templating engine
app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.resolve(__dirname, '..','web','layouts'),
    partialsDir: path.resolve(__dirname, '..','web','partials')
}));
app.set('view engine', '.hbs');
app.set('views', path.resolve(__dirname, '..', 'web'));

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
app.get('/team', (req, res) => {
    res.render('team');
});
app.get('/problems', (req, res) => {
    res.render('problems');
});
app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/register', (req, res) => {
    res.render('register');
});
app.get('/logout', (req, res) => {

});
//Error page
app.get('*', (req, res, next) => {
    res.render('404');
});

//Start of API
app.post('/api/login', passport.authenticate('local', {session: false}), function(req, res){
    //only called if successful
    res.json({ id: req.user.id, username: req.user.username });
    res.redirect('/team');
});


//================LISTEN======================
app.listen(config.webPort, () => {
    console.log("Started server on port " + config.webPort);
});
