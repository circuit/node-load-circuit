# node-load-circuit
Create conversations and messages using the [circuit node SDK](https://circuitsandbox.net/sdk/index.html). 
Useful to load the local Circuit system for load testing.

## Requirements ##
* [node 4.x](http://nodejs.org/download/)
* [circuit module](https://circuitsandbox.net/sdk/)

## Getting Started ##

```bash
    git clone https://github.com/yourcircuit/node-load-circuit.git
    cd node-load-circuit
    cp config.json.template config.json
```

Edit config.json
* Add "admin email" and "admin password" to run the example.
    You can request a circuit account at the [Circuit Developer Community Portal](https://www.yourcircuit.com/web/developers).
* Change the number of conversations to generate, the number of post & replies, and the percentage of likes and flags to set.
 
 Run the sample application with 
 
```bash
    npm install
    wget https://circuitsandbox.net/circuit.tgz
    npm install circuit.tgz
    node server.js
``` 

 If you do not have wget installed you can use curl to download circuit.tgz
```bash
curl "https://circuitsandbox.net/circuit.tgz" -o "circuit.tgz"
``` 


## Output ##

```bash
>./start.sh 
01:08:38.306Z  INFO app: Logged on as admin@unify.com
01:08:38.417Z  INFO app: Created 4 open conversation(s)
01:08:38.448Z  INFO app: Created 8 group conversation(s)
01:08:39.046Z  INFO app: Created 56 text message(s)
01:08:39.473Z  INFO app: Created 49 replies
01:08:39.641Z  INFO app: Liked 34 message(s)
01:08:39.780Z  INFO app: Flagged 11 message(s)
01:08:39.780Z  INFO app: Done. Press Ctrl-C to exit
```
 
