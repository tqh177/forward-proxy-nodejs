import { createConnection } from "net";
import { Transform, TransformCallback } from "stream";

function log(...args: any[]){
    // console.log(...args);
}
function error(...args: any[]){
    console.log(...args);
}
export default class HttpProxyTransform extends Transform {
    private state: 'fulfilled' | 'pending' | 'none' = 'none';
    private socket: NodeJS.WritableStream = null!;
    private parseHeaders(buffer: Buffer) {
        const headerStrs = buffer.toString().slice(0, -4).split('\r\n');
        const [method, url, version] = headerStrs[0].split(' ');
        const headers: Record<string, string> = {};
        for (let index = 1; index < headerStrs.length; index++) {
            const str = headerStrs[index];
            const [k, v] = str.split(':');
            headers[k.trim()] = v.trim();
        }
        if (method === 'CONNECT') {
            // https
            return {
                method,
                version,
                url: new URL('https://' + url),
                headers,
            };
        } else {
            // http
            return {
                method,
                version,
                url: new URL(url),
                headers,
            };
        }
    }
    private createConnection(url: URL) {
        const port = url.port ? +url.port : getUrlPort(url.protocol);
        log(`Connect start ${url.hostname}:${port}`);
        const connection = createConnection({
            host: url.hostname,
            port: port,
        }, () => {
            log(`Connect success ${url.hostname}:${port}`);
        }).on('error', (e) => {
            log('Connect error', `${url.hostname}:${port}`);
            error(e.name, e.message);
        }).on('close', hadError => {
            log('Connect close', `${url.hostname}:${port}`);
        });
        return connection;
    }
    private filterHeaders(headers: Record<string, string>){
        return Object.entries(headers).reduce((headers, [k,v])=>{
            if (k.startsWith('Proxy-')) {
                k = k.slice(6);
            }
            headers[k] = v;
            return headers;
        }, {} as Record<string, string>);
    }
    private headersStringify(headers: Record<string, string>){
        return Object.entries(headers).map(([k,v])=>`${k}:${v}`).join('\r\n');
    }
    private initConnection(chunk: Buffer) {
        this.state = 'pending';
        const { url, headers, method, version } = this.parseHeaders(chunk);
        if (url.protocol === 'https:') {
            this.socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
        } else {
            const header = `${method} ${url} ${version}\r\n${this.headersStringify(this.filterHeaders(headers))}\r\n\r\n`;
            log(header);
            this.push(Buffer.from(header));
        }
        this.pause();
        super.pipe(this.createConnection(url)).once('connect', () => {
            this.state = 'fulfilled';
            this.resume();
        }).pipe(this.socket);
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        if (this.state === 'none') {
            this.initConnection(chunk);
        } else {
            this.push(chunk);
        }
        callback();
    }
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean | undefined; } | undefined): T {
        // 需要延迟pipe
        this.socket = destination;
        return destination;
    }
}

function getUrlPort(protocol: string) {
    switch (protocol) {
        case 'http:':
            return 80;
        case 'https:':
            return 443;
        default:
            throw new Error('未知协议:' + protocol);
    }
}
