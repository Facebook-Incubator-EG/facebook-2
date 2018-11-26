#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parsers:components:post');

function post(envelop) {

    /* video metadata */
    var vTitle = envelop.dom.querySelectorAll('h1');
    debugger;

    envelop.post = { mine: true };
    return envelop;
};

/*
function hasLike($) {
    var mayLike = $(".UFILikeLink");
    // a number of entry for each like button present
    return (mayLike.length > 0 )
};

const sponsoredText = {
    'cs': 'Sponzorováno',
    'da': 'Sponsoreret',
    'de': 'Gesponsert',
    'en': 'Sponsored',
    'es': 'Publicidad',
    'fr': 'Sponsorisé',
    'hu': 'Hirdetés',
    'it': 'Sponsorizzata',
    'ja': '広告',
    'nb': 'Sponset',
    'nl': 'Gesponsord',
    'nn': 'Sponsa',
    'pl': 'Sponsorowane',
    'pt': 'Patrocinado',
    'ru': 'Реклама',
    'sk': 'Sponzorované',
    'sr': 'Спонзорисано',
    'sv': 'Sponsrad',
    'tr': 'Sponsorlu'
};

function promotedCheck($) {

    var as = $('a');
    
    var leafs = _.reduce(as, function(memo, chentr) { 
        if(_.size(chentr.children) === 1) {
            memo.push({
                cheerio: chentr,
                text: $(chentr).text()
            });
        }
        return memo;
    }, []);

    return _.reduce(sponsoredText, function(memo, label, lang) {
        _.each(leafs, function(l) {
            memo |= l.text === label;

            if(l.text === label)
                debug("Language used to detect sponsored content is", lang);
        });
        return memo;
    }, false);
};
*/

/*
var stats = { 'feed': 0, 'promoted': 0, 'error': 0 };

function getPostType(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = {};

    if($(".timestampContent").length > 0) {
        retO.type = 'feed';
        retO.postType = true;
        stats.feed += 1;
    } else if($('[href="/ads/about"]')) {
        retO.type = 'promoted';
        retO.postType = true;
        stats.promoted += 1;
    } else {
        retO.postType = false;
        stats.error += 1;
    }

    debug("%s %s [f %d p %d error %d]",
        snippet.id, retO.type, stats.feed,
        stats.promoted, stats.error);

    return retO;
};

var postType = {
    'name': 'postType',
    'requirements': { },
    'implementation': getPostType,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(postType);

*/

module.exports = post;
