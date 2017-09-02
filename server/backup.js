var config = require('../config.js');
var monk = require('monk')(config.dbLocation);
var fs = require('fs');
var path = require('path');

var Problems = monk.get('problems');
var Teams = monk.get('teams');
var Users = monk.get('users');
var Submissions = monk.get('submissions');

// function mkdirUnlessExists(dir){
//     if(fs.existsSync(dir)) return;
//     fs.mkdirSync(dir);
// }
//
// //source is directory
// //location is directory
// function copyDirRecursive(source, location){
//     mkdirUnlessExists(location);
//     fs.readdir(source, function(err, files){
//         if(err) throw err;
//         for(file of files){
//             let newSource = path.join(source, file);
//             if(fs.lstatSync(newSource).isDirectory()){
//                 copyDirRecursive(newSource, path.join(location, file));
//             }else{
//                 fs.writeFile(path.join(location, path.basename(newSource)), fs.readFileSync(newSource));
//             }
//         }
//     });
// }
