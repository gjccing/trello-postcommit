var path = require('path');
var Trello = require('node-trello');
var config = require('./config.json');
var t = new Trello(config.key, config.token); // Change these to your key and token from Trello

var exec = require('child_process').exec;

var repository = path.basename(process.argv[2]);
Promise.all([
  new Promise((res, rej)=>exec(
    `(cd ${process.argv[2]} && git config --get remote.origin.url)`,
    (error, stdout)=>error ? rej(error) : res(stdout)
  )).then(originUrl=>{
    var url = originUrl.trim();
    if (url.indexOf('@') > -1) {
      url = url.replace(':', '/').replace(/^.*@/, 'https://')
    }

    return url.replace(/\.git$/, url.indexOf('bitbucket') > -1 ? '/commits/' : '/commit/');
  }),
  new Promise((res, rej)=>exec(
    `(cd ${process.argv[2]} && git log --pretty=format:"%H %B----------" ` + 
    (process.argv[3] != '0000000000000000000000000000000000000000'? process.argv[3] + '..' : '') +
    `${process.argv[4]})`,
    (error, stdout)=>error ? rej(error) : res(stdout.trim())
  ))
]).then(([url, commits])=>{
  commits
    .split('----------')
    .reverse()
    .filter(item=>item.search(/\|\s+https\:\/\/trello.com\/c\/\w+\/?\s*$/) > -1)
    .map(item=>item.trim())
    .map(item=>
      [item.substr(0, 40)]
        .concat(item.substr(41).match(/((.|\s)+)\|\s+https\:\/\/trello.com\/c\/(\w+)\/?\s*$/))
    )
    .reduce(
      (p, item)=>p.then(()=>new Promise((res, rej)=>t.post(
        `/1/cards/${item[4]}/actions/comments/`,
        { text: `Repository: ${repository}\nCommit:\n\n${item[2].trim()}\n\nReference: ${url}${item[0]}` },
        (error, data)=>error ? rej(error) : res(data)
      ))),
      Promise.resolve()
    );
});
