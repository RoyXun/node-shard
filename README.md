###简介
为passport实现的node版的redis分片算法，目的是为了和java端分片算法根据sessionID映射相同的shard，底层基于murmurhash算法。
不通用。

###安装
```
npm install node-shard --save
```

###使用
```javascript
var nodeShard = require('node-shard');
//your custom config
var shardConfig = [
    {name: 'shard1', weight: 1, server: [{port: 6379, host: '127.0.0.1'}]},
    {name: 'shard2', weight: 1, server: [{port: 6379, host: '127.0.0.1'}]},
    {name: 'shard3', weight: 1, server: [{port: 6379, host: '127.0.0.1'}]},
    {name: 'shard4', weight: 1, server: [{port: 6379, host: '127.0.0.1'}]},
];
nodeShard.init(shardConfig);
...
var shard = nodeShard.getShard(sessionID);

```

###测试

```
npm run test
```
得到test/output.txt，可以与output_java.txt对比，查看两者映射的shard是否一致 