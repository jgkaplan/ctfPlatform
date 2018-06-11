var config = require('../config.js');
var monk = require('monk')(config.dbLocation);
var fs = require('fs');
var path = require('path');

var Problems = monk.get('problems');
// Problems.remove({});
fs.readdir(config.problemDir, function(err, files){
    if(err) throw err;
    files = files.filter(function(file){
        return fs.lstatSync(path.join(config.problemDir,file)).isDirectory();
    }).map(function(file){
        let fullpath = path.join(config.problemDir, file);
        if(fs.existsSync(path.join(fullpath, 'static'))){
            copyDirRecursive(path.join(fullpath, 'static'), path.resolve(__dirname, '..', 'problem-static', file));
        }
        let problem;
        problem = require(path.join(fullpath,'problem.json'));
        problem.grader = path.join(fullpath, problem.grader);
        return problem;
    });
    Promise.all(
        files.map((p) => {
            return Problems.findOne({name: p.name}).then((prob) => {
                if(prob){
                    return Problems.update({name: prob.name}, p);
                }else{
                    return Problems.insert(p);
                }
            })
        })
    ).then((outers) => Promise.all(outers)).then(() => monk.close());
    // Promise.all(
    //     files.map((p) => Problems.findOne({name: p.name}))
    // ).then((probs) => {
    //     return Promise.all(
    //         probs.map((prob, i) => {
    //             if(prob){
    //                 return Problems.update({name: prob.name}, files[i]);
    //             }else{
    //                 return Problems.insert(files[i]);
    //             }
    //         })
    //     );
    // }).then(() => monk.close());
    // for (let p of files) {
    //     Problems.find({name: p.name}).then((prob) => {
    //
    //     })
    // } // close db. should use map and promise.alL?
    // Problems.insert(files).then(function(){
    //     monk.close();
    // });
});

function mkdirUnlessExists(dir){
    if(fs.existsSync(dir)) return;
    fs.mkdirSync(dir);
}

//source is directory
//location is directory
function copyDirRecursive(source, location){
    mkdirUnlessExists(location);
    fs.readdir(source, function(err, files){
        if(err) throw err;
        for(file of files){
            let newSource = path.join(source, file);
            if(fs.lstatSync(newSource).isDirectory()){
                copyDirRecursive(newSource, path.join(location, file));
            }else{
                fs.writeFile(path.join(location, path.basename(newSource)), fs.readFileSync(newSource), (err) => {
                  if (err) throw err;
                });
            }
        }
    });
}
