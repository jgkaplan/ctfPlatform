var express = require('express');
var router = express.Router();
var Problems;

router.get('/', (req, res) => {
    res.render('admin');
});

router.get('/problems', (req, res, next) => {
    Problems.find({}, 'name score category description hint _id').then((docs) => {
        res.render('problems', {problems: docs});
    }).catch((err) => {
        res.end("Error");
    });
});
// router.get('/api/rescore', (req, res, next) => {
//     //Rebuild the teams scores from the submissions
// });

module.exports = function(connection){
    Problems = connection;
    return router;
};
