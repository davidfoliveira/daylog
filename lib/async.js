exports.ifThen = function(cond, a, b) {
    cond ? a(b) : b();
};
