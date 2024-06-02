import { Socket, createServer } from "net";
import HttpHeadersTransform from "./transform/HttpHeadersTransform";
import HttpProxyTransform from "./transform/HttpProxyTransform";
import SpeedLimitTransform from "./transform/SpeedLimitTransform";
import SpeedTransform from "./transform/SpeedTransform";

function listenSocket(socket: Socket) {
    // const remoteHost = `${socket.remoteAddress}:${socket.remotePort}`;
    socket
    // 解析http头
    .pipe(new HttpHeadersTransform())
    // 代理
    .pipe(new HttpProxyTransform())
    // 下载限速 1 MB/s
    .pipe(new SpeedLimitTransform().setLimit(1024*1024))
    // 打印下载速度
    .pipe(new SpeedTransform())
    .pipe(socket)
    .on('error', e => {
        // console.log('Proxy error', remoteHost);
        console.error(e);
    }).on('close', hadError => {
        // console.log('Proxy close', remoteHost);
    });
}

function main(port?: number | undefined, hostname?: string | undefined) {
    console.log(`Socket listen at ${hostname}:${port}`);
    createServer(listenSocket).listen(port, hostname);
}

main(8080, '0.0.0.0');
