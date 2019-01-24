const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('lib:rss');
const nconf = require('nconf');
const RSS = require('rss');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
 
const mongo = require('./mongo');
const utils = require('./utils');

const CR = '<![CDATA[<br/>]]>';
const fbtrexRSSplaceholder = "Welcome, you should wait 10 minutes circa to get this newsfeed populated, now the subscription is taken in account. " + CR + "fbTREX would stop to populate this feed if no request is seen in 5 days. updates would be automatic. You can find more specifics about the RSS settings in [here todo doc]";
const fbtrexRSSdescription = "This newsfeed is generated by the distributed observation of Facebook posts, collected with https://facebook.tracking.exposed browser extension; The posts are processed with a technical proceduce called semantic analysis, it extract the core meanings of the post linkable to existing wikipedia pages";
const fbtrexRSSproblem = "We can't provide a newsfeed on the information you requested. This is, normally, due because you look for a keyword which has not been seen recently. We permit to generate RSS only about voices which are part of wikipedia because this ensure we do not enable any kind of stalking. (editing wikipedia would not work). You can really use only label which are meaningful encyclopedic voices.";
const QUEUED_STRING = "queued";

/*
 * logic:
 * compute a feedId using the hash function
 * check if the query exists in mongodb://facebook/feeds
 *    if yes, check if exist an .xml file ready 
 *       if yes, return all the information
 *    if not, 
 *       add at the feed the query combo 
 *       raise exception error.message = 'queued'
 * this logic is not describing the validation made with 'labels' 
 */

function validateFeed(labels) {
    /* please remind, if semantics has some expire configure,
     * should be at at least 30 days ? */
    return Promise.map(labels, function(l) {
        return mongo
            .count(nconf.get('schema').semantics, { label: l })
            .then(function(amount) {
                if(!amount)
                    throw new Error("invalid label request");
            });
    });
}

function rssRetriveOrCreate(labels, feedId) {
    return mongo
        .readOne(nconf.get('schema').feeds, { id: feedId, created: true })
        .then(function(feed) {
            /* label are valid combo, but do not exist */
            if(!feed || !feed.xmlpath) {
                debug("Registering feed %s for %j", feedId, labels);
                return mongo
                    .writeOne(nconf.get('schema').feeds, {
                        id: feedId,
                        insertAt: new Date(),
                        labels: labels,
                        created: false
                    })
                    .catch(function(error) {
                        if(error.code === 11000) {
                            debug("The feed %s already existing but not yet render", error.message);
                            throw new Error(QUEUED_STRING);
                        }
                        debug("Unexpected error [%s] forwarding up", error);
                        throw error;
                    })
                    .then(function() {
                        debug("The feed is queued now");
                        throw new Error(QUEUED_STRING);
                    });
            } else {
                debug("Labels %j follow on: %j", labels, feed.xmlpath);
                return feed;
            }
        });
};

function feeds(req) {

    if(!_.endsWith(req.params.query, '.xml'))
        return { text: 'expected [*.xml]' };

    const labels = req.params.query.replace(/\.xml$/, '').split('+').sort();
    debug("Requested RSS feed by [%s]", labels.join(', '));
    const feedId = utils.hashList(labels);

    return validateFeed(labels)
        .then(function() {
            return rssRetriveOrCreate(labels, feedId);
        })
        .then(function(feed) {
            let sourceF = path.join(__dirname, '..', 'rss', feed.xmlpath);
            return fs
                .readFileAsync(sourceF, 'utf-8')
                .then(function(content) {
                    debug("read %d bytes from %s, serving it back", _.size(content), feed.xmlpath);
                    return { text: content };
                });
        })
        .catch(function(error) {
            /* this error message is fired by rssRetrieveOrCreate, happens
             * when a XML file do not exists yet, but would be in few minutes */
            if(error.message === QUEUED_STRING) {
                debug("Returning default message for %s", labels);
                return { 'text': produceDefault(labels, feedId) };
            }
            /* this error message is fired by validateFeed if the labels are invalid */
            else {
                debug("Catch error message: %s", error.message);
                return { text: produceError() };
            }
        });
};

function produceDefault(labels, feedId) {

    let feed = new RSS({
        title: `fbTREX ⏩ ${_.first(labels)}`,
        description: fbtrexRSSdescription,
        feed_url: 'https://facebook.tracking.exposed/feeds/',
        ttl: 60
    });
    feed.item({
        title: `fbTREX would provide update soon...`,
        description : fbtrexRSSplaceholder + "\n" + fbtrexRSSdescription,
        guid: feedId,
        date: moment().startOf('year').toISOString()
    });
    return feed.xml();
};


function produceError() {

    let feed = new RSS({
        title: `fbTREX Ⓧ  Error!?`,
        description: 'There is an error in your requested feed',
        feed_url: 'https://facebook.tracking.exposed/feeds/problems',
        ttl: 20
    });
    feed.item({
        title: `fbTREX Ⓧ  Invalid label!?`,
        description : fbtrexRSSproblem,
        guid: _.random(0, 0xffff),
        date: moment().toISOString()
    });
    return feed.xml();
};

module.exports = {
    feeds,
    fbtrexRSSplaceholder,
    fbtrexRSSdescription ,
    fbtrexRSSproblem,
};