#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:precise');
var nconf = require('nconf');

var walk = require('../lib/walk');
var parse = require('../lib/parse');
var mongo = require('../lib/mongo');

nconf.argv().env().file({ file: 'config/collector.json' });

const targetId = nconf.get('id');
if(!targetId) {
    console.log("Required id as parameter");
    return;
}

const repeat = nconf.get('repeat') || false;
const htmlfilter = repeat ?
    { id: targetId } :
    { id: targetId, processed: { $exists: false } };

return parse
    .parseHTML(htmlfilter, repeat)
    .tap(function(results) {
        debug("completed: %s", JSON.stringify(results, undefined, 2));
    });
