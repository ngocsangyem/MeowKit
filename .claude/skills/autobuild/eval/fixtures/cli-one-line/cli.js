#!/usr/bin/env node
const arg = process.argv[2];
if (arg === 'hello') console.log('hello');
else console.log('usage: cli hello');
