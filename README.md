lapo-download
=============

HTTP GET of a file using every header available to avoid re-fetching an up-to-date file. Right now headers are saved in a `.headers` file.

    var download = require('lapo-download');
    download({
        file: 'path/localFile.txt',
        url: 'http://domain/path/url/realName.txt'
    }, function (err) {
        console.log('Status:' + (err || 'OK'));
    });
