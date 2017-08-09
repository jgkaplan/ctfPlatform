var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
//var passport = require('passport');
//var LocalStrategy = require('passport-local').Strategy;
//Config file
var config = require('./apiConfig.json');
//Routes
var errorPage = require('./routes/404.js');

var app = express();

app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.resolve(__dirname, '..','web','..','templates'),
    partialsDir: path.resolve(__dirname, '..','web','..','partials')
}));
app.set('view engine', '.hbs');

app.use(bodyParser.urlencoded({extended: true}));

//Setting up the static files
app.use(express.static(path.resolve(__dirname, '..', 'web', 'static')));
app.use(express.static(path.resolve(__dirname, '..', 'web', 'images')));
app.use(express.static(path.resolve(__dirname, '..', 'web', 'scripts')));
// app.use(express.favicon(path.resolve(__dirname, '..', 'web', 'images', 'favicon.ico')));

app.get('/', (req, res) => {
    res.render('home');
});


//Start of API
// app.post('/api/login', passport.authenticate('local', {session: false}), function(req, res){
//     //only called if successful
//     res.json({ id: req.user.id, username: req.user.username });
//     // res.redirect('/team');
// });

//Error page
app.get('*', errorPage);

app.listen(config.webPort, () => {
    console.log("Started server on port " + config.webPort);
});
