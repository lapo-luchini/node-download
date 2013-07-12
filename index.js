/*!
 * node HTTP download only if needed
 * (c) 2013 Lapo Luchini <lapo@lapo.it>
 */
/*jshint node: true, strict: true, globalstrict: true, indent: 4, immed: true, undef: true, sub: true */
'use strict';

var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    url = require('url');

// methods

function mkdirsSync(pathname) {
    try {
        if (!fs.statSync(pathname).isDirectory())
            throw new Error('Unable to create directory at: ' + pathname);
    } catch (e) {
        if (e.code == 'ENOENT') {
            mkdirsSync(path.dirname(pathname));
            fs.mkdirSync(pathname);
        } else
            throw e;
    }
}

var interestingHeaders = [ 'date', 'content-length', 'last-modified', 'etag' ];

function download(item, callback) {
    var start = Date.now(),
        fileHeads = item.file + '.headers',
        param = url.parse(item.url);
    try {
        var stat = fs.statSync(fileHeads);
        if (stat.isFile() && (Date.now() - stat.mtime < 86400000)) {
            // skip the file, as it was checked in the last 24 hours
            return callback();
        }
        var prev = JSON.parse(fs.readFileSync(fileHeads));
        param.headers = param.headers || {};
        if (prev['last-modified'])
            param.headers['If-Modified-Since'] = prev['last-modified'];
        if (prev['etag'])
            param.headers['If-None-Match'] = prev['etag'];
    } catch (e) {
        if (e.code == 'ENOENT')
            mkdirsSync(path.dirname(item.file));
    }
    try {
        (param.protocol == 'http:' ? http : https).get(param, function (response) {
            //console.log(response.statusCode + ' ' + item.file);
            if (response.statusCode == 304) {
                // touch the headers file as we are just checked with the source
                var now = new Date();
                fs.utimesSync(fileHeads, now, now);
                return callback();
            }
            if (response.statusCode != 200)
                return callback('HTTP error: ' + response.statusCode);
            var tmpFile = item.file + '.part',
                disk = fs.createWriteStream(tmpFile),
                size = 0;
            response.on('data', function (chunk) {
                size += chunk.length;
                disk.write(chunk, 'binary');
            }).on('end', function () {
                disk.end();
            });
            disk.on('close', function () {
                var delta = Date.now() - start;
                if (response.headers['content-length'] != size) {
                    fs.unlinkSync(tmpFile);
                    callback('Wrong content length');
                } else {
                    try { fs.unlinkSync(item.file); } catch (e) {}
                    fs.renameSync(tmpFile, item.file);
                    fs.writeFileSync(fileHeads, JSON.stringify(response.headers, interestingHeaders, '  '));
                    callback();
                }
            });
        }).on('error', function (err) {
            callback(err);
        }).setTimeout(3000 /*3 secs*/, function () {
            this.destroy(); // this closes the socket and produces an error event on the connection
        });
    } catch (e) {
        callback(e);
    }
}

module.exports = download;
