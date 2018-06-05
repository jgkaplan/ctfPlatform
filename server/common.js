// Config file
const config = require('../config.js');
module.exports.config = config;

//================DATABASE======================
const db = require('monk')(config.dbLocation);
const Users = db.get('users');
const Teams = db.get('teams');
const Problems = db.get('problems');
const Submissions = db.get('submissions');
const EasterEggs = db.get('eggs');
const EasterEggSubmissions = db.get('eggsubmissions');

module.exports.db = {
    users: Users,
    teams: Teams,
    problems: Problems,
    submissions: Submissions,
    eastereggs: EasterEggs,
    eastereggsubmissions: EasterEggSubmissions
}

//================PASSPORT=====================
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
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
        if(config.restrictedNames.some((prefix) => {return username.toLowerCase().startsWith(prefix)})){
            req.flash('message', {'error': 'Restricted username'});
            return done(null, false);
        }
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

module.exports.passport = passport;

//================MIDDLEWARE======================
module.exports.middleware = {}
//Middleware for checking if logged in
module.exports.middleware.loggedIn = function(req, res, next) {
    if(req.user){
        next();
    }else{
        req.flash('message', {"error": 'Login Needed To Access That Resource'});
        res.redirect('/login');
    }
}

module.exports.middleware.requireTeam = function(req, res, next){
    if(req.user && req.user.team_id){
        next();
    }else{
        req.flash('message', {'error': "Team needed to Access that Resource"});
        res.redirect('/team');
    }
}

module.exports.middleware.requireAdmin = function(req, res, next){
    if(req.user && config.adminAccountNames.includes(req.user.username)){
        next();
    }else{
        req.flash('message', {"error": 'Admin Needed To Access That Resource'});
        res.redirect('back');
    }
}

//Only activate route when the competition is in progress
module.exports.middleware.requireCompetitionActive = function(req, res, next){
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
module.exports.middleware.requireCompetitionStarted = function(req, res, next){
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

const csurf = require('csurf');
const csrfProtection = csurf();
module.exports.middleware.csrfProtection = csrfProtection;
