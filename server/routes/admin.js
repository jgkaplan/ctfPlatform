const express = require('express');
const router = express.Router();
const common = require('../common.js');
const db = common.db;
const passport = common.passport;
const middleware = common.middleware;

router.get('/', (req, res) => {
    res.render('admin', {messages: req.flash('message')});
});

router.get('/problems', (req, res, next) => {
    db.problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs, csrf: req.csrfToken(), messages: req.flash('message')});
    }).catch((err) => {
        res.end("Error");
    });
});

router.get('/scoreboard', (req, res) => {
    db.teams.find({}, {sort: {score: -1}, teampassword: 0}).then((docs) => {
        res.render('scoreboard', {teams: JSON.stringify(docs), messages: req.flash('message'), scripts: ['/scripts/teamlist.bundle.js']});
    }).catch((err) => {
        res.end("Error");
    });
});
// router.get('/api/rescore', (req, res, next) => {
//     //Rebuild the teams scores from the submissions
// });
router.post('/api/recalculatePoints', (req, res) => {
    db.submissions.find({correct: true}).then((subs) => {
        let newScores = {};
        for(let sub of subs){
            let score = newScores[sub.team_id] || 0;
            newScores[sub.team_id] = score + sub.points;
        }
        for(let team in newScores){
            db.teams.update({id: team}, {$set: {score: newScores[team]}});
        }
    });
    res.status(200);
    res.end('Ok');
});
module.exports = router;
