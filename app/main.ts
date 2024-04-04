import * as net from "node:net";
import { RESP2parser } from "./resp2-parser";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
  connection.on("data", async (data: Buffer) => {
    const req = data.toString();
    const parsedReq = RESP2parser(req.split("\r\n"));
    if (req.includes("ping")) connection.write("+PONG\r\n");
    if (parsedReq[0] === "echo")
      parsedReq.map((reqs) => {
        if (reqs !== "echo") connection.write(reqs);
      });
    // connection.end();
  });
});

server.listen(6379, "127.0.0.1");
