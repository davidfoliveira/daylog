// Logging
exports.log = {

    enabled: true,
    byPrefix: {
        'db': false,
        'orm': false
    }

};

// Database configuration
exports.db = {

    // Database instances
    instances: {
        'default': {
            type: "SQLite3",
            path: "var/daylog.db",
            opts: { }
        }
    }

};
