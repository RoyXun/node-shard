import {murmurHash64x64 as murmurhash} from 'murmurhash-native'; 
import Decimal from 'decimal.js';

//反码映射
const hexBinMap = {
    0: '1111',
    1: '1110',
    2: '1101',
    3: '1100',
    4: '1011',
    5: '1010',
    6: '1001',
    7: '1000',
    8: '0111',
    9: '0110',
    a: '0101',
    b: '0100',
    c: '0011',
    d: '0010',
    e: '0001',
    f: '0000',
    A: '0101',
    B: '0100',
    C: '0011',
    D: '0010',
    E: '0001',
    F: '0000'
};

//用于存放哈希值
const hashKeyArr = [];

let shards = [];

/**
 * 底层使用murmurhash-native的murmurHash64(x64)算法，该算法和passport Java端一致，只是得到的是十六进制字符串，
 * 而Java端得到的是个long类型的数字(十进制)。大数的进制转换太复杂了，直接使用decimal.js处理。
 * 先判断符号，负数求得原码二进制字符串再传给decimal.js，正数直接传
 * 
 * @param {string} str -需要哈希处理的字符串
 * @return {string} - murmurhashV2算法得到的10进制有符号字符串
 */
function hash(str) {
    //16位十六进制数字字符串 e.g. 'e9a4fa495fd57191', '2edc3f3edb5c097'
    let hexStr = murmurhash(str, 0x1234ABCD); 
    if (parseInt(hexStr[0], 16) > 7) {
        let bins = ['0b'];
        //按位取反
        for (let hex of hexStr) {
            bins.push(hexBinMap[hex]);
        }
        //利用decimal转换十进制
		let dec = new Decimal(bins.join('')).plus(1).toString();
		return '-' + dec;
	} else {
		return new Decimal('0x' + hexStr).toString();
	}
}

/**
 *  @param {array} shardConfig - redis shard配置
 */
function init(shardConfig) {
    if (shards.length) return;
     
    shards = shardConfig;

    shardConfig.forEach((cfg, i) => {
        if (!cfg.name) {
            for (let n = 0; n < 160 * cfg.weight; n++) {
                let hashKey = hash('SHARD-' + i + '-NODE-' + n);
                insertNode(hashKey, i, hashKeyArr);
            }
        } else {
            for (let n = 0; n < 160 * cfg.weight; n++) {
                let hashKey = hash(cfg.name + '*' + cfg.weight + n);
                insertNode(hashKey, i, hashKeyArr);
            }
        }
    });
    //排序
    hashKeyArr.sort(compare);
}

/**
 * 生成自定义哈希节点
 * @param {string} hashKey - 哈希值字符串
 * @param {number} shardIndex - shard索引
 */
function generateNode(hashKey, shardIndex) {
    let node; 

    if (hashKey.length >= 10) {
        let high = parseInt(hashKey.slice(0, -8));//高位
        let low = parseInt(hashKey.slice(-8));//低位
        let isPositive = high > 0;

        node = {
            isPositive,
            high: Math.abs(high),
            low,
            hashKey,
            shardIndex
        };
    } else {
        node = {
            isPositive: hashKey > 0,
            high: 0,
            low: Math.abs(hashKey),
            hashKey,
            shardIndex
        };
    }

    return node;
}

/**
 * @param {string} hashKey
 * @param {number} shardIndex
 * @param {array} hashKeyArr -存放节点的数组 
 */
function insertNode(hashKey, shardIndex, hashKeyArr) {
    let node = generateNode(hashKey, shardIndex);
    hashKeyArr.push(node);
}

/**
 * 比较函数，node1排在node2前面，返回负数；node1排在node2后面，返回正数；相等返回0
 * @param {object} node1 - 自定义哈希节点
 * @param {object} node2 - 同上
 */
function compare(node1, node2) {
    //先根据正负号判断大小
    if (node1.isPositive < node2.isPositive) {
        return -1;
    } else if (node1.isPositive > node2.isPositive) {
        return 1;
    } 
    //正负号相同，再根据高位判断
    let sign = node1.isPositive && 1 || -1;
    if (node1.high < node2.high) {
        return sign * -1;
    } else if (node1.high > node2.high) {
        return sign;
    } else {
        //高位相同，判断低位
        return sign * (node1.low - node2.low);
    }
}

/**
 * 二分查找
 */
function findRecentKey(node, hashKeyArr, start, end) {
    if (start == end) {
        return;
    }

    if (end - start === 1) {
        if (compare(hashKeyArr[end], node) > 0) {
            return hashKeyArr[end];
        } else {
            return;
        }
    }

    let mid = parseInt((start + end) / 2);
    let midNode = hashKeyArr[mid];

    if (node.hashKey == midNode.hashKey) {
        return midNode;
    }

    if (compare(node, midNode) > 0) {
        return findRecentKey(node, hashKeyArr, mid, end);
    } else {
        return findRecentKey(node, hashKeyArr, start, mid);
    }
}

/**
 * 根据sessionIdentifier查找对应的shard
 */
function getShard(sessionIdentifier) {
    let hashKey = hash(sessionIdentifier);
    let node = findRecentKey(generateNode(hashKey), hashKeyArr, 0, hashKeyArr.length);

    return node ? shards[node.shardIndex] : shards[hashKeyArr[0].shardIndex];
}


export {init, getShard};
