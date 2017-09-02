var express = require('express');
var router = express.Router();
var Problems, Teams;

router.get('/', (req, res) => {
    res.render('admin', {messages: req.flash('message')});
});

router.get('/problems', (req, res, next) => {
    Problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs, csrf: req.csrfToken(), messages: req.flash('message')});
    }).catch((err) => {
        res.end("Error");
    });
});

router.get('/scoreboard', (req, res) => {
    Teams.find({}, {sort: {score: -1}, teampassword: 0}).then((docs) => {
        res.render('scoreboard', {teams: JSON.stringify(docs), messages: req.flash('message'), scripts: ['/scripts/teamlist.bundle.js']});
    }).catch((err) => {
        res.end("Error");
    });
});
// router.get('/api/rescore', (req, res, next) => {
//     //Rebuild the teams scores from the submissions
// });
module.exports = function(prob, team){
    Problems = prob;
    Teams = team;
    return router;
};
