const common = require('../common.js');
const db = common.db;
const passport = common.passport;
const middleware = common.middleware;
const config = common.config;
const express = require('express');
const router = express.Router();

router.post('/login', middleware.csrfProtection, passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/team'
}));
router.post('/register', middleware.csrfProtection, passport.authenticate('local-signup', {
    failureRedirect: '/register',
    successRedirect: '/team'//,
    //failureFlash: true
}));
router.post('/submit', middleware.csrfProtection, middleware.requireCompetitionActive, middleware.loggedIn, middleware.requireTeam, (req, res) => {
    db.submissions.findOne({team_id: req.user.team_id, problem_id: req.body.problemid, correct: true}).then((doc) => {
        if(doc){
            req.flash('message', {"failure": "You already solved this problem."});
            res.redirect('/problems');
        }else{
            db.problems.findOne({_id: req.body.problemid}).then((problem) => {
                let grade = require(problem.grader);
                let [correct, message] = grade(null, req.body.flag);
                db.submissions.insert({
                    team_id: req.user.team_id,
                    user_id: req.user._id,
                    username: req.user.username,
                    problem_id: req.body.problemid,
                    correct: correct,
                    attempt: req.body.flag,
                    points: problem.score,
                    time: Date.now()
                });
                if(correct){
                    req.flash('message', {'success' : message});
                    db.teams.update({_id: req.user.team_id}, {$inc: {score: problem.score}, $set: {submissionTime: Date.now()}});
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
router.post('/eggs', middleware.csrfProtection, middleware.requireCompetitionActive, middleware.loggedIn, middleware.requireTeam, (req, res) => {
    db.eastereggsubmissions.findOne({team_id: req.user.team_id, egg: req.body.egg, correct: true}).then((doc) => {
        if(doc){
            req.flash('message', {"failure": "You already found this easter egg."});
            res.redirect(`/${config.easterEggUrl}`);
        }else{
            db.eastereggs.findOne({egg: req.body.egg}).then((doc) => {
                let correct = false;
                if(doc){
                    req.flash('message', {"success": doc.msg});
                    correct = true;
                }else{
                    req.flash('message', {"failure": "Invalid easter egg"});
                }
                db.eastereggsubmissions.insert({
                    egg: req.body.egg,
                    team_id: req.user.team_id,
                    correct: correct,
                    time: Date.now()
                });
                res.redirect(`/${config.easterEggUrl}`);
            });
        }
    });
});
router.get('/teams', (req, res) => {
    db.teams.find({"eligible": true}, {sort: {score:-1, submissionTime: 1}, teampassword: 0, numberOfMembers: 0}).then((docs) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            teams: docs
        }));
    });
});
const summer = (acc, el) => {
    // acc.push({
    //     points: el.points + acc[acc.length - 1].points,
    //     time: el.time
    // });
    acc.push([
        el.time, //time
        el.points + acc[acc.length-1][1] //points
    ])
    return acc;
};
router.get('/graph', (req, res) => {
    db.teams.find({"eligible": true},
     (config.numTeamsOnGraph > 0 ? {limit: config.numTeamsOnGraph, sort: {score:-1, submissionTime: 1}} : {sort: {score:-1, submissionTime: 1}})
    ).then((docs) => {
        Promise.all(
            docs.map(team => {
                return db.submissions.find({"team_id": team._id, "correct": true}, {sort: {submissionTime: 1}, fields: ['time', 'points']})
            })
        ).then((submissions) => {
            let t = Math.min(config.competitionEnd, Date.now());
            // let data = docs.map((doc, i) => {
            //     let toReturn = {
            //         cols: [
            //             {label: 'Time', type: 'datetime'},
            //             {label: doc.teamname, type: 'number'}
            //         ],
            //         rows: submissions[i].reduce(summer, [[config.competitionStart, 0]]).map((row) => {
            //             return {
            //                 c: row.map((cell) => {
            //                     return {v: cell};
            //                 })
            //             };
            //         })
            //             // {points:0,time:config.competitionStart}])
            //     };
            //     toReturn.rows.push({
            //         c: [{v: t}, {v: doc.score}]
            //     });
            //     return toReturn;
            // });
            let labels = []
            let data = docs.map((doc, i) => {
                let toReturn =  {
                    label: doc.teamname,
                    steppedLine: true,
                    data: submissions[i].reduce(summer, [[config.competitionStart, 0]]).map((row) => {
                        return {x: row[0], y: row[1]};
                    })
                };
                toReturn.data.push({x: t, y: doc.score});
                return toReturn;
            });
            res.setHeader('Content-Type', 'application/json');
            // res.end(JSON.stringify(data));
            res.end(JSON.stringify({datasets: data}));
        });
    });
});
router.post('/jointeam', middleware.csrfProtection, middleware.loggedIn, (req, res) => {
    if(!req.body.teamname || !req.body.teampassword){
        req.flash('message', {"error": "Invalid teamname/password."});
        res.redirect('/team');
    }else{
        if(req.body.joinTeam){
            //Join existing team
            db.teams.findOne({teamname: req.body.teamname}).then((doc) => {
                if(doc == null){
                    req.flash('message', {"error": "Team doesn't exist."});
                    res.redirect('/team');
                }else{
                    if(doc.numberOfMembers < config.maxTeamSize){
                        if(doc.teampassword == req.body.teampassword){
                            db.users.findOneAndUpdate({_id: req.user._id}, {$set: {team_id: doc._id}});
                            db.teams.findOneAndUpdate({_id: doc._id}, {$set: {numberOfMembers: doc.numberOfMembers + 1}});
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
            db.teams.findOne({teamname: req.body.teamname}).then((doc) => {
                if(doc != null){
                    req.flash('message', {"error": "Team already exists."});
                    res.redirect('/team');
                }else{
                    var newTeam = {
                        teamname: req.body.teamname,
                        teampassword: req.body.teampassword,
                        school: req.body.school,
                        numberOfMembers: 1,
                        eligible: true,
                        score: 0
                    }
                    db.teams.insert(newTeam, function(err, team){
                        db.users.findOneAndUpdate({_id: req.user._id}, {$set: {team_id: team._id}});
                        res.redirect('/team');
                    });
                }
            });
        }
    }
});
router.post('/leaveteam', middleware.csrfProtection, middleware.loggedIn, (req, res) => {
    if(req.user.team_id){
        db.teams.findOne({_id: req.user.team_id}).then((doc) => {
            doc.numberOfMembers -= 1;
            if(doc.numberOfMembers < 1){
                db.teams.remove({_id: req.user.team_id});
            }else{
                db.teams.findOneAndUpdate({_id: req.user.team_id}, doc);
            }
        });
        db.users.findOneAndUpdate({_id: req.user._id}, {$unset: {team_id: 1}});
    }
    res.redirect('/team');
});

module.exports = router;
