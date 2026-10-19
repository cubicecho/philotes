import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createImapConnector, HEADERS_ONLY } from '../../mail/imap-reader.ts';
import { MailLoginRefused } from '../../mail/reader.ts';

describe('the IMAP reader', () => {
  let silent: Server;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    // Takes the connection and never speaks TLS, as a service that is not a mail server would.
    silent = createServer((socket) => {
      sockets.push(socket);
      socket.end();
    });
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => silent.close(resolve));
  });

  it('fetches the envelope and the received time, and nothing of the body', () => {
    expect(HEADERS_ONLY).toEqual({ uid: true, envelope: true, internalDate: true });
  });

  it('fails, without calling it a refused login, against something that is not a TLS mail server', async () => {
    const connect = createImapConnector({ connectTimeoutSeconds: 2 });
    const address = silent.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    const login = { host: '127.0.0.1', port, username: 'u', password: 'p' };

    const failure = await connect(login).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(MailLoginRefused);
  });
});
