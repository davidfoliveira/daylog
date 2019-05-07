var
    conf        = require('../../conf/daylog.conf');


exports.getUsers = function() {
    var
        users = Object.keys(conf.auths).sort(),
        results = [];

    users.forEach(function(user) {
        results.push({
            Id: user,
            Name: conf.names[user] || user
        });
    });

    return results;
};
