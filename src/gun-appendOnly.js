import Gun from "gun";
import SEA from "gun/sea";
import get from "lodash/get";
import map from "lodash/map";
import isObject from "lodash/isObject";
import find from "lodash/find";
import findKey from "lodash/findKey";

Gun.appendOnly = {};
/**
 * turn into a gun node and add the '!@' prefix to mark appendonly node
 * @param  {} data the data to turn into a node (ie adding a soul)
 */
Gun.appendOnly.ify = function(data) {
  for (var i in data) {
    if (i !== "_" && isObject(data[i]))
      throw new Error("Nested objects not supported");
  }
  const soulified = Gun.node.ify(data);
  const soul = Gun.node.soul(soulified);

  if (soul.slice(0, 2) !== "!@") soulified["_"]["#"] = "!@" + soul;
  return soulified;
};

/**
 * Extends gun .get, this can be used to create a root append only key
 * @param  {} key
 * @param  {} cb
 * @param  {} as
 */
Gun.chain.rootAO = function(key, cb, as) {
  const root = this._.root.$;
  as = as || {};
  if (this !== root) {
    throw new Error("Use putAO for non root nodes");
  }
  if (key.slice(0, 2) !== "!@") key = "!@" + key;
  return this.get(key, cb, as);
};
/**
 * Extends gun put. this can be used to put a non root node as append only node.
 * This will try to change the current gun node, ie gun.get('node').putAO({z:1}) will try to overwrite 'node'
 * @param  {} data
 * @param  {} cb
 * @param  {} as
 */
Gun.chain.putAO = function(data, cb, as) {
  if (!Gun.node.is(data)) {
    data = Gun.appendOnly.ify(data);
  }
  return this.put(data, cb, as);
};

Gun.on("opt", async function(at) {
  if (!at.ao) {
    // only add once per instance, on the "at" context.
    at.ao = {};
    at.on("in", appendOnly, at); // now listen to all input data, acting as a firewall.
    // at.on('out', signature, at); // and output listeners, to encrypt outgoing data.
    // at.on('node', each, at);
  }
  this.to.next(at); // make sure to call the "next" middleware adapter.
});

function testNodeKeyVal(val, key) {
  const { soul, curNode } = this;
  if (key === "_") return true;
  const curValue = get(curNode, key);
  console.log("testKeyVal", { soul, val, key, curValue });
  const curOwnerPub = SEA.opt.pub(Gun.val.link.is(curValue));
  const newOwnerPub = SEA.opt.pub(Gun.val.link.is(val));
  //if value is reference to another node and is a user signed SEA node
  if (curOwnerPub && newOwnerPub && newOwnerPub === curOwnerPub) {
    console.log("testKeyVal allowing SEA overwrite for same user", {
      curOwnerPub,
      newOwnerPub
    });
    return true;
  }
  if (curValue !== undefined) return false;
  else return true;
}
function inverseTestNodeKeyVal(val, key) {
  return !testNodeKeyVal.bind(this)(val, key);
}
function appendOnly(msg) {
  const to = this.to,
    gun = this.as.gun;
  if (msg["@"]) {
    // console.log("passing @ msg", { msg, put: msg.put });
    return to.next(msg);
  }

  if (msg.put) {
    // console.log({ msg, x: msg.x });
    //find additions to a node violating append only
    const promises = map(msg.put, async function(node, soul) {
      //if node is not append only then skip
      if (soul.slice(0, 2) !== "!@") return;
      if (Gun.obj.empty(node, "_")) {
        to.next(msg);
      } // ignore empty updates, don't reject them.
      //fetch current data
      const curNode = await gun.get(soul).then();
      // console.log("promise msg.put iterate", {
      //   node,
      //   soul,
      //   curNode,
      //   keys: Object.keys(node)
      // });
      //check if msg tries to modify existing keys
      const invalidKey = findKey(
        node,
        inverseTestNodeKeyVal.bind({ soul, node, curNode, gun })
      );
      if (invalidKey) return { soul, invalidKey };
      return;
    });
    return Promise.all(promises).then(r => {
      let invalid = find(r, x => x !== undefined);
      if (invalid) {
        console.error("invalid existing append only key", invalid);
        return;
      }
      // console.log("Appendonly ok, passing msg");
      return to.next(msg);
    });
  } else {
    // console.log("passing msg", { msg });
    return to.next(msg);
  }
}

//examples
/*
  let aoRoot = gun.rootAO('byname')//create an append only root node, basically simply create it with a soul '!@byname'
  aoRoot.get('mark').put({name:'mark nadal'})
  aoRoot.get('mark').put(null)//FAIL
  aoRoot.get('mark').put({name:'daniel nadal'})//FAIL
  //PUT
  aoRoot.get('mark').putAO({name:'mark nadal'})//OK
  aoRoot.get('mark').put({name:'daniel nadal'})//OK
  aoRoot.get('daniel').put({name:'daniel nadal'})//OK
  aoRoot.put({mark:'z'}) // FAIL
*/

export default Gun;
