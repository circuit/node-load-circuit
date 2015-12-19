/*
    Copyright (c) 2015 Unify Inc.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the Software
    is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
    OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*jshint node:true, esversion:6 */
/*global require, Promise */

'use strict';

// Load configuration
let config = require('./config.json');

// Load content
let content = require('./content.json');

// Load Bunyan logger
let bunyan = require('bunyan');

// SDK logger
let sdkLogger = bunyan.createLogger({
    name: 'sdk',
    stream: process.stdout,
    level: config.sdkLogLevel
});

// Application logger
let logger = bunyan.createLogger({
    name: 'app',
    stream: process.stdout,
    level: 'info'
});

// Node utils
let assert = require('assert');

// RxJS / Observables
let Rx = require('rx');

// For file upload tests
let fs = require('fs');
let FileAPI = require('file-api');

// Circuit SDK
let Circuit = require('circuit');

// Setup bunyan logger
Circuit.setLogger(sdkLogger);

// Application variables
let client;
//let clients = new Map(); // key:email -> value:client
let users = [];
let conversations = new Map(); // key:convId -> value:conversation
let files = [];

//*********************************************************************
//* Helper functions
//*********************************************************************
function terminate(err) {
    let error = new Error(err);
    logger.error('Test failed ' + error.message);
    logger.error(error.stack);
    process.exit(1);
}

