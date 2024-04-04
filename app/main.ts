import * as net from "node:net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
  connection.on("data", (data: Buffer) => {
    const req = data.toString().trim();
    console.log(req);
    if (req === "*1\r\n$4\r\nping\r\n") {
      connection.write("+PONG\r\n");
    }
    connection.end();
  });
});

server.listen(6379, "127.0.0.1");
