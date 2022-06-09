import { Server } from "http";

import { WebSocketServer } from "ws";

import Client from './Client.js';
import Events from "./Events";
import Session from "./Session";
import SocketError, { Recipients } from "./SocketError";

const DEFAULT_MAX_CLIENTS_COUNT = 2;
const DEFAULT_INTERVAL = 1000 * 60 * 10;
const DEFAULT_PATH = '/session';

const sessions = new Map<string, Session>();

export interface Message {
    data?: any
    error?: string
    event: Events
    id: string
    sessionId?: string
}

export interface Options {
    path?: string
    server: Server
}

export default function SocketWare(options: Options) {
    const webSocketServer = new WebSocketServer({
        server: options.server,
        path: options.path || DEFAULT_PATH,
        WebSocket: Client
    });

    function sendToClients(clients: Client[], message: Message) {
        clients.forEach((client: Client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }

            client.send(JSON.stringify(message));
        });
    }

    setInterval(() => {
        sessions.forEach((session: Session) => {
            if (session.isOutdated) {
                session.clients.forEach((client: Client) => {
                    client.terminate();
                });

                sessions.delete(session.id);
            }
        });
    }, DEFAULT_INTERVAL);

    webSocketServer.on('connection', (client: Client) => {
        client.on('message', (message: Message) => {
            const { id } = client;

            try {
                message = JSON.parse(message.toString()) as Message;

                if (message.event === Events.Error) {
                    throw new SocketError(message.error, Recipients.OtherSessionClients);
                }

                if (message.event === Events.Join) {
                    if (client.sessionId) {
                        throw new SocketError('Client is already in session.', Recipients.CurrentClient);
                    }

                    const { sessionId } = message;

                    if (!sessionId || typeof sessionId !== 'string' || !sessions.has(sessionId)) {
                        throw new SocketError('Session ID is missing or invalid.', Recipients.CurrentClient);
                    }

                    const session = sessions.get(sessionId);

                    session.joinClient(client);

                    return sendToClients(session.clients, { event: Events.Join, id, sessionId });
                }

                if (message.event === Events.New) {
                    const { maxClientsCount = DEFAULT_MAX_CLIENTS_COUNT } = message.data;

                    const session = new Session(maxClientsCount);
                    session.joinClient(client);
                    sessions.set(session.id, session);

                    return sendToClients([client], { event: Events.New, id, sessionId: session.id });
                }

                if (message.event === Events.Update) {
                    const { data, sessionId } = message;

                    if (!sessionId || typeof sessionId !== 'string' || !sessions.has(sessionId)) {
                        throw new SocketError('Session ID is missing or invalid.', Recipients.CurrentClient);
                    }

                    const session = sessions.get(sessionId);

                    if (!session.clients.find((_client) => _client === client)) {
                        throw new SocketError('Client is not part of session.', Recipients.CurrentClient);
                    }

                    return sendToClients(session.clients.filter((_client) => _client !== client), { event: Events.Error, data, id, sessionId });
                }
            } catch (error) {
                const { sessionId } = client;
                let clients = [];
                let session = null;

                if (sessionId && sessions.has(sessionId)) {
                    session = sessions.get(sessionId);
                    clients = session.clients;
                }

                if (error.recipients === Recipients.CurrentClient) {
                    clients = [client];
                }
                if (error.recipients === Recipients.OtherSessionClients) {
                    clients = session.clients.filter((_client) => _client !== client);
                }

                console.error(`${id}@${session?.id}: ${error}`);
                sendToClients(clients, { event: Events.Error, error: error.message, id, sessionId });
            }
        });

        client.on('pong', () => {
            const session = sessions.get(client.sessionId);

            if (session) {
                session.update();
            }
        });
    });
};
