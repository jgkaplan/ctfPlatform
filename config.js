const path = require('path');
module.exports = {
    "webPort": 3000,
    "webPortSecure": 3001,
    "sessionSecret": "fklajsdlbkjLAEO31B", /* change me */
    "useHTTPS": true,
    "httpsKeyFile": path.join(__dirname,"server","localhost-privkey.pem"), /* path/to/key/file */
    "httpsCertFile": path.join(__dirname,"server","localhost-cert.pem"), /* path/to/cert/file */
    "dbLocation": "mongodb://localhost/ctfPlatform",
    "competitionStart": new Date(2018, 4, 29, 20, 0, 0).valueOf(), // use new Date(year, month (0 indexed), day, hour, minute, second) or -1
    "competitionEnd": -1, // use new Date(year, month, day, hour, minute, second) or -1
    "maxTeamSize": 4,
    "numTeamsOnGraph": 5, //top [n] teams displayed on the scoreboard graph. -1 for all teams
    "problemDir": path.join(__dirname, 'problems'),
    "backupDir": path.join(__dirname, 'backups'),
    "easterEggFile": path.join(__dirname, 'easterEggs.json'),
    "adminAccountNames": ["Admin", "admin"],
    "restrictedNames": ["admin","chc_"],
    "easterEggUrl": "eastereggs"
}
