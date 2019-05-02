exports.fromString = function(str) {

    return new Date(Date.parse(str+" 00:00:00Z"));

};