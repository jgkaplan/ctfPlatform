var config = require('../config.js');
var monk = require('monk')(config.dbLocation);

var EasterEggDB = monk.get('eggs');
EasterEggDB.remove({});

let eggs = require(config.easterEggFile).eggs;
eggs = eggs.map(egg => {
    if(!egg.hasOwnProperty("msg")){
        egg.msg="You found an easter egg!"
    };return egg;
});
EasterEggDB.insert(eggs).then(() => {monk.close();});
