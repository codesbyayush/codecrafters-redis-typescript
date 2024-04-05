import * as net from "node:net";
import { RESP2parser } from "./respParser.ts";
import { argv } from "node:process";
import { Buffer } from "node:buffer";

const PORT = argv[3] ? Number(argv[3]) : 6379;
const map = {};
const timemap = {};
const replicas: net.Socket[] = [];
let master: number | undefined = undefined;
if (argv[4] && argv[4] === "--replicaof") master = Number(argv[6]);

const PING = `*1\r\n$4\r\nping\r\n`;
const REPLCONF = `*3\r\n$8\r\nREPLCONF\r\n$14\r\nlistening-port\r\n$4\r\n6380\r\n`;
const REPLCONFCapa = `*3\r\n$8\r\nREPLCONF\r\n$4\r\ncapa\r\n$6\r\npsync2\r\n`;
const PSYNC = `*3\r\n$5\r\nPSYNC\r\n$1\r\n?\r\n$2\r\n-1\r\n`;

const MASTERREPLID = `8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb`;
const MASTERREPLOFFSET = 0;
const EMPTYRDBFILE_BASE64 =
  "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==";

const handshake = [REPLCONF, REPLCONFCapa, PSYNC];

const sendEmptyRDBFile = () => {
  const body = Buffer.from(EMPTYRDBFILE_BASE64, "base64");
  const len = body.length;
  const head = Buffer.from(`$${len}\r\n`);
  return Buffer.concat([head, body]);
  1;
};

const forwardToReplicas = async (data: Buffer) => {
  replicas.map((conn) => {
    conn.write(data);
  });
};

if (master !== undefined) {
  let step = 0;
  const masterConn = net.createConnection(master, "localhost", () => {
    masterConn.write(PING);
    return;
  });

  masterConn.on("data", (data) => {
    const req = data.toString().toLowerCase();

    const parsedReq = RESP2parser(req.split("\r\n"));

    if (parsedReq.includes("pong")) {
      masterConn.write(handshake[step++]);
      return;
    }

    if (step < 3 && parsedReq.includes("ok")) {
      masterConn.write(handshake[step]);
      step++;
      return;
    }

    if (parsedReq.includes("set")) {
      map[parsedReq[1]] = parsedReq[2];
      if (parsedReq.length > 3 && parsedReq[3] === "px") {
        let expTime = Number(Date.now());
        expTime += Number(parsedReq[4]);
        timemap[parsedReq[1]] = expTime;
      }
      return;
    }
  });
}

const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
  connection.on("data", (data: Buffer) => {
    const req = data.toString().toLowerCase();

    if ([REPLCONF.toLowerCase(), REPLCONFCapa.toLowerCase()].includes(req)) {
      connection.write("+OK\r\n");
      return;
    }
    if (PSYNC.toLowerCase() === req) {
      connection.write(`+FULLRESYNC ${MASTERREPLID} ${MASTERREPLOFFSET}\r\n`);
      connection.write(sendEmptyRDBFile());
      replicas.push(connection);
      return;
    }
    const parsedReq = RESP2parser(req.split("\r\n"));

    if (parsedReq.includes("ping")) {
      connection.write("+PONG\r\n");
      return;
    }

    if (parsedReq.includes("echo")) {
      connection.write(`$${parsedReq[1].length}\r\n${parsedReq[1]}\r\n`);
      return;
    }

    if (parsedReq.includes("set")) {
      map[parsedReq[1]] = parsedReq[2];
      if (parsedReq.length > 3 && parsedReq[3] === "px") {
        let expTime = Number(Date.now());
        expTime += Number(parsedReq[4]);
        timemap[parsedReq[1]] = expTime;
      }
      connection.write(`+OK\r\n`);
      forwardToReplicas(data);
      return;
    }

    if (parsedReq.includes("get")) {
      if (!map[parsedReq[1]]) {
        connection.write(`$-1\r\n`);
        return;
      }
      if (!timemap[parsedReq[1]]) {
        connection.write(`+${map[parsedReq[1]]}\r\n`);
        return;
      }
      if (timemap[parsedReq[1]] >= Date.now()) {
        connection.write(`+${map[parsedReq[1]]}\r\n`);
        return;
      }

      delete timemap[parsedReq[1]];
      connection.write(`$-1\r\n`);
    }

    if (parsedReq.includes("info")) {
      switch (parsedReq[1]) {
        case "replication":
          master === undefined
            ? connection.write(
                `$87\r\nrole:master\nmaster_replid:${MASTERREPLID}\nmaster_repl_offset:${MASTERREPLOFFSET}\r\n`
              )
            : connection.write(
                `$86\r\nrole:slave\nmaster_replid:${MASTERREPLID}\nmaster_repl_offset:${MASTERREPLOFFSET}\r\n`
              );
      }
      return;
    }
  });
});
server.listen(PORT, "127.0.0.1");