function done() {
    logger.info('Done. Press Ctrl-C to exit');
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(o) {
	for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
}

function getRandomTextContent() {
    let r = rand(1, 3);
    switch (r) {
        case 1:
            return content.text.short;
        case 2:
            return content.text.long;
        case 3:
            return content.text.rich;
    }
}

function getRandomSubject() {
    return rand(0, 1) ? content.text.subject : null;
}

function getRandomUserIds(min) {
    min = min || 2;
    let n = rand(min, users.length - 1);
    let res = users.slice(0, n).map(u => u.userId);
    shuffle(res);
    return res;
}

function getRandomPost(conversation) {
    if (!conversation.posts || !conversation.posts.length) {
        return;
    }

    let n = rand(0, conversation.posts.length - 1);
    return conversation.posts[n].itemId;
}

function getRandomFiles() {
    if (files.length === 0) {
        return;
    }

    let r = rand(0, 6);
    switch (r) {
        case 0:
            // return 1 file
            return files[rand(0, files.length - 1)];
        case 1:
            // return random number of files
            return shuffle(files).slice(0, rand(0, files.length - 1));
        default:
            // return no files
            return [];
    }
}

function loadFiles(path) {
    var files = [];
    var fileNames = fs.readdirSync(path);
    fileNames.forEach(function (element) {
        var file = new FileAPI.File(path + element);
        files.push(file);
    });
    logger.debug('getFiles' + files);
    return files;
}

//*********************************************************************
// init
//*********************************************************************
function init() {
    files = loadFiles(config.filesPath);
    return Promise.resolve();
}

//*********************************************************************
// logon
//*********************************************************************
function logon() {
    client = new Circuit.Client({domain: config.domain});
    addEventListeners(client);
    return client.logon(config.admin.email, config.admin.password)
        .then((user) => logger.info('Logged on as ' + user.emailAddress));
}

//*********************************************************************
// addEventListeners
//*********************************************************************
function addEventListeners(client) {
    // Just for the heck of it play with observables
    Rx.Observable.fromEvent(client, 'itemAdded')
        .map(evt => evt.item)
        .filter(item => { return conversations.get(item.convId) && item.type === 'TEXT'; })
        .subscribe(
            function (x) {
                logger.debug('itemAdded event. itemId=' + x.itemId);
            },
            function (err) {
                logger.debug('Error: ' + err);
            }
        );
}

//*********************************************************************
// getTenantUsers
//*********************************************************************
function getTenantUsers() {
    return client.getTenantUsers()
        .then(tenantUsers => {
            assert(tenantUsers.length >= 3, 'At least three users need to be configured in the tenant');
            users = tenantUsers
                .slice(0, Math.min(config.nrUsers, tenantUsers.length))
                .filter(user => config.excludeEmails.indexOf(user.emailAddress) === -1);
            return users;
        });
}
          
/*
//*********************************************************************
// logonUsers
//*********************************************************************
function logonUsers(tenantUsers) {
    let tasks = [];

    tenantUsers.slice(0, Math.min(config.nrUsers, tenantUsers.length)).forEach(user => {
        let client = new Circuit.Client({domain: config.domain});
        clients.set(user.emailAddress, client);
        tasks.push(client.logon(user.emailAddress, config.password));
    });

    return Promise.all(tasks)
        .then(results => {
            results.forEach(result => logger.info('User logged on:', result.emailAddress));
        });
}

//*********************************************************************
// logoutUsers
//*********************************************************************
function logoutUsers(users) {
    let tasks = [];
    clients.forEach((client, email) => tasks.push(client.logout()));
    return Promise.all(tasks).then(() => logger.info('Users logged out'));
}
*/
          
//*********************************************************************
// sendPosts
//*********************************************************************
function sendPosts() {
    let tasks = [];
    for (var c of conversations.values()) {
        let r = rand(config.conversations.posts.min, config.conversations.posts.max);
        for (let i = 0; i < r; i++) {
            let msg = {
                subject: getRandomSubject(),
                content: getRandomTextContent(),
                contentType: Circuit.Constants.TextItemContentType.RICH,
                attachments: getRandomFiles(config.filesPath)
            };

            tasks.push(client.addTextItem(c.convId, msg));
        }
    }

    return Promise.all(tasks)
        .then(items => {
            logger.info('Created ' + items.length + ' text message(s)');
            items.forEach(item => {
                let c = conversations.get(item.convId);
                c.posts = c.posts || [];
                c.posts.push(item);
                c.messages = c.messages || [];
                c.messages.push(item);
            });
        });
}

//*********************************************************************
// sendReplies
//*********************************************************************
function sendReplies() {
    let tasks = [];
    for (var c of conversations.values()) {
        let r = rand(config.conversations.replies.min, config.conversations.replies.max);
        for (let i = 0; i < r; i++) {
            let msg = {
                parentId: getRandomPost(c),
                subject: getRandomSubject(),
                content: getRandomTextContent(),
                contentType: Circuit.Constants.TextItemContentType.RICH,
                attachments: getRandomFiles(config.filesPath)
            };

            tasks.push(client.addTextItem(c.convId, msg));
        }
    }

    return Promise.all(tasks)
        .then(items => {
            logger.info('Created ' + items.length + ' replies');
            items.forEach(item => {
                let c = conversations.get(item.convId);
                c.messages.push(item);
            });
        });
}

//*********************************************************************
// likeItems
//*********************************************************************
function likeItems() {
    let tasks = [];
    function pushTask(m) {
        if (rand(0, 10) < config.conversations.likes * 10) {
            tasks.push(client.likeItem(m.itemId));
        }
    }
    for (var c of conversations.values()) {
        c.messages.forEach(pushTask);
    }

    return Promise.all(tasks)
        .then(res => logger.info('Liked ' + res.length + ' message(s)'));
}

//*********************************************************************
// flagItems
//*********************************************************************
function flagItems() {
    let tasks = [];
    function pushTask(m) {
        if (rand(0, 10) < config.conversations.flags * 10) {
            tasks.push(client.flagItem(m.convId, m.itemId));
        }
    }
    for (var c of conversations.values()) {
        c.messages.forEach(pushTask);
    }

    return Promise.all(tasks)
        .then(res => logger.info('Flagged ' + res.length + ' message(s)'));
}

//*********************************************************************
// createGroupConversations
//*********************************************************************
function createGroupConversations() {
    let tasks = [];

    for (let i = 0; i < config.conversations.group; i++) {
        tasks.push(client.createGroupConversation(getRandomUserIds(2)));
    }

    return Promise.all(tasks)
        .then(convs => {
            convs.forEach(c => conversations.set(c.convId, c));
            logger.info('Created ' + convs.length + ' group conversation(s)');
        });
}

//*********************************************************************
// createOpenConversations
//*********************************************************************
function createOpenConversations() {
    let tasks = [];

    for (let i = 0; i < config.conversations.open; i++) {
        tasks.push(client.createOpenConversation(getRandomUserIds(0), 'Open ' + (i + 1).toString(), content.text.short));
    }

    return Promise.all(tasks)
        .then(convs => {
            convs.forEach(c => conversations.set(c.convId, c));
            logger.info('Created ' + convs.length + ' open conversation(s)');
        });
}

//*********************************************************************
// createConversations
//*********************************************************************
function createConversations() {
    return Promise.all([
        createOpenConversations(),
        createGroupConversations()
    ]);
}


//*********************************************************************
// run
//*********************************************************************
function run() {
    init()
        .then(logon)
        .then(getTenantUsers)
        .then(createConversations)
        .then(sendPosts)
        .then(sendReplies)
        .then(likeItems)
        .then(flagItems)
        .then(done)
        .catch(terminate);
}

//*********************************************************************
// main
//*********************************************************************
run();