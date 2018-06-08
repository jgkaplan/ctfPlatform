const common = require('./common.js');
const db = common.db;

module.exports.problemUnlocked = function(problem, tid){
    return new Promise((resolve, reject) => {
        // db.problems.findOne({_id: pid}).then((problem) => {
            if(problem.threshold <= 0) resolve(true);
            let problemNames = Object.keys(problem.weightmap);
            Promise.all([
                db.submissions.find({team_id: tid, correct: true}, 'problem_id'),
                db.problems.find({'name': {$in: problemNames}}, '_id name')
            ]).then(([subs, weightProblems]) => {
                let weightPids = weightProblems.map((el) => {return el._id});
                const pidMap = weightProblems.reduce((o, el) => ({ ...o, [el._id]: el.name}), {});
                let value = subs.reduce((acc, el) => {
                    if(pidMap[el.problem_id]){
                        return acc + (problem.weightmap[pidMap[el.problem_id]]);
                    }
                    return acc;
                }, 0);
                if(value >= problem.threshold) resolve(true);
                resolve(false);
            }).catch((err) => reject(err));
        // }).catch((err) => reject(err));
    });
}
