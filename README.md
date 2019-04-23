## What
An extension to [gundb](https://github.com/amark/gun).

Allows marking node as append only, this means fields of AO nodes (or refs from AO nodes) can only be added and their value can't be modify.
There is an exception that if the ref is to a SEA signed node then the user of the signed node can change the ref.

## Why

For example its a way to claim a username that reference a profile.
gun.rootAO('indexbyusername').get(username).put(profileId).
This makes the node 'indexbyusername' append only and thus once the key <username> is set to <profileid> it can not be modified. But other keys could be added to 'indexbyusername'.
Once that username is defined no one else could change where it points to. Currently in gundb evereything is world writable, so theoretically anyone could change it.

## How to use

- npm i gun @gooddollar/gun-appendOnly --save
- import Gun from '@gooddollar/gun-appendOnly'
- gun = new Gun()

## API

gun.rootAO(key) - creates a root gundb node that is marked as append only

gun.get(key).putAO(node) - put a ref to <node> at <key> making the node append only

## How it works

Behind the scenes it appends '!@' to the soul of the node (souls in gundb are like ids)
Extends gun wire protocol to check if the node being written to is marked with '!@' and if the put request contains an existing field. (check out the source code)
