const path = require('path');
module.exports = {
    "webPort": 3000,
    "webPortSecure": 3001,
    "sessionSecret": "fklajsdlbkjLAEO31B",
    "useHTTP": true,
    "useHTTPS": false,
    "httpsKeyFile": "path/to/key/file",
    "httpsCertFile": "path/to/cert/file",
    "dbLocation": "mongodb://localhost/ctfPlatform",
    "competitionStart": -1, // use new Date(year, month (0 indexed), day, hour, minute, second) or -1
    "competitionEnd": -1, // use new Date(year, month, day, hour, minute, second) or -1
    "maxTeamSize": 4,
    "problemDir": path.join(__dirname, 'problems'),
    "backupDir": path.join(__dirname, 'backups'),
    "adminAccountNames": ["Admin", "admin"]
}
