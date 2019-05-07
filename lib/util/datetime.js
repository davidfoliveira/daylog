exports.fromString = function(str) {

    if (str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[T ](\d{1,2}(?::\d{1,2}(?::\d{1,2}(?:.\d{1,4})?)?)?))?/)) {
        var date = RegExp.$1+"/"+RegExp.$2+"/"+RegExp.$3;
        var time = RegExp.$4 || "00:00:00";
        return new Date(Date.parse(date+" "+time+"Z"));
    }

    return null;
};

exports.now = function() {

    var now = new Date();
    now.setHours(now.getHours() + 2);
    return now;

};