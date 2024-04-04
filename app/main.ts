import * as net from "node:net";
import { RESP2parser } from "./respParser.ts";
import { argv } from "node:process";

// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");
// const args = argv.slice(2);
const PORT = argv[3] ? Number(argv[3]) : 6379;
const map = {};
const timemap = {};
let master: number | undefined = undefined;
if (argv[4] && argv[4] === "--replicaof") master = Number(argv[6]);

// Uncomment this block to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
  connection.on("data", async (data: Buffer) => {
    const req = data.toString();

    const parsedReq = RESP2parser(req.split("\r\n"));

    if (parsedReq[0] === "ping") {
      connection.write("+PONG\r\n");
      return;
    }

    if (parsedReq[0] === "echo") {
      connection.write(`$${parsedReq[1].length}\r\n${parsedReq[1]}\r\n`);
      return;
    }

    if (parsedReq[0] === "set") {
      map[parsedReq[1]] = parsedReq[2];
      if (parsedReq.length > 3 && parsedReq[3] === "px") {
        let expTime = Number(Date.now());
        expTime += Number(parsedReq[4]);
        timemap[parsedReq[1]] = expTime;
      }
      connection.write(`+OK\r\n`);
      return;
    }

    if (parsedReq[0] === "get") {
      if (!map[parsedReq[1]]) {
        connection.write(`$-1\r\n`);
        return;
      }
      if (!timemap[parsedReq[1]]) {
        connection.write(`+${map[parsedReq[1]]}\r\n`);
        return;
      }
      if (timemap[parsedReq[1]] >= Date.now()) {
        console.log(Date.now(), timemap[parsedReq[1]]);

        connection.write(`+${map[parsedReq[1]]}\r\n`);
        return;
      }

      delete timemap[parsedReq[1]];
      connection.write(`$-1\r\n`);
    }

    if (parsedReq[0] === "INFO") {
      switch (parsedReq[1]) {
        case "replication":
          master === undefined
            ? connection.write(
                `$85\r\nrole:master\r\nmaster_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb\r\nmaster_repl_offset:0`
              )
            : connection.write(
                `$84\r\nrole:slave\r\nmaster_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb\r\nmaster_repl_offset:0`
              );
      }
      return;
    }
  });
});

server.listen(PORT, "127.0.0.1");
