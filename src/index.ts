import net from 'net';

const DEBUG = false;

class BufferReader{
    private buffers: Buffer[] = [];
    private resolve: ((buffer: Buffer)=>void)|null = null;
    private reject: ((reason: any)=>void)|null = null;
    feed(buffer: Buffer){
        if (this.resolve) {
            this.resolve(buffer);
            this.resolve = null;
        } else {
            this.buffers.push(buffer);
        }
    }
    private stream(){
        if (this.buffers.length>0) {
            const buffer = Buffer.concat(this.buffers);
            this.buffers = [];
            return Promise.resolve(buffer);
        }
        return new Promise<Buffer>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    /** 异步读取结束符，并返回结束符前的数据 */
    async consume(chars: readonly number[]){
        const current: Buffer[] = [];
        let flag = 0;
        while(true){
            const buffer = await this.stream();
            for (let index = 0; index < buffer.length; index++) {
                const value = buffer[index];
                if(value === chars[flag]) {
                    flag++;
                    if (flag === chars.length) {
                        current.push(buffer.subarray(0, index));
                        this.buffers.unshift(buffer.subarray(index));
                        return Buffer.concat(current);
                    }
                } else {
                    flag = 0;
                }
            }
        }
    }
    // 不再处理之后的流数据，并返回以保存但未处理的数据
    drain(){
        const buffer = this.buffers;
        this.buffers = [];
        return Buffer.concat(buffer);
    }
}
function createConnection(host: string, port: number){
    return new Promise<net.Socket>((resolve)=>{
        const socket = net.createConnection({host, port}, ()=>{
            resolve(socket);
        }).on('error',(e)=>{
            console.log('TCP error', `${host}:${port}`);
            console.error(e.name, e.message);
        }).on('close', hadError=>{
            if (DEBUG||hadError) {
                console.log('TCP close', `${host}:${port}`);
            }
        });
    });
}
function parseHeaders(str: string){
    return str.split('\r\n').reduce((headers,line)=>{
        const [k,v] = line.split(':');
        headers[k.trim().toLowerCase()] = v.trim();
        return headers;
    }, {} as Record<string, string>)
}
function listenSocket(socket: net.Socket){
    const bufferReader = new BufferReader();
    const remoteHost = `${socket.remoteAddress}:${socket.remotePort}`;
    socket.on('data', (buffer: Buffer)=>{
        bufferReader.feed(buffer);
    }).on('error', e=>{
        console.log('Proxy error', remoteHost);
        console.error(e.name, e.message);
    }).on('close', hadError => {
        if (DEBUG||hadError) {
            console.log('Proxy close', remoteHost);
        }
    });
    const CRLF = [0x0d, 0x0a];
    const CRLF2 = [...CRLF, ...CRLF];
    bufferReader.consume(CRLF).then(firstBuffer=>{
        // TODO: 校验buffer数据格式
        const [method, url, version] = firstBuffer.toString().split(' ');
        if  (method==='CONNECT') {
            const [hostname, port] = url.split(':');
            Promise.all([
                createConnection(hostname, +(port||443)),
                bufferReader.consume(CRLF2),
            ]).then(([remoteSocket, buffer])=>{
                if (DEBUG) {
                    console.log('HTTPS headers start');
                    console.log(buffer.toString());
                    console.log('HTTPS headers end');
                }
                socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
                socket.removeAllListeners('data');
                remoteSocket.pipe(socket);
                socket.pipe(remoteSocket);
            });
        } else {
            const { hostname, port } = new URL(url);
            Promise.all([
                createConnection(hostname, +(port||80)),
                bufferReader.consume(CRLF2),
            ]).then(([remoteSocket, buffer])=>{
                if (DEBUG) {
                    console.log('HTTP headers start');
                    console.log(`${method} ${url} ${version}`);
                    console.log(buffer.toString());
                    console.log('HTTP headers end');
                }
                remoteSocket.write(firstBuffer);
                remoteSocket.write(buffer);
                remoteSocket.write(bufferReader.drain());
                socket.removeAllListeners('data');
                remoteSocket.pipe(socket);
                socket.pipe(remoteSocket);
            });
        }
    });
}

function main(port?: number | undefined, hostname?: string | undefined){
    net.createServer(listenSocket).listen(port, hostname);
}

main(7890, '0.0.0.0');
