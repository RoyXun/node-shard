var fs = require('fs');
var nodeShard = require('../lib/index').default;

var inputFile = 'test/input.txt';
var outputFile = 'test/output.txt';
var shardConfig = []; 

fs.writeFileSync(outputFile, '');

for (var i = 1; i < 33; i++) {
    shardConfig.push({
        name: 'shard' + i,
        weight: 1, 
        servers: 'h' + i
    });
}
nodeShard.init(shardConfig);

fs.readFile(inputFile, 'utf-8', function(err, data) {
    if (err) throw err;
    var authIds = data.trim().split('\r\n');

    authIds.forEach(function(authId) {
        var shard = nodeShard.getShard(authId);
        var content = authId + '\t' + shard.name + '\n';
        console.log(content);
        fs.appendFile(outputFile, content);
    });
});